"use client";
// Shows admin pages only to a signed-in admin; everyone else goes to sign in.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";

export default function AuthGate({ children }) {
  const router = useRouter();
  const status = useSelector((s) => s.auth.status);

  useEffect(() => {
    if (status === "anonymous") router.replace("/admin/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="wrap">
        <p className="muted gate-wait"><span className="spinner spinner--dark" /> Checking your session…</p>
      </div>
    );
  }
  return children;
}
