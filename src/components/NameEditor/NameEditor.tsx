import { FC } from "react";
import { track, useEditor } from "tldraw";

const NameEditor: FC = track(() => {
  const editor = useEditor();

  const { color, name } = editor.user.getUserPreferences();

  return (
    <div className="flex pointer-events-all">
      <input
        type="color"
        value={color}
        onChange={(e) => {
          editor.user.updateUserPreferences({
            color: e.currentTarget.value,
          });
        }}
      />
      <input
        value={name}
        className="border border-gray-300 px-2"
        onChange={(e) => {
          editor.user.updateUserPreferences({
            name: e.currentTarget.value,
          });
        }}
      />
    </div>
  );
});
export default NameEditor;
