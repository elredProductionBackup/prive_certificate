import AuthGate from "@/components/admin/AuthGate";

export default function ProtectedLayout({ children }) {
  return <AuthGate>{children}</AuthGate>;
}
