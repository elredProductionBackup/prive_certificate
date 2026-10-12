"use client";
import { useEffect, useRef } from "react";
import Certificate from "@/components/certificate/Certificate";

// Placeholder certificate for the home page. No real programme or person.
const SAMPLE = {
  certificateId: "PRV-2026-XXXX-XXXX",
  header: "prive",
  recipientName: "Recipient Name",
  programTitle: "Sample Programme Title",
  speakerName: "Speaker Name",
  speakerTitle: "Designation, Organisation",
  citation: "for active participation and engagement throughout the programme",
  eventDate: "2026-01-15",
  location: "City, Country",
  // Fixed so the server and browser draw the same QR code
  verifyUrl: "https://certificate.theprive.network/verify/PRV-2026-XXXX-XXXX",
};

export default function HeroCertificate() {
  const stageRef = useRef(null);
  const cardRef = useRef(null);

  // Gentle tilt that follows the pointer. Off for touch screens and reduced motion.
  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;

    let frame = 0;
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="hc" ref={stageRef} aria-hidden="true">
      <div className="hc__card" ref={cardRef}>
        <div className="hc__sheet">
          <Certificate cert={SAMPLE} />
          <span className="hc__mark hc__mark--id" />
          <span className="hc__mark hc__mark--qr" />
        </div>

        <div className="hc__result">
          <span className="hc__result-icon">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7.4l2.6 2.6L11 4.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span>
            <b>Genuine certificate</b>
            <small>Matches Privé&rsquo;s records</small>
          </span>
        </div>
      </div>

      <div className="hc__legend">
        <span><i className="hc__dot" /> Certificate ID, bottom left</span>
        <span><i className="hc__dot" /> QR code, bottom right</span>
      </div>
    </div>
  );
}
