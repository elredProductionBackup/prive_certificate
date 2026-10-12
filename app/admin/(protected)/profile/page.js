"use client";
import Link from "next/link";
import ProfileForm from "@/components/admin/ProfileForm";

export default function ProfilePage() {
  return (
    <div className="wrap wrap--form">
      <Link href="/admin" className="back-link">Back to certificates</Link>
      <h1>Your profile</h1>
      <p className="lede">Your name and photo appear in the portal header.</p>
      <div className="panel" style={{ marginTop: 28 }}>
        <ProfileForm />
      </div>
    </div>
  );
}
