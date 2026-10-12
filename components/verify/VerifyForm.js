"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Keeps only what matters and groups it as 2026-XXXX-XXXX while typing or pasting
function format(raw) {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (s.startsWith("PRV")) s = s.slice(3);
  s = s.slice(0, 12);
  return [s.slice(0, 4), s.slice(4, 8), s.slice(8, 12)].filter(Boolean).join("-");
}

export default function VerifyForm({ initial = "", autoFocus = false }) {
  const router = useRouter();
  const [value, setValue] = useState(format(initial));
  const [error, setError] = useState("");
  const [busy, startTransition] = useTransition(); // true until the result page has loaded
  const chars = value.replace(/-/g, "").length;

  function onSubmit(e) {
    e.preventDefault();
    if (chars < 12) {
      setError(`That's ${chars} of 12 characters. Copy the full ID from the bottom-left corner of the certificate.`);
      return;
    }
    setError("");
    startTransition(() => router.push(`/verify/PRV-${value}`));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="cert-id" className="plate__label">Certificate ID</label>
      <div className="idfield">
        <div className="idfield__box">
          <span className="idfield__prefix" aria-hidden="true">PRV-</span>
          <input
            id="cert-id"
            className="idfield__input"
            placeholder="2026-XXXX-XXXX"
            value={value}
            onChange={(e) => { setValue(format(e.target.value)); setError(""); }}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            inputMode="text"
            autoFocus={autoFocus}
            aria-invalid={!!error}
            aria-describedby="cert-id-help"
          />
          <span className="idfield__progress" aria-hidden="true" data-done={chars >= 12 || undefined}>
            {[4, 8, 12].map((n) => <i key={n} data-on={chars >= n || undefined} />)}
          </span>
        </div>
        {/* Both labels share one grid cell, so the button keeps the same width while checking */}
        <button className="btn idfield__btn" type="submit" disabled={busy} aria-busy={busy}>
          <span className="idfield__btn-text">Verify</span>
          <span className="idfield__btn-spin" aria-hidden="true"><span className="spinner" /></span>
          <span className="sr-only" aria-live="polite">{busy ? "Checking the certificate" : ""}</span>
        </button>
      </div>
      <p id="cert-id-help" className={error ? "alert alert--error" : "plate__hint"} style={error ? { marginTop: 14 } : undefined}>
        {error || "Letters and numbers only; dashes are added for you. Pasting the whole ID works too."}
      </p>
    </form>
  );
}
