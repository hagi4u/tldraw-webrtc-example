import NameEditor from "@/components/NameEditor/NameEditor";
import TldrawEditor from "@/components/Tldraw/Tldraw";
import { useNavigate, useParams } from "react-router-dom";

import useYjs from "@/hooks/useYjs";

export default function BoardPage() {
  const params = useParams();
  const navigate = useNavigate();

  const { room = "" } = params;

  const store = useYjs({
    room,
    signalingHost: `ws://${window.location.hostname}:4444`,
  });

  const handleCopyUrl = () => {
    const textArea = document.createElement("textarea") as HTMLTextAreaElement;
    textArea.value = window.location.href;

    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand("copy");
    } catch (err) {
      alert("url 복사에 실패하였습니다.");
    }

    document.body.removeChild(textArea);
    alert("url이 복사되었습니다.");
  };

  if (room.length === 0) {
    navigate("/");
    return null;
  }

  return (
    <>
      <TldrawEditor
        store={store}
        components={{
          SharePanel: NameEditor,
        }}
      />
      <div className="fixed top-0 left-1/2 -translate-x-1/2">
        <button
          className="bg-slate-200 text-gray-600 px-4 py-2 rounded-md text-md"
          onClick={handleCopyUrl}
        >
          URL 복사
        </button>
      </div>
    </>
  );
}
