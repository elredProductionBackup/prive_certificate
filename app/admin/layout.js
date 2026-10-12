import AdminHeader from "@/components/admin/AdminHeader";
import SessionBootstrap from "@/components/admin/SessionBootstrap";
import "../admin.css";

export const metadata = {
  title: "Admin · Privé Certificates",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return (
    <>
      <SessionBootstrap />
      <AdminHeader />
      {children}
    </>
  );
}
