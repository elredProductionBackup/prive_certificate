"use client";
import Link from "next/link";
import { useSelector } from "react-redux";
import IssueForm from "@/components/admin/IssueForm";
import CertificatesSection from "@/components/admin/CertificatesSection";
import CertificateModal from "@/components/admin/CertificateModal";
import { plural } from "@/lib/site";

export default function CertificatesPage() {
  const stats = useSelector((s) => s.certificates.stats);
  const admin = useSelector((s) => s.auth.admin);

  return (
    <div className="wrap">
      <div className="dash-head">
        <div>
          <h1>Certificates</h1>
          {stats && (
            <p className="lede" style={{ marginTop: 6 }}>
              {stats.issued} issued, {stats.active} active, {stats.revoked} revoked. Checked {plural(stats.verifications, "time")} by the public.
            </p>
          )}
        </div>
      </div>

      {admin && !admin.name && (
        <p className="alert alert--info">
          Add your name so other admins can see who issued what. <Link href="/admin/profile">Set up your profile</Link>
        </p>
      )}

      <div className="panel">
        <IssueForm />
      </div>

      <CertificatesSection />
      <CertificateModal />
    </div>
  );
}
