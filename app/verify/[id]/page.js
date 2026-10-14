"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import PublicBar from "@/components/common/PublicBar";
import Seal from "@/components/verify/Seal";
import VerifyForm from "@/components/verify/VerifyForm";
import Certificate from "@/components/certificate/Certificate";
import ResultActions, { CopyId } from "@/components/verify/ResultActions";
import { lookupCertificate } from "@/store/slices/verifySlice";
import { formatCheckedAt, formatLongDate, linkedInAddUrl, verifyLink } from "@/lib/site";

// Overlaps shrink on phones so the dark hero band isn't mostly empty space.
const OVERLAP = {
  checking: "clamp(24px, 6vw, 40px)",
  missing: "clamp(48px, 12vw, 96px)",
  result: "clamp(56px, 16vw, 150px)",
};

export default function VerifyPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id || "")).trim();
  const dispatch = useDispatch();
  const verify = useSelector((s) => s.verify);

  // track=1 once per visit so it counts toward "Checked N times"
  useEffect(() => {
    if (id) dispatch(lookupCertificate({ id, track: true }));
  }, [id, dispatch]);

  const current = verify.id === id;
  const status = current ? verify.status : "loading";

  /* ---------- checking ---------- */
  if (status === "loading" || status === "idle") {
    return (
      <section className="v-band" style={{ "--overlap": OVERLAP.checking }}>
        <PublicBar />
        <div className="v-hero">
          <div className="checking" role="status" aria-live="polite">
            <span className="spinner" />
            <h1>
              Checking <span className="v-id">{id.toUpperCase()}</span>
            </h1>
          </div>
        </div>
      </section>
    );
  }

  /* ---------- not found / service down ---------- */
  if (status !== "found") {
    const notFound = status === "not-found";
    const copy = notFound
      ? { kicker: "Not found", title: "No certificate matches this ID" }
      : { kicker: "Check unavailable", title: "We couldn't reach Privé's records" };
    return (
      <>
        <section className="v-band" style={{ "--overlap": OVERLAP.missing }}>
          <PublicBar />
          <div className="v-hero">
            <div className="verdict">
              <Seal tone="unknown" label={copy.kicker} />
              <div className="verdict__body">
                <span className="verdict__kicker verdict__kicker--unknown"><i />{copy.kicker}</span>
                <h1>{copy.title}</h1>
                <p>
                  {notFound ? (
                    <>There is no Privé certificate with the ID <strong className="v-id">{id.toUpperCase()}</strong>. Check each character against the certificate and try again. If it still isn&rsquo;t found, the certificate was not issued by Privé.</>
                  ) : (
                    <>The verification service didn&rsquo;t respond. Try again in a minute.</>
                  )}
                </p>
                {!notFound && (
                  <button type="button" className="btn btn--on-dark" onClick={() => dispatch(lookupCertificate({ id, track: true }))}>
                    Try again
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
        <div className="v-after" style={{ "--overlap": OVERLAP.missing }}>
          <div className="plate rise">
            <div className="plate__inner"><VerifyForm initial={id} /></div>
          </div>
        </div>
      </>
    );
  }

  /* ---------- genuine or revoked ---------- */
  const { result } = verify;
  const c = result.certificate;
  const ok = !!result.valid;
  const link = verifyLink(c.certificateId);

  return (
    <>
      <section className="v-band" style={{ "--overlap": OVERLAP.result }}>
        <PublicBar />
        <div className="v-hero">
          <div className="verdict">
            <Seal tone={ok ? "valid" : "revoked"} label={ok ? "Verified" : "Revoked"} />
            <div className="verdict__body">
              <span className={`verdict__kicker verdict__kicker--${ok ? "valid" : "revoked"}`}>
                <i />{ok ? "Verified by Privé" : "Revoked by Privé"}
              </span>
              <h1>{ok ? "This certificate is genuine" : "This certificate has been revoked"}</h1>
              {ok ? (
                <p>Privé awarded this certificate to <strong>{c.recipientName}</strong> for {c.programTitle} with {c.speakerName}, held on {formatLongDate(c.eventDate)}.</p>
              ) : (
                <p>Privé has withdrawn this certificate. It should not be accepted as proof that <strong>{c.recipientName}</strong> completed the programme.</p>
              )}
              <p className="verdict__time">Checked against Privé&rsquo;s records on {formatCheckedAt(result.checkedAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="result" style={{ "--overlap": OVERLAP.result }}>
        <div className="result__sheet rise print-area">
          {ok && c.certificateImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className="result__img"
              src={c.certificateImageUrl}
              alt={`Certificate awarded to ${c.recipientName}`}
              decoding="async"
            />
          ) : (
            <Certificate cert={c} revoked={!ok} />
          )}
        </div>

        <aside className="result__side rise" style={{ animationDelay: ".4s" }} aria-label="Certificate details">
          <div className="result__side-head"><h2>Certificate details</h2></div>
          <dl className="ledger">
            <div><dt>Awarded to</dt><dd>{c.recipientName}</dd></div>
            <div><dt>Programme</dt><dd>{c.programTitle}</dd></div>
            <div><dt>Led by</dt><dd>{c.speakerName}{c.speakerTitle && <><br /><span className="muted small">{c.speakerTitle}</span></>}</dd></div>
            <div><dt>Held on</dt><dd>{formatLongDate(c.eventDate)}{c.location && <><br /><span className="muted small">{c.location}</span></>}</dd></div>
            <div><dt>Issued by</dt><dd>Privé</dd></div>
            <div><dt>Certificate ID</dt><CopyId id={c.certificateId} /></div>
          </dl>
          {ok ? (
            <ResultActions id={c.certificateId} verifyLink={link} linkedInUrl={linkedInAddUrl(c, link)} />
          ) : (
            <p className="result__note">Downloads are switched off for revoked certificates.</p>
          )}
        </aside>
      </div>
    </>
  );
}