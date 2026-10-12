"use client";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Certificate from "@/components/certificate/Certificate";
import EmailBadge from "@/components/common/EmailBadge";
import { downloadHref } from "./CertificateTable";
import { closeCertificate, deleteCertificate, resendCertificateEmail } from "@/store/slices/certificatesSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { formatDateTime, formatLongDate, plural, verifyLink } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CertificateDialog({ cert }) {
  const dispatch = useDispatch();
  const dialogRef = useRef(null);
  const busy = useSelector((s) => s.certificates.rowBusy[cert.certificateId]);
  const [email, setEmail] = useState(cert.recipientEmail || "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const close = () => dispatch(closeCertificate());
  const revoked = cert.status === "revoked";
  const link = verifyLink(cert.certificateId);
  const href = downloadHref(cert);
  const trimmed = email.trim();
  const changed = trimmed !== (cert.recipientEmail || "");

  async function send() {
    setError("");
    if (!trimmed) return setError("Add an email address first.");
    if (!EMAIL_RE.test(trimmed)) return setError("That email address doesn't look right.");
    const action = await dispatch(resendCertificateEmail({
      certificateId: cert.certificateId,
      recipientEmail: changed ? trimmed : undefined,
    }));
    if (resendCertificateEmail.fulfilled.match(action)) {
      // A failed send still answers 200: check emailStatus, not the HTTP status
      const updated = action.payload;
      if (updated.emailStatus === "sent") dispatch(pushToast(`Email sent to ${updated.recipientEmail}`));
      else dispatch(pushToast(`The email to ${updated.recipientEmail} didn't go out. ${updated.emailError || ""}`.trim(), "error"));
    } else if (action.payload?.status !== 401) {
      setError(action.payload?.message || "Couldn't send the email.");
    }
  }

  async function remove() {
    setError("");
    const action = await dispatch(deleteCertificate(cert.certificateId));
    if (deleteCertificate.fulfilled.match(action)) {
      const r = action.payload;
      dispatch(pushToast(`Deleted ${r.recipientName || cert.recipientName}'s certificate${r.imageDeleted === false ? ". The image is still in storage and has been logged for cleanup." : ""}`));
    } else if (action.payload?.status !== 401) {
      setConfirming(false);
      setError(action.payload?.message || "Couldn't delete the certificate.");
    }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); } catch { /* clipboard blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const sendLabel = busy === "email"
    ? "Sending…"
    : changed && cert.recipientEmail ? "Save and send"
    : cert.emailStatus === "sent" ? "Send again" : "Send certificate email";

  return (
    <dialog ref={dialogRef} className="modal" onClose={close} onClick={(e) => e.target === dialogRef.current && close()}
      aria-labelledby="cert-modal-title">
      <div className="modal__body">
        <div className="modal__head">
          <div>
            <h2 id="cert-modal-title" style={{ fontSize: 22 }}>{cert.recipientName}</h2>
            <p className="modal__meta">
              <span className={`badge badge--${cert.status}`}>{revoked ? "Revoked" : "Active"}</span>
              <EmailBadge cert={cert} />
              <span>
                {cert.certificateId} &nbsp;|&nbsp; issued {formatLongDate(cert.createdAt)}
                {cert.issuedBy?.email ? ` by ${cert.issuedBy.email}` : ""} &nbsp;|&nbsp; checked {plural(cert.verifyCount || 0, "time")}
              </span>
            </p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={close}>Close</button>
        </div>

        <div className="modal__sheet">
          {cert.certificateImageUrl && !revoked
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={cert.certificateImageUrl} alt={`Certificate for ${cert.recipientName}`} />
            : <Certificate cert={cert} revoked={revoked} />}
        </div>

        <div className="modal__actions">
          {href && (
            <a className="btn" href={href} target={revoked ? "_blank" : undefined} rel="noopener noreferrer">
              {revoked ? "Open image" : "Download PNG"}
            </a>
          )}
          <a className="btn btn--ghost" href={`/verify/${cert.certificateId}`} target="_blank" rel="noopener noreferrer">Open verification page</a>
          <button className="btn btn--ghost" onClick={copyLink}>{copied ? "Link copied" : "Copy verification link"}</button>
        </div>

        {cert.emailStatus === "failed" && cert.emailError && (
          <p className="alert alert--error" style={{ margin: 0 }}>The last email failed: {cert.emailError}</p>
        )}
        {error && <p className="alert alert--error" role="alert" style={{ margin: 0 }}>{error}</p>}

        <div className="modal__tools">
          <div className="field">
            <label htmlFor="modal-email">Email</label>
            <div className="modal__inline">
              <input id="modal-email" type="email" className="input" placeholder="name@company.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }} disabled={revoked} />
              <button className="btn" onClick={send} disabled={!!busy || revoked || !trimmed}>{sendLabel}</button>
            </div>
            <span className="hint">
              {revoked
                ? "Revoked certificates can't be emailed."
                : <>
                    {cert.emailedAt ? `Last emailed ${formatDateTime(cert.emailedAt)}. ` : ""}
                    Sends the certificate email again with the PNG attached. A changed address is saved first.
                  </>}
            </span>
          </div>

          {!confirming ? (
            <div>
              <button className="btn btn--danger btn--sm" onClick={() => setConfirming(true)} disabled={!!busy}>Delete permanently</button>
            </div>
          ) : (
            <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
              <p id="confirm-title">
                <strong>Delete {cert.recipientName}&rsquo;s certificate {cert.certificateId}?</strong>
                {" "}The record and image are removed. Anyone with the link or QR code will be told no certificate matches this ID. This can&rsquo;t be undone.
              </p>
              <div className="confirm__actions">
                <button className="btn btn--danger-solid" onClick={remove} disabled={busy === "delete"} autoFocus>
                  {busy === "delete" ? "Deleting…" : "Delete certificate"}
                </button>
                <button className="btn btn--ghost" onClick={() => setConfirming(false)} disabled={busy === "delete"}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

export default function CertificateModal() {
  const cert = useSelector((s) => s.certificates.selected);
  if (!cert) return null;
  return <CertificateDialog key={cert.certificateId} cert={cert} />;
}
