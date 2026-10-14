import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/great-vibes/latin-400.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-500-italic.css";
import "@fontsource/inter/latin-600.css";
import "./globals.css";
import "./range.css";
import "./certificate.css";
import "./verify-mobile.css";
import StoreProvider from "@/store/StoreProvider";
import Toaster from "@/components/common/Toaster";
import { LOGO_URL } from "@/components/common/PublicBar"; // adjust if PublicBar lives elsewhere

export const metadata = {
  title: "Privé Certificate Verification",
  description: "Check that a Privé programme certificate is genuine.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <main>{children}</main>
          <Toaster />
        </StoreProvider>
        <footer className="site-footer">
          <div className="site-footer__inner">
            <div className="site-footer__brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="site-footer__logo"
                src={LOGO_URL}
                alt="Privé"
                height={28}
                style={{ height: 28, width: "auto", maxWidth: 120, display: "block" }}
              />
              <span>
                Questions about a certificate? Write to{" "}
                <a href="mailto:members@theprive.network">Member Relations at Privé</a>.
              </span>
            </div>
            <span className="site-footer__copy">
              &copy; {new Date().getFullYear()} Privé. All rights reserved.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}