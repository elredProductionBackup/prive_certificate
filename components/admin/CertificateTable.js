"use client";
import { useDispatch, useSelector } from "react-redux";
import EmailBadge from "@/components/common/EmailBadge";
import { clearFilters, openCertificate, setPage } from "@/store/slices/certificatesSlice";
import { verifyApi } from "@/services/verifyApi";
import { formatCertDate, HEADERS } from "@/lib/site";

export function DownloadIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 12.5h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Active: the public download (saves the file). Revoked: the stored image, if any. */
export function downloadHref(c) {
  return c.status === "active" ? verifyApi.downloadUrl(c.certificateId) : c.certificateImageUrl || "";
}

export default function CertificateTable() {
  const dispatch = useDispatch();
  const { items, status, error, page, totalPages, totalCount, filters } = useSelector((s) => s.certificates);
  const loading = status === "loading" || status === "idle";
  const filtered = !!filters.q || filters.status !== "all" || filters.emailStatus !== "all";

  if (status === "failed" && error && error.status !== 401) {
    return <div className="empty empty--error"><p>{error.message}</p></div>;
  }

  if (!loading && totalCount === 0) {
    return (
      <div className="empty">
        {filtered ? (
          <p>No certificates match. <button type="button" className="linklike" onClick={() => dispatch(clearFilters())}>Clear the search and filters</button></p>
        ) : (
          <p>No certificates yet. Issue the first one above.</p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="table-scroll" aria-busy={loading}>
        <table className="table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Certificate ID</th>
              <th>Programme</th>
              <th>Date</th>
              <th>Status</th>
              <th>Email</th>
              <th style={{ textAlign: "right" }}>Checks</th>
              <th><span className="sr-only">Download</span></th>
            </tr>
          </thead>
          <tbody className={loading && items.length ? "is-loading" : undefined}>
            {loading && items.length === 0 && (
              <tr className="row-skeleton"><td colSpan={8}><span className="spinner spinner--dark" /> Loading certificates…</td></tr>
            )}
            {items.map((c) => {
              const href = downloadHref(c);
              return (
                <tr key={c.certificateId} onClick={() => dispatch(openCertificate(c))} tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && dispatch(openCertificate(c))}>
                  <td>
                    <span className="t-name">{c.recipientName}</span>
                    {c.recipientEmail && <span className="t-sub">{c.recipientEmail}</span>}
                  </td>
                  <td className="t-id">{c.certificateId}</td>
                  <td>
                    <span>{c.programTitle}</span>
                    <span className="t-sub">{c.speakerName} &nbsp;|&nbsp; {HEADERS[c.header] || "Privé"}</span>
                  </td>
                  <td>{formatCertDate(c.eventDate)}</td>
                  <td><span className={`badge badge--${c.status}`}>{c.status === "active" ? "Active" : "Revoked"}</span></td>
                  <td><EmailBadge cert={c} /></td>
                  <td style={{ textAlign: "right" }}>{c.verifyCount || 0}</td>
                  <td className="t-action">
                    {href && (
                      <a className="dl-btn" href={href}
                        target={c.status === "active" ? undefined : "_blank"} rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
                        aria-label={`Download certificate for ${c.recipientName}`} title="Download PNG">
                        <DownloadIcon />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pager">
          <button className="btn btn--ghost btn--sm" disabled={page <= 1 || loading} onClick={() => dispatch(setPage(page - 1))}>Previous</button>
          <span className="muted small">Page {page} of {totalPages}</span>
          <button className="btn btn--ghost btn--sm" disabled={page >= totalPages || loading} onClick={() => dispatch(setPage(page + 1))}>Next</button>
        </div>
      )}
    </>
  );
}
