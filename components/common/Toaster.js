"use client";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { dismissToast } from "@/store/slices/uiSlice";

function Toast({ toast }) {
  const dispatch = useDispatch();
  useEffect(() => {
    const t = setTimeout(() => dispatch(dismissToast(toast.id)), toast.tone === "error" ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [dispatch, toast.id, toast.tone]);
  return (
    <div className={`toast toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
      <span>{toast.text}</span>
      <button type="button" onClick={() => dispatch(dismissToast(toast.id))} aria-label="Dismiss">×</button>
    </div>
  );
}

export default function Toaster() {
  const toasts = useSelector((s) => s.ui.toasts);
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}
