"use client";
import { useDispatch, useSelector } from "react-redux";
import { sendOtp, setOtpEmail } from "@/store/slices/otpSlice";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInEmail() {
  const dispatch = useDispatch();
  const { email, sending, error } = useSelector((s) => s.otp);

  function onSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      dispatch(setOtpEmail(email)); // clears any old error
      return;
    }
    dispatch(sendOtp(email));
  }

  const invalid = email.length > 0 && !EMAIL_RE.test(email.trim());

  return (
    <form className="signin" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => dispatch(setOtpEmail(e.target.value))}
          autoComplete="email"
          inputMode="email"
          placeholder="name@theprive.network"
          autoFocus
          required
        />
        <span className="hint">We&rsquo;ll email a 6-digit code. There&rsquo;s no password.</span>
      </div>
      {error && <p className="alert alert--error" role="alert" style={{ margin: 0 }}>{error.message}</p>}
      <button className="btn" type="submit" disabled={sending || !email.trim() || invalid}>
        {sending ? "Sending code…" : "Send code"}
      </button>
    </form>
  );
}
