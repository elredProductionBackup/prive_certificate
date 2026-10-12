"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { LOGO_URL } from "@/components/common/PublicBar";
import Avatar from "@/components/common/Avatar";
import { signOut } from "@/store/slices/authSlice";

export default function AdminHeader() {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { status, admin } = useSelector((s) => s.auth);
  const step = useSelector((s) => s.otp.step);
  const showUser = status === "authenticated" && admin && !(pathname === "/admin/login" && step === "profile");

  function onSignOut() {
    dispatch(signOut()); // no API call: the token is simply forgotten
    router.replace("/admin/login");
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__row">
          <div className="site-header__brand">
            <Link href="/admin" aria-label="Certificates">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="logo" src={LOGO_URL} alt="Privé" />
            </Link>
            <span className="admin-tag">Admin</span>
          </div>
          <nav aria-label="Admin" className="admin-nav">
            <a className="ext" href="/" target="_blank" rel="noopener noreferrer">Open verification page</a>
            {showUser && (
              <>
                <Link href="/admin/profile" className="who" aria-current={pathname === "/admin/profile" ? "page" : undefined}>
                  <Avatar admin={admin} size={30} />
                  <span className="who__text">
                    <span className="who__label">Signed in as</span>
                    <span className="who__name">{admin.name || admin.email}</span>
                  </span>
                </Link>
                <button type="button" className="header-btn" onClick={onSignOut}>Sign out</button>
              </>
            )}
          </nav>
        </div>
        <div className="site-header__rule" />
      </div>
    </header>
  );
}
