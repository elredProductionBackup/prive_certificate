"use client";
// Live preview drawn with the same canvas code that makes the issued PNG,
// so what the admin sees is exactly what gets sent.
//
// With `onMoveSignature`, signatures on the preview can be dragged (mouse,
// touch or pen) and nudged with the arrow keys. Positions are stored in cqw,
// so the preview's size doesn't matter.
import { useEffect, useRef, useState } from "react";
import {
  CERT_H, CERT_W, clampSignatureAnchor, drawCertificate, ensureFonts, ensureSignatureImages, toCqw,
} from "@/lib/certificateCanvas";

const SCALE = 0.6; // sharp on retina screens at the preview's size, quick to redraw
const HIT_PAD = 14; // px at full size, a little grace around each signature
const round = (n) => Math.round(n * 100) / 100;

export default function CertificatePreview({ cert, selectedSignatureId = null, onSelectSignature, onMoveSignature, onOverlapChange }) {
  const ref = useRef(null);
  const boxes = useRef([]); // signature boxes from the last draw (full-size px)
  const drag = useRef(null);
  const pending = useRef(null);
  const raf = useRef(0);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const overlapCb = useRef(onOverlapChange);
  overlapCb.current = onOverlapChange;
  const interactive = !!onMoveSignature;
  const hasSignatures = (cert.signatures?.length || 0) > 0;

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const draw = () => {
      const canvas = ref.current;
      if (!canvas || cancelled) return;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      const result = drawCertificate(ctx, cert);
      boxes.current = result?.signatures || [];
      if (interactive) drawSelection(ctx, boxes.current, selectedSignatureId);
      overlapCb.current?.(!!result?.overlap);
    };
    frame = requestAnimationFrame(draw);
    Promise.all([ensureFonts(), ensureSignatureImages(cert.signatures)])
      .then(() => { if (!cancelled) frame = requestAnimationFrame(draw); });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [cert, selectedSignatureId, interactive]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Pointer position in full-size certificate px
  const toCert = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CERT_W, y: ((e.clientY - r.top) / r.height) * CERT_H };
  };

  const hitTest = (pt) => {
    for (let i = boxes.current.length - 1; i >= 0; i--) {
      const b = boxes.current[i];
      if (pt.x >= b.x0 - HIT_PAD && pt.x <= b.x1 + HIT_PAD && pt.y >= b.y0 - HIT_PAD && pt.y <= b.y1 + HIT_PAD) return b;
    }
    return null;
  };

  // Send at most one move per frame, so dragging stays smooth
  const queueMove = (id, x, y) => {
    pending.current = { id, x, y };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const p = pending.current;
      pending.current = null;
      if (p) onMoveSignature(p.id, { x: round(toCqw(p.x)), y: round(toCqw(p.y)) });
    });
  };

  function onPointerDown(e) {
    if (!interactive || (e.pointerType === "mouse" && e.button !== 0)) return;
    const pt = toCert(e);
    const box = hitTest(pt);
    if (!box) { onSelectSignature?.(null); return; }
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    ref.current.focus({ preventScroll: true });
    onSelectSignature?.(box.id);
    drag.current = { id: box.id, dx: pt.x - box.ax, dy: pt.y - box.ay, metrics: box.metrics };
    setDragging(true);
  }

  function onPointerMove(e) {
    if (!interactive) return;
    const pt = toCert(e);
    const d = drag.current;
    if (!d) { setHover(!!hitTest(pt)); return; }
    const { x, y } = clampSignatureAnchor(d.metrics, pt.x - d.dx, pt.y - d.dy);
    queueMove(d.id, x, y);
  }

  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(e) {
    if (!interactive || !hasSignatures) return;
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step) return;
    const box = boxes.current.find((b) => b.id === selectedSignatureId) || boxes.current[0];
    if (!box) return;
    e.preventDefault();
    const by = (e.shiftKey ? 1 : 0.2) * (CERT_W / 100); // 0.2cqw, or 1cqw with Shift
    const { x, y } = clampSignatureAnchor(box.metrics, box.ax + step[0] * by, box.ay + step[1] * by);
    if (box.id !== selectedSignatureId) onSelectSignature?.(box.id);
    onMoveSignature(box.id, { x: round(toCqw(x)), y: round(toCqw(y)) });
  }

  return (
    <canvas
      ref={ref}
      className={`cert-canvas${interactive && hasSignatures ? " cert-canvas--editable" : ""}`}
      style={interactive ? { cursor: dragging ? "grabbing" : hover ? "grab" : undefined, touchAction: hasSignatures ? "none" : undefined } : undefined}
      width={Math.round(CERT_W * SCALE)}
      height={Math.round(CERT_H * SCALE)}
      role="img"
      tabIndex={interactive && hasSignatures ? 0 : undefined}
      aria-label={
        `Preview of the certificate for ${cert.recipientName || "the recipient"}` +
        (interactive && hasSignatures ? ". Drag a signature to move it, or use the arrow keys." : "")
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setHover(false)}
      onKeyDown={onKeyDown}
    />
  );
}

// Dashed gold frame around the selected signature. Preview only: the issued
// PNG is drawn by renderCertificatePng, which never calls this.
function drawSelection(ctx, boxes, selectedId) {
  const b = boxes.find((x) => x.id === selectedId);
  if (!b) return;
  const pad = 10;
  ctx.save();
  ctx.strokeStyle = "#bf9028";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(b.x0 - pad, b.y0 - pad, b.x1 - b.x0 + pad * 2, b.y1 - b.y0 + pad * 2);
  ctx.restore();
}
