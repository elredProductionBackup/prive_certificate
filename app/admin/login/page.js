"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import SignInEmail from "@/components/admin/SignInEmail";
import SignInCode from "@/components/admin/SignInCode";
import ProfileForm from "@/components/admin/ProfileForm";
import { finishProfileStep } from "@/store/slices/otpSlice";
import { clearSessionMessage } from "@/store/slices/authSlice";

export default function AdminLogin() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { status, sessionMessage } = useSelector((s) => s.auth);
  const step = useSelector((s) => s.otp.step);

  // Signed in (and no profile step to finish): go to the certificates
  useEffect(() => {
    if (status === "authenticated" && step !== "profile") router.replace("/admin");
  }, [status, step, router]);

  // The "session ended" note only matters until they start signing in again
  useEffect(() => {
    if (step !== "email" && sessionMessage) dispatch(clearSessionMessage());
  }, [step, sessionMessage, dispatch]);

  if (status === "authenticated" && step !== "profile") return null;

  const profile = step === "profile";

  return (
    <div className="wrap wrap--signin">
      <h1>{profile ? "Welcome to the portal" : "Admin sign in"}</h1>
      <p className="lede">
        {profile
          ? "You're now a portal admin. Add your name so others can see who issued each certificate."
          : "Issue and manage Privé programme certificates."}
      </p>

      {sessionMessage && step === "email" && (
        <p className="alert alert--info" style={{ marginTop: 20, marginBottom: 0 }}>{sessionMessage}</p>
      )}

      <div className="frame" style={{ marginTop: 28 }}>
        <div className="frame__inner">
          {step === "email" && <SignInEmail />}
          {step === "code" && <SignInCode />}
          {profile && (
            <ProfileForm
              welcome
              onDone={() => { dispatch(finishProfileStep()); router.replace("/admin"); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
