"use client";
// Live preview drawn with the same canvas code that makes the issued PNG,
// so what the admin sees is exactly what gets sent.
import { useEffect, useRef } from "react";
import { CERT_H, CERT_W, drawCertificate, ensureFonts } from "@/lib/certificateCanvas";

const SCALE = 0.6; // sharp on retina screens at the preview's size, quick to redraw

export default function CertificatePreview({ cert }) {
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawCertificate(ctx, cert);
    };
    frame = requestAnimationFrame(draw);
    ensureFonts().then(() => { if (!cancelled) frame = requestAnimationFrame(draw); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [cert]);

  return (
    <canvas
      ref={ref}
      className="cert-canvas"
      width={Math.round(CERT_W * SCALE)}
      height={Math.round(CERT_H * SCALE)}
      role="img"
      aria-label={`Preview of the certificate for ${cert.recipientName || "the recipient"}`}
    />
  );
}
