// Signatures printed on the certificate.
//
// There's no API field for signatures: they're drawn straight onto the canvas,
// so they live inside the issued PNG like the rest of the artwork. Each one is
// kept as a trimmed, transparent PNG data URL plus a few layout numbers:
//
//   { id, image, aspect, name, title, size, line, x, y }
//
//   image   data:image/png;base64,…  (ink only, transparent background, cropped tight)
//   aspect  image width ÷ height
//   name    optional, printed under the line (e.g. "Dr. Anil Lamba")
//   title   optional, printed under the name (e.g. "Programme Director")
//   size    height of the signature image, in cqw (1% of the certificate width)
//   line    draw the signing line under the signature
//   x, y    centre of the signing line, in cqw. null = placed automatically
//           (see autoSlots in certificateCanvas.js); dragging on the preview
//           sets them.

export const MAX_SIGNATURES = 3;
export const SIGNATURE_SIZE = { min: 2.5, max: 7, default: 4.2 }; // cqw
export const INK_COLOURS = [
  { key: "black", label: "Black", value: "#1f1f1f" },
  { key: "blue", label: "Blue", value: "#1d3a8a" },
];

// Stored images are capped at this many pixels tall: the largest signature is
// 7cqw ≈ 160px on the 2267px certificate, so this stays sharp with room to spare.
const MAX_H = 260;
const MAX_W = 1100;

/* ---------------------------------------------------------------- images */

export function loadImageFromUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be opened. Try a PNG or JPEG."));
    img.src = src;
  });
}

export function readFileAsImage(file) {
  const url = URL.createObjectURL(file);
  return loadImageFromUrl(url).finally(() => URL.revokeObjectURL(url));
}

/**
 * Turns a drawn, typed or uploaded signature into the stored form: optionally
 * makes a white/paper background transparent, crops to the ink, and scales it
 * down. Returns { image, aspect } or throws if nothing is left.
 *
 * source: an <img> or <canvas>.
 */
export function prepareSignature(source, { removeBackground = true } = {}) {
  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  if (!sw || !sh) throw new Error("That image is empty.");

  // Work at a sensible size: big photos of a signature are scaled down first.
  const pre = Math.min(1, 2000 / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * pre));
  const h = Math.max(1, Math.round(sh * pre));
  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  if (removeBackground) {
    // Light pixels fade out, dark ink stays. A soft ramp keeps the edges smooth
    // on photos and scans where the paper isn't pure white.
    const paper = estimatePaper(px);
    const hi = Math.min(250, paper - 12); // at or above: fully transparent
    const lo = Math.max(60, hi - 70);     // at or below: fully opaque
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const keep = lum <= lo ? 1 : lum >= hi ? 0 : (hi - lum) / (hi - lo);
      px[i + 3] = Math.round(px[i + 3] * keep);
    }
    ctx.putImageData(data, 0, 0);
  }

  // Crop to the ink
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("No signature found. Draw or upload one with dark ink.");

  const pad = 2;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  const scale = Math.min(1, MAX_H / ch, MAX_W / cw);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  const octx = out.getContext("2d");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(work, x0, y0, cw, ch, 0, 0, out.width, out.height);

  return { image: out.toDataURL("image/png"), aspect: out.width / out.height };
}

// Paper brightness: the 90th-percentile luminance (most of a signature photo is paper).
function estimatePaper(px) {
  const hist = new Uint32Array(256);
  let n = 0;
  const step = Math.max(4, Math.floor(px.length / 4 / 40000) * 4); // sample ~40k pixels
  for (let i = 0; i < px.length; i += step) {
    if (px[i + 3] < 16) continue;
    hist[Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])]++;
    n++;
  }
  if (!n) return 255;
  let acc = 0;
  for (let l = 0; l < 256; l++) { acc += hist[l]; if (acc >= n * 0.9) return Math.max(l, 150); }
  return 255;
}

/** Renders typed text in the script font, ready for prepareSignature. */
export async function renderTypedSignature(text, colour) {
  const family = '"Great Vibes", cursive';
  const size = 140;
  if (document.fonts?.load) await document.fonts.load(`400 ${size}px ${family}`, text).catch(() => null);
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `400 ${size}px ${family}`;
  const w = Math.ceil(measure.measureText(text).width) + size; // script tails run past the advance width
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = Math.round(size * 1.8);
  const ctx = canvas.getContext("2d");
  ctx.font = `400 ${size}px ${family}`;
  ctx.fillStyle = colour;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, size / 2, Math.round(size * 1.2));
  return canvas;
}

/* ----------------------------------------------------------- persistence */
// Kept in this browser so a reload doesn't lose them. Cleared on sign-out
// (store/listeners.js), so the next admin on a shared computer starts empty.

const STORAGE_KEY = "prive.certPortal.signatures";

export function loadSignatures() {
  if (typeof window === "undefined") return [];
  try {
    const list = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(list)
      ? list.filter((s) => s && typeof s.image === "string" && s.image.startsWith("data:image/")).slice(0, MAX_SIGNATURES)
      : [];
  } catch {
    return [];
  }
}

export function saveSignatures(list) {
  try {
    if (list.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage full or blocked: they still work for this visit */ }
}

export function clearSignatures() {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
}

/**
 * The speaker can sign instead of being typed in: when the Speaker field is
 * empty, the first signature with a name stands in for the speaker (its title
 * fills an empty Speaker's title). The API still gets a speakerName for the
 * verify page and LinkedIn, and the certificate prints the name only once,
 * under the signature.
 */
export function withSignatureSpeaker(fields, signatures) {
  if (String(fields.speakerName || "").trim()) return fields;
  const signer = (signatures || []).find((s) => String(s.name || "").trim());
  if (!signer) return fields;
  return {
    ...fields,
    speakerName: signer.name.trim(),
    speakerTitle: String(fields.speakerTitle || "").trim() || String(signer.title || "").trim(),
  };
}
