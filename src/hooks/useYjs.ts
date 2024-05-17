import { useEffect, useMemo, useState } from "react";
import {
  computed,
  createPresenceStateDerivation,
  createTLStore,
  defaultShapeUtils,
  defaultUserPreferences,
  getUserPreferences,
  HistoryEntry,
  InstancePresenceRecordType,
  react,
  RecordsDiff,
  SerializedSchema,
  setUserPreferences,
  TLInstancePresence,
  TLRecord,
  TLStoreWithStatus,
} from "tldraw";
import { YKeyValue } from "y-utility/y-keyvalue";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";

import { CHANGE_TYPE, CONNECTION_STATUS, STATUS } from "@/enums/Tldraw";
import { AWARENESS_EVENT, EVENTS, STORE_EVENT } from "@/enums/Yjs";

type UseYjsProp = {
  room: string;
  signalingHost?: string;
};

type YStoreChangeItem = Map<
  string,
  | { action: CHANGE_TYPE.ADD; oldValue: TLRecord }
  | { action: CHANGE_TYPE.UPDATE; oldValue: TLRecord; newValue: TLRecord }
  | { action: CHANGE_TYPE.DELETE; newValue: TLRecord }
>;

type DrawUser = {
  id: string;
  color: string;
  name: string;
};

export default function ({
  room = "",
  signalingHost = "ws://localhost:4444",
}: UseYjsProp) {
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });
  const [store] = useState(() =>
    createTLStore({
      shapeUtils: defaultShapeUtils,
    }),
  );

  const { yDoc, yStore, provider, meta } = useMemo(() => {
    const yDoc = new Y.Doc();
    const yArr = yDoc.getArray<{ key: string; val: TLRecord }>(`tldraw_${room}`);
    const meta = yDoc.getMap<SerializedSchema>("meta");
    const yStore = new YKeyValue(yArr);
    const provider = new WebrtcProvider(room, yDoc, {
      signaling: [signalingHost],
    });

    return {
      yDoc,
      yArr,
      meta,
      yStore,
      provider,
    };
  }, [room, signalingHost]);

  useEffect(() => {
    const unSubscribes: (() => void)[] = [];

    const handleSyncPeers = () => {
      handleSyncWhiteBoard();
      handleSyncAwareness();
      handleSyncSchema();

      meta.observe(handleSyncMeta);
      yStore.on(STORE_EVENT.CHANGE, handleYStoreChange);

      unSubscribes.push(() => meta.unobserve(handleSyncMeta));
      unSubscribes.push(() =>
        yStore.off(STORE_EVENT.CHANGE, handleYStoreChange),
      );
    };

    const handleSyncWhiteBoard = () => {
      const handleSyncYDoc = ({ changes }: HistoryEntry) => {
        yDoc.transact(() => {
          Object.values(changes.added).forEach((record) => {
            yStore.set(record.id, record as TLRecord);
          });

          Object.values(changes.updated).forEach(([, record]) => {
            yStore.set(record.id, record as TLRecord);
          });

          Object.values(changes.removed).forEach((record) => {
            yStore.delete(record.id);
          });
        });
      };

      store.listen(handleSyncYDoc, { source: "user", scope: "document" });
    };

    const handleYStoreChange = (
      changes: YStoreChangeItem,
      transaction: Y.Transaction,
    ) => {
      if (transaction.local) {
        return;
      }

      const removeChanges: TLRecord["id"][] = [];
      const putChanges: TLRecord[] = [];

      changes.forEach((change, id) => {
        switch (change.action) {
          case CHANGE_TYPE.ADD:
          case CHANGE_TYPE.UPDATE: {
            const record = yStore.get(id) as TLRecord;
            putChanges.push(record);
            break;
          }
          case CHANGE_TYPE.DELETE:
            removeChanges.push(id as TLRecord["id"]);
            break;
        }
      });

      store.mergeRemoteChanges(() => {
        if (putChanges.length) {
          store.put(putChanges);
        }

        if (removeChanges.length) {
          store.remove(removeChanges);
        }
      });
    };

    const handleSyncAwareness = () => {
      const clientID = provider.awareness.clientID.toString();
      setUserPreferences({ id: clientID });

      const userPreferences = computed<DrawUser>("userPerferences", () => {
        const user = getUserPreferences();

        return {
          id: user.id,
          color: user.color ?? defaultUserPreferences.color,
          name: user.name ?? defaultUserPreferences.name,
        };
      });

      const presenceId = InstancePresenceRecordType.createId(clientID);
      const presenceDerivation = createPresenceStateDerivation(
        userPreferences,
        presenceId,
      )(store);

      provider.awareness.setLocalStateField(
        "presence",
        presenceDerivation.get(),
      );

      unSubscribes.push(
        react("changePresence", () => {
          const presence = presenceDerivation.get();
          requestAnimationFrame(() => {
            provider.awareness.setLocalStateField("presence", presence);
          });
        }),
      );

      const handleUpdateAwareness = (
        update: Record<keyof RecordsDiff<never>, number[]>,
      ) => {
        const states = provider.awareness.getStates() as Map<
          number,
          { presence: TLInstancePresence }
        >;

        const removeChanges: TLInstancePresence["id"][] = [];
        const putChanges: TLInstancePresence[] = [];

        for (const clientId of update.added) {
          const state = states.get(clientId);
          if (state?.presence && state.presence.id !== presenceId) {
            putChanges.push(state.presence);
          }
        }

        for (const clientId of update.updated) {
          const state = states.get(clientId);
          if (state?.presence && state.presence.id !== presenceId) {
            putChanges.push(state.presence);
          }
        }

        for (const clientId of update.removed) {
          removeChanges.push(
            InstancePresenceRecordType.createId(clientId.toString()),
          );
        }

        store.mergeRemoteChanges(() => {
          if (putChanges.length) {
            store.put(putChanges);
          }

          if (removeChanges.length) {
            store.remove(removeChanges);
          }
        });
      };

      provider.awareness.on(AWARENESS_EVENT.UPDATE, handleUpdateAwareness);
      unSubscribes.push(() =>
        provider.awareness.off(AWARENESS_EVENT.UPDATE, handleUpdateAwareness),
      );
    };

    const handleSyncMeta = () => {
      const schema = meta.get("schema");
      if (!schema) {
        throw new Error("동기화 된 화이트보드의 스키마를 찾지 못했습니다.");
      }

      const newSchema = store.schema.getMigrationsSince(schema);

      if (!newSchema.ok || newSchema.value.length > 0) {
        window.alert(
          "화이트보드 스키마가 업데이트 되었습니다.\n페이지를 새로고침합니다.",
        );
        yDoc.destroy();
        window.location.reload();
        return;
      }
    };

    const handleSyncSchema = () => {
      if (!yStore.yarray.length) {
        yDoc.transact(() => {
          for (const record of store.allRecords()) {
            yStore.set(record.id, record);
          }

          meta.set("schema", store.schema.serialize());
        });
        return;
      }

      const schema = store.schema.serialize();
      const newSchema = meta.get("schema");

      if (!newSchema) {
        throw new Error("동기화 된 화이트보드의 스키마를 찾지 못했습니다.");
      }
      const records = yStore.yarray.toJSON().map(({ val }) => val);
      const migrationSnapshot = store.schema.migrateStoreSnapshot({
        schema: newSchema,
        store: Object.fromEntries(records.map((record) => [record.id, record])),
      });

      if (migrationSnapshot.type === "error") {
        window.alert(
          "화이트보드 스키마가 업데이트 되었습니다.\n페이지를 새로고침합니다.",
        );
        window.location.reload();
        return;
      }

      yDoc.transact(() => {
        for (const record of records) {
          if (!migrationSnapshot.value[record.id]) {
            yStore.delete(record.id);
          }
        }

        for (const record of Object.values(
          migrationSnapshot.value,
        ) as TLRecord[]) {
          yStore.set(record.id, record);
        }
        meta.set("schema", schema);
      });

      store.loadSnapshot({
        store: migrationSnapshot.value,
        schema,
      });
    };

    const handleConnect = ({ connected }: { connected: boolean }) => {
      if (!connected) {
        provider.off(EVENTS.SYNCED, handleSyncPeers);
        setStoreWithStatus({
          store,
          status: STATUS.SYNCED_REMOTE,
          connectionStatus: CONNECTION_STATUS.OFFLINE,
        });
        return;
      }

      provider.on(EVENTS.SYNCED, handleSyncPeers);
      unSubscribes.push(() => provider.off(EVENTS.SYNCED, handleSyncPeers));

      setStoreWithStatus({
        store,
        status: STATUS.SYNCED_REMOTE,
        connectionStatus: CONNECTION_STATUS.ONLINE,
      });
    };

    provider.on(EVENTS.STATUS, handleConnect);
    provider.emit(EVENTS.STATUS, [{ connected: true }]);

    unSubscribes.push(() =>
      provider.emit(EVENTS.STATUS, [{ connected: false }]),
    );

    return () => {
      unSubscribes.forEach((fn) => fn());
      unSubscribes.length = 0;
    };
  }, [store, provider, yStore, yDoc, meta]);

  return storeWithStatus;
}
