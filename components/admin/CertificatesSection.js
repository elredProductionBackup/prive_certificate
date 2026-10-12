"use client";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Select from "@/components/common/Select";
import CertificateTable from "./CertificateTable";
import {
  exportCertificatesZip, fetchCertificates, selectHasFilters,
  setEmailFilter, setSearch, setStatusFilter,
} from "@/store/slices/certificatesSlice";
import { pushToast } from "@/store/slices/uiSlice";

export default function CertificatesSection() {
  const dispatch = useDispatch();
  const { filters, page, stats, totalCount, exporting } = useSelector((s) => s.certificates);
  const hasFilters = useSelector(selectHasFilters);
  const [q, setQ] = useState(filters.q);

  // Keep the box in step if the filters are cleared elsewhere
  useEffect(() => { setQ(filters.q); }, [filters.q]);

  // Search waits for a pause in typing
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => dispatch(setSearch(q)), 300);
    return () => clearTimeout(t);
  }, [q, filters.q, dispatch]);

  // Reload whenever the search, a filter or the page changes
  useEffect(() => {
    dispatch(fetchCertificates());
  }, [dispatch, filters.q, filters.status, filters.emailStatus, page]);

  async function downloadZip() {
    const action = await dispatch(exportCertificatesZip());
    if (exportCertificatesZip.rejected.match(action) && action.payload?.status !== 401) {
      dispatch(pushToast(action.payload.message, "error"));
    }
  }

  const statusOptions = [
    { value: "all", label: "All", count: stats?.issued },
    { value: "active", label: "Active", count: stats?.active },
    { value: "revoked", label: "Revoked", count: stats?.revoked },
  ];
  const emailOptions = [
    { value: "all", label: "Any" },
    { value: "sent", label: "Sent" },
    { value: "failed", label: "Failed" },
    { value: "not-sent", label: "Not sent" },
  ];

  return (
    <section className="list-section" aria-labelledby="list-title">
      <div className="list-head">
        <div className="list-title">
          <h2 id="list-title">Issued certificates</h2>
          {totalCount > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={downloadZip} disabled={exporting}>
              {exporting ? "Preparing ZIP…" : `Download ${hasFilters ? "these" : "all"} ${totalCount} (ZIP)`}
            </button>
          )}
        </div>
        <div className="list-filters">
          <input className="input" type="search" placeholder="Search name, email, ID or programme" value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Search certificates" maxLength={100} />
          <Select label="Status" prefix="Status" value={filters.status} options={statusOptions} onChange={(v) => dispatch(setStatusFilter(v))} />
          <Select label="Email" prefix="Email" value={filters.emailStatus} options={emailOptions} onChange={(v) => dispatch(setEmailFilter(v))} />
        </div>
      </div>
      <CertificateTable />
    </section>
  );
}
