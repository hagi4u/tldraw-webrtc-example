import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

export default function IndexPage() {
  const roomRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleGoToRoom = () => {
    const room = roomRef.current?.value;
    navigate(`/board/${room}`);
  };

  const handleCreateRoom = () => {
    navigate(`/board/${uuidv4()}`);
  };

  return (
    <div className="flex flex-col h-screen justify-center gap-8">
      <h1 className="text-4xl text-center">
        WebRTC 기반의 화이트보드 도구 입니다.
      </h1>
      <input
        ref={roomRef}
        type="text"
        className="border border-gray-600 p-4 text-xl"
        placeholder="참가 할 방을 입력해주세요."
      />
      <button
        className="bg-slate-200 text-black px-4 py-4 rounded-lg"
        onClick={handleGoToRoom}
      >
        참가
      </button>
      <button
        className="bg-gray-600 text-white px-4 py-4 rounded-lg"
        onClick={handleCreateRoom}
      >
        생성
      </button>
    </div>
  );
}
