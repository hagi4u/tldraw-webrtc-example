import Board from "@/pages/Board";
import Index from "@/pages/Index";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

export default function AppRouter() {
  const location = useLocation();

  useEffect(() => {
    document.documentElement.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/board/:room" element={<Board />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
