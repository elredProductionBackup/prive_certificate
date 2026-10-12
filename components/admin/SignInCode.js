"use client";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearOtpError, editEmail, sendOtp, verifyOtp } from "@/store/slices/otpSlice";
import useNow from "@/hooks/useNow";

const RESEND_AFTER_MS = 30 * 1000;

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function SignInCode() {
  const dispatch = useDispatch();
  const { email, sentTo, sentAt, codeExpiresAt, sending, verifying, error } = useSelector((s) => s.otp);
  const [code, setCode] = useState("");
  const inputRef = useRef(null);
  const lastTried = useRef("");
  const now = useNow(1000);

  const left = (codeExpiresAt || 0) - now;
  const expired = left <= 0;
  const resendIn = (sentAt || 0) + RESEND_AFTER_MS - now;
  const toSuperAdmin = sentTo === "superAdmin";

  // A new code was sent: start over
  useEffect(() => { setCode(""); lastTried.current = ""; inputRef.current?.focus(); }, [sentAt]);

  // Wrong code (errorCode 5): select it so typing replaces it
  useEffect(() => {
    if (error?.errorCode === 5) inputRef.current?.select();
  }, [error]);

  function submit(value) {
    if (value.length !== 6 || verifying) return;
    lastTried.current = value;
    dispatch(verifyOtp({ email, otp: value }));
  }

  function onChange(e) {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    if (error) dispatch(clearOtpError());
    // Sign in as soon as the 6th digit is typed or pasted (once per code)
    if (value.length === 6 && value !== lastTried.current) submit(value);
  }

  const resend = () => dispatch(sendOtp(email));
  const needsNewCode = error?.errorCode === 8;
  const blocked = error?.errorCode === 113 || error?.errorCode === 115;

  return (
    <form className="signin" onSubmit={(e) => { e.preventDefault(); submit(code); }} noValidate>
      <div className={`signin__notice${toSuperAdmin ? " signin__notice--approval" : ""}`}>
        {toSuperAdmin ? (
          <>
            <strong>Ask the super admin for your code.</strong>
            <span>
              <b>{email}</b> isn&rsquo;t a portal admin yet, so the code went to Privé&rsquo;s super admin for approval.
              If they share it with you, entering it makes you an admin.
            </span>
          </>
        ) : (
          <>
            <strong>Check your inbox.</strong>
            <span>We sent a 6-digit code to <b>{email}</b>.</span>
          </>
        )}
      </div>

      <div className="field">
        <label htmlFor="signin-code">6-digit code</label>
        <input
          ref={inputRef}
          id="signin-code"
          className="input otp-input"
          value={code}
          onChange={onChange}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="••••••"
          aria-invalid={!!error}
          aria-describedby="signin-code-time"
          autoFocus
        />
        <span id="signin-code-time" className="hint">
          {expired ? "This code has run out. Send a new one." : `The code works for another ${mmss(left)}.`}
        </span>
      </div>

      {error && (
        <div className="alert alert--error signin__error" role="alert">
          <span>{error.message}</span>
          {needsNewCode && (
            <button type="button" className="btn btn--sm" onClick={resend} disabled={sending}>
              {sending ? "Sending…" : "Send a new code"}
            </button>
          )}
        </div>
      )}

      <button className="btn" type="submit" disabled={verifying || code.length !== 6 || blocked}>
        {verifying ? "Signing in…" : "Sign in"}
      </button>

      <div className="signin__links">
        <button type="button" className="linklike" onClick={() => dispatch(editEmail())}>Use a different email</button>
        {!needsNewCode && (
          <button type="button" className="linklike" onClick={resend} disabled={sending || (resendIn > 0 && !expired)}>
            {sending ? "Sending…" : resendIn > 0 && !expired ? `Send a new code in ${mmss(resendIn)}` : "Send a new code"}
          </button>
        )}
      </div>
    </form>
  );
}
