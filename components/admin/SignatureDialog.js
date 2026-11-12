"use client";
// Add or replace a signature: draw it, upload a picture of it, or type it.
// Whatever the source, the result is a trimmed transparent PNG (lib/signatures.js)
// that the certificate canvas draws.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { INK_COLOURS, prepareSignature, readFileAsImage, renderTypedSignature } from "@/lib/signatures";
import { LIMITS } from "@/lib/site";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const PAD_W = 900; // drawing pad, logical units (shown at any width, 3:1)
const PAD_H = 300;
const PAD_RES = 2; // backing pixels per unit, sharp on retina screens

/* ------------------------------------------------------------------ Draw */

function DrawPad({ colour, onChange }) {
  const ref = useRef(null);
  const strokes = useRef([]); // [{ colour, points: [{ x, y, w }] }]
  const active = useRef(null);
  const [count, setCount] = useState(0);

  const paint = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(PAD_RES, 0, 0, PAD_RES, 0, 0);
    ctx.clearRect(0, 0, PAD_W, PAD_H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      const p = s.points;
      ctx.strokeStyle = s.colour;
      ctx.fillStyle = s.colour;
      if (p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0].x, p[0].y, p[0].w / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // Smooth curve through the midpoints; each piece takes its own width
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1];
        const b = p[i];
        const start = i === 1 ? a : { x: (p[i - 2].x + a.x) / 2, y: (p[i - 2].y + a.y) / 2 };
        const end = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.lineWidth = (a.w + b.w) / 2;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(a.x, a.y, end.x, end.y);
        if (i === p.length - 1) ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }, []);

  // Recolour what's already drawn when the ink changes
  useEffect(() => {
    strokes.current.forEach((s) => { s.colour = colour; });
    paint();
  }, [colour, paint]);

  const report = () => {
    setCount(strokes.current.length);
    onChange(strokes.current.length ? ref.current : null);
  };

  const toPad = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAD_W, y: ((e.clientY - r.top) / r.height) * PAD_H };
  };

  function down(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    const pt = toPad(e);
    const stroke = { colour, points: [{ ...pt, w: 4.6 }] };
    strokes.current.push(stroke);
    active.current = { stroke, last: pt, t: e.timeStamp, w: 4.6 };
    paint();
  }

  function move(e) {
    const a = active.current;
    if (!a) return;
    const events = e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent];
    for (const ev of events) {
      const pt = toPad(ev);
      const dist = Math.hypot(pt.x - a.last.x, pt.y - a.last.y);
      if (dist < 1.2) continue;
      // Pens report pressure; for a mouse or finger, faster strokes draw thinner
      const dt = Math.max(1, ev.timeStamp - a.t);
      const target = ev.pointerType === "pen" && ev.pressure > 0
        ? 2 + ev.pressure * 6
        : Math.min(6, Math.max(2.4, 6.4 - (dist / dt) * 1.6));
      a.w = a.w * 0.7 + target * 0.3;
      a.stroke.points.push({ ...pt, w: a.w });
      a.last = pt;
      a.t = ev.timeStamp;
    }
    paint();
  }

  function up() {
    if (!active.current) return;
    active.current = null;
    report();
  }

  function undo() { strokes.current.pop(); paint(); report(); }
  function clear() { strokes.current = []; paint(); report(); }

  return (
    <div className="sigpad">
      <div className="sigpad__surface">
        <canvas
          ref={ref}
          width={PAD_W * PAD_RES}
          height={PAD_H * PAD_RES}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Signature pad. Draw with a mouse, finger or pen."
        />
        <span className="sigpad__guide" aria-hidden="true" />
        {count === 0 && <span className="sigpad__placeholder" aria-hidden="true">Sign here</span>}
      </div>
      <div className="sigpad__tools">
        <button type="button" className="btn btn--ghost btn--sm" onClick={undo} disabled={!count}>Undo</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={clear} disabled={!count}>Clear</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Dialog */

function InkPicker({ value, onChange }) {
  return (
    <div className="ink" role="radiogroup" aria-label="Ink colour">
      {INK_COLOURS.map((c) => (
        <button key={c.key} type="button" role="radio" aria-checked={value === c.value}
          className="ink__swatch" style={{ "--ink": c.value }} onClick={() => onChange(c.value)}>
          <span aria-hidden="true" />{c.label}
        </button>
      ))}
    </div>
  );
}

/**
 * props:
 *   initial  { name, title } when replacing; null when adding
 *   onSave({ image, aspect, name, title })
 *   onClose()
 */
export default function SignatureDialog({ initial, onSave, onClose, namePlaceholder = "" }) {
  const ids = useId();
  const dialogRef = useRef(null);
  const pressedOnBackdrop = useRef(false);
  const fileRef = useRef(null);

  const [tab, setTab] = useState("upload"); // signatures usually arrive as an image file
  const [colour, setColour] = useState(INK_COLOURS[0].value);
  const [drawn, setDrawn] = useState(null); // pad canvas once something is drawn
  const [upload, setUpload] = useState(null); // { img, fileName }
  const [removeBg, setRemoveBg] = useState(true);
  const [uploadResult, setUploadResult] = useState(null); // { image, aspect } preview of the cleaned upload
  const [typed, setTyped] = useState("");
  const [name, setName] = useState(initial?.name || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Open as a modal. No close() on cleanup: React's dev double-mount would fire
  // a "close" event and shut the dialog straight away. Unmounting removes it anyway.
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Clean up the uploaded picture whenever it or the background option changes
  useEffect(() => {
    if (!upload) { setUploadResult(null); return; }
    try {
      setUploadResult(prepareSignature(upload.img, { removeBackground: removeBg }));
      setError("");
    } catch (err) {
      setUploadResult(null);
      setError(err.message);
    }
  }, [upload, removeBg]);

  async function pickFile(file) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("Choose a PNG, JPEG or WebP image.");
    if (file.size > MAX_BYTES) return setError("That image is over 8 MB. Choose a smaller one.");
    try {
      const img = await readFileAsImage(file);
      setUpload({ img, fileName: file.name });
      // A PNG that already has transparency doesn't need its background removed
      setRemoveBg(file.type !== "image/png" || !hasTransparency(img));
    } catch (err) {
      setError(err.message);
    }
  }

  const ready = tab === "draw" ? !!drawn : tab === "upload" ? !!uploadResult : !!typed.trim();

  async function save() {
    setError("");
    setBusy(true);
    try {
      let result;
      if (tab === "draw") result = prepareSignature(drawn, { removeBackground: false });
      else if (tab === "upload") result = uploadResult;
      else result = prepareSignature(await renderTypedSignature(typed.trim(), colour), { removeBackground: false });
      if (!result) throw new Error("Add a signature first.");
      onSave({ ...result, name: name.trim(), title: title.trim() });
    } catch (err) {
      setError(err.message || "Couldn't use that signature.");
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal modal--narrow"
      onClose={onClose}
      onPointerDown={(e) => { pressedOnBackdrop.current = e.target === dialogRef.current; }}
      onClick={(e) => { if (e.target === dialogRef.current && pressedOnBackdrop.current) onClose(); }}
      aria-labelledby={`${ids}-title`}
    >
      <div className="modal__body">
        <div className="modal__head">
          <div>
            <h2 id={`${ids}-title`} style={{ margin: 0 }}>{initial ? "Replace signature" : "Add a signature"}</h2>
            <p className="hint" style={{ margin: "4px 0 0" }}>It&rsquo;s printed on every certificate you issue until you remove it.</p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="segmented" role="group" aria-label="How to add the signature">
          {[["upload", "Upload image"], ["draw", "Draw"], ["type", "Type"]].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={tab === key}
              onClick={() => { setTab(key); setError(""); }}>
              {label}
            </button>
          ))}
        </div>

        {/* Tabs stay mounted (just hidden) so switching doesn't lose a drawing */}
        <div className="sig-tab" hidden={tab !== "draw"}>
          <DrawPad colour={colour} onChange={setDrawn} />
          <InkPicker value={colour} onChange={setColour} />
        </div>

        <div className="sig-tab" hidden={tab !== "upload"}>
          <div
            className="sig-drop"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("is-over"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("is-over")}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("is-over"); pickFile(e.dataTransfer.files?.[0]); }}
          >
            {uploadResult ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={uploadResult.image} alt="Your signature, cleaned up" className="sig-drop__img" />
            ) : (
              <span className="hint">Drop a photo or scan of the signature here</span>
            )}
            <input ref={fileRef} type="file" accept={TYPES.join(",")} hidden
              onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
              {upload ? "Choose another image" : "Choose an image"}
            </button>
          </div>
          {upload && (
            <label className="check">
              <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
              <span>Remove the paper background <span className="muted">(for photos and scans on white paper)</span></span>
            </label>
          )}
          <span className="hint">PNG, JPEG or WebP up to 8 MB. Dark ink on plain paper works best; it&rsquo;s cropped to the signature.</span>
        </div>

        <div className="sig-tab" hidden={tab !== "type"}>
          <input className="input" value={typed} maxLength={40} onChange={(e) => setTyped(e.target.value)}
            placeholder="Type the name to sign" aria-label="Name to sign" />
          <div className="sig-typed" style={{ color: colour }} aria-hidden="true">{typed.trim() || "\u00a0"}</div>
          <InkPicker value={colour} onChange={setColour} />
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor={`${ids}-name`}>Name under the line <span className="muted">(optional)</span></label>
            <input id={`${ids}-name`} className="input" value={name} maxLength={LIMITS.speakerName}
              onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder} />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-title`}>Title <span className="muted">(optional)</span></label>
            <input id={`${ids}-title`} className="input" value={title} maxLength={LIMITS.speakerTitle}
              onChange={(e) => setTitle(e.target.value)} placeholder="Programme Director" />
          </div>
        </div>

        {error && <p className="alert alert--error" role="alert" style={{ margin: 0 }}>{error}</p>}

        <div className="modal__actions">
          <button type="button" className="btn" onClick={save} disabled={!ready || busy}>
            {initial ? "Use this signature" : "Add to certificate"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
}

function hasTransparency(img) {
  const c = document.createElement("canvas");
  const w = (c.width = Math.min(200, img.naturalWidth || img.width));
  const h = (c.height = Math.min(200, img.naturalHeight || img.height));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
}
