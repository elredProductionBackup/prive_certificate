"use client";
// What happened in the last issuing run: who got a certificate, whose email
// went out, and anyone who couldn't be issued (with the server's reason).
import { useDispatch, useSelector } from "react-redux";
import EmailBadge from "@/components/common/EmailBadge";
import { dismissResults } from "@/store/slices/issueSlice";
import { exportCertificatesZip, openCertificate } from "@/store/slices/certificatesSlice";
import { pushToast } from "@/store/slices/uiSlice";
import { verifyApi } from "@/services/verifyApi";
import { downloadCsv } from "@/lib/download";
import { plural, verifyLink } from "@/lib/site";

function emailSummary(issued, sentWithEmail) {
  if (!sentWithEmail) return "Email was switched off, so nothing was sent.";
  const sent = issued.filter((c) => c.emailStatus === "sent").length;
  const failed = issued.filter((c) => c.emailStatus === "failed").length;
  const noEmail = issued.filter((c) => c.emailStatus === "no-email").length;
  const parts = [];
  if (sent) parts.push(`Emailed ${sent}`);
  if (failed) parts.push(`${failed} email${failed === 1 ? "" : "s"} failed`);
  if (noEmail) parts.push(`${noEmail} had no email address`);
  return parts.length ? `${parts.join("; ")}.` : "";
}

export default function IssueResults() {
  const dispatch = useDispatch();
  const { issued, failed, sentWithEmail, running } = useSelector((s) => s.issue);
  const exporting = useSelector((s) => s.certificates.exporting);

  if (running || (issued.length === 0 && failed.length === 0)) return null;

  async function zip() {
    const action = await dispatch(exportCertificatesZip({ ids: issued.map((c) => c.certificateId) }));
    if (exportCertificatesZip.rejected.match(action) && action.payload?.status !== 401) {
      dispatch(pushToast(action.payload.message, "error"));
    }
  }

  return (
    <div className="results">
      {issued.length > 0 && (
        <div className="alert alert--ok issued">
          <div className="issued__head">
            <strong>Issued {plural(issued.length, "certificate")}. {emailSummary(issued, sentWithEmail)}</strong>
            <div className="issued__actions">
              {issued.length === 1 ? (
                <a className="btn btn--sm" href={verifyApi.downloadUrl(issued[0].certificateId)}>Download certificate</a>
              ) : (
                <button type="button" className="btn btn--sm" onClick={zip} disabled={exporting}>
                  {exporting ? "Preparing ZIP…" : `Download all ${issued.length} (ZIP)`}
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => downloadCsv(issued, verifyLink)}>IDs as CSV</button>
            </div>
          </div>
          <ul>
            {issued.slice(0, 8).map((c) => (
              <li key={c.certificateId}>
                <button type="button" className="linklike" onClick={() => dispatch(openCertificate(c))}>{c.recipientName}</button>
                <span className="issued__meta">
                  {c.recipientEmail && <EmailBadge cert={c} />}
                  <span className="mono">{c.certificateId}</span>
                </span>
              </li>
            ))}
            {issued.length > 8 && <li className="muted">and {issued.length - 8} more in the CSV</li>}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="alert alert--error issued">
          <strong>
            {plural(failed.length, "certificate")} couldn&rsquo;t be issued.
            {issued.length > 0 && " They're left in the box above so you can fix them and issue again."}
          </strong>
          <ul>
            {failed.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span>{f.name}</span>
                <span className="issued__why">{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" className="linklike muted small" onClick={() => dispatch(dismissResults())}>Hide this summary</button>
    </div>
  );
}
