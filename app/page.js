import Link from "next/link";
import VerifyForm from "@/components/verify/VerifyForm";
import HeroCertificate from "@/components/home/HeroCertificate";
import Faq from "@/components/home/Faq";
import "./home.css";

const Icon = {
  bolt: <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 2L4 11h5l-1 7 7-9h-5l1-7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>,
  shield: <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5l6 2.2v4.6c0 4-2.6 6.9-6 8.2-3.4-1.3-6-4.2-6-8.2V4.7l6-2.2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7.3 10l1.9 1.9 3.6-3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  user: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M4 17c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
};

export default function Home() {
  return (
    <div className="home">
      <header className="h-nav">
        <div className="h-nav__inner">
          <Link href="/" className="h-brand" aria-label="Privé certificate verification">
            <span className="h-brand__word">Privé</span>
            <span className="h-brand__sub">Certificate verification</span>
          </Link>
          <a href="#how" className="h-nav__link">How it works</a>
        </div>
      </header>

      <section className="h-hero">
        <div className="h-hero__copy">
          <h1 className="h-in" style={{ "--d": "0ms" }}>Verify a Privé certificate</h1>
          <p className="h-hero__lede h-in" style={{ "--d": "80ms" }}>
            Enter the certificate ID to see who it was awarded to, which programme it covers, and whether it&rsquo;s still valid.
          </p>

          <div className="h-card h-in" style={{ "--d": "160ms" }}>
            <VerifyForm autoFocus />
          </div>

          <ul className="h-trust h-in" style={{ "--d": "240ms" }}>
            <li>{Icon.bolt} Result in seconds</li>
            <li>{Icon.shield} Checked against Privé&rsquo;s records</li>
            <li>{Icon.user} No account needed</li>
          </ul>
        </div>

        <div className="h-hero__visual">
          <HeroCertificate />
        </div>
      </section>

      <section id="how" className="h-steps" aria-labelledby="how-title">
        <div className="h-section-head">
          <h2 id="how-title">How it works</h2>
          <p>Three steps, no sign-up.</p>
        </div>

        <ol className="h-steps__grid">
          <li className="step">
            <div className="step__visual">
              <span className="step__id">PRV-2026-7K3Q-9XMD</span>
            </div>
            <span className="step__num">1</span>
            <h3>Find the ID</h3>
            <p>It&rsquo;s printed in the bottom-left corner of the certificate and starts with PRV.</p>
          </li>
          <li className="step">
            <div className="step__visual">
              <svg className="step__qr" viewBox="0 0 21 21" aria-hidden="true">
                <path fill="currentColor" d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zm1 1v5h5V1zm1 1h3v3h-3zM0 14h7v7H0zm1 1v5h5v-5zm1 1h3v3H2zM9 0h2v2H9zm2 2h1v3h-1zM8 4h2v2H8zm0 4h3v1H8zM12 8h2v2h-2zm3 0h2v1h-2zm3 0h3v2h-3zM9 10h2v2H9zm4 2h3v1h-3zm4 0h1v4h-1zm2 2h2v2h-2zM9 14h2v3H9zm3 1h3v2h-3zm-3 4h2v2H9zm4 0h4v2h-4zm6 0h2v2h-2zM0 8h2v2H0zm3 1h3v2H3zm11 5h2v1h-2z" />
              </svg>
              <span className="step__or">or type it in</span>
            </div>
            <span className="step__num">2</span>
            <h3>Enter it or scan the QR code</h3>
            <p>Type or paste the ID above. Scanning the QR code in the bottom-right corner opens the check directly.</p>
          </li>
          <li className="step">
            <div className="step__visual step__visual--pills">
              <span className="pill pill--ok">Genuine</span>
              <span className="pill pill--bad">Revoked</span>
              <span className="pill pill--none">Not found</span>
            </div>
            <span className="step__num">3</span>
            <h3>Read the result</h3>
            <p>You&rsquo;ll see the details on record and whether the certificate is genuine, revoked, or not issued by Privé.</p>
          </li>
        </ol>
      </section>

      <section className="h-faq" aria-labelledby="faq-title">
        <div className="h-section-head">
          <h2 id="faq-title">Questions</h2>
          <p>About checking a certificate.</p>
        </div>
        <Faq />
      </section>
    </div>
  );
}
