// Draws the Privé certificate on a <canvas> and exports it as a PNG.
//
// The API docs: "The canvas is drawn in the browser, so the page needs the real
// ID before it draws. Print the ID bottom left and the QR code bottom right.
// Export as PNG." This file is that step.
//
// Every measurement is in cqw (1% of the certificate width), copied from
// app/certificate.css, so the PNG matches the on-screen artwork. Full size is
// the supplied 2267 × 1638 artwork.
import QRCode from "qrcode";
import { formatCertDate, verifyHost } from "./site";
import { SIGNATURE_SIZE } from "./signatures";

export const CERT_W = 2267;
export const CERT_H = 1638;
const U = CERT_W / 100; // 1cqw in px at full size
const px = (cqw) => cqw * U;
/** px at full size -> cqw */
export const toCqw = (pxValue) => pxValue / U;

const LORA = '"Lora", Georgia, "Times New Roman", serif';
const VIBES = '"Great Vibes", cursive';
const INTER = '"Inter", Arial, Helvetica, sans-serif';

// Programme title layout. The admin picks how wide the title can run (as a %
// of the certificate width) with cert.titleWidth; very long titles shrink
// (down to TITLE_MIN_SIZE) rather than spill past TITLE_MAX_LINES.
// max 85 keeps the title well inside the inner frame (which is ~94% wide).
export const TITLE_WIDTH = { min: 40, max: 85, default: 76 };
const TITLE_SIZE = 5.8;    // cqw
const TITLE_MIN_SIZE = 4;  // cqw
const TITLE_LH = 6.75;     // cqw line height at TITLE_SIZE
const TITLE_MAX_LINES = 2;

// Each face used below. They're loaded by @fontsource in app/layout.js;
// document.fonts.load makes sure they're ready before we draw.
const FACES = [
  `700 40px ${LORA}`,
  `400 40px ${LORA}`,
  `italic 400 40px ${LORA}`,
  `400 40px ${VIBES}`,
  `400 40px ${INTER}`,
  `600 40px ${INTER}`,
  `italic 500 40px ${INTER}`,
];

// Brand logos (gold SVG artwork), served from /public/brand. Same-origin files
// keep the canvas exportable. `aspect` is the SVG's width ÷ height, so we
// don't depend on naturalWidth (some browsers report 0 for SVG).
const LOGOS = {
  priveTeam: { src: "/brand/prive-team.svg", aspect: 150 / 29 },
  prive: { src: "/brand/prive.svg", aspect: 90 / 29 },
};
const BRAND_BOX = 4.5;   // cqw, height of the brand row (unchanged from the text version)
const BRAND_LOGO_H = 3.3; // cqw, logo height; raise or lower to resize the logo
const logoImages = {};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // fall back to the text brand
    img.src = src;
  });
}

function loadLogos() {
  if (typeof Image === "undefined") return Promise.resolve();
  return Promise.all(
    Object.entries(LOGOS).map(([key, { src }]) =>
      loadImage(src).then((img) => { if (img) logoImages[key] = img; })
    )
  );
}

function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.all(FACES.map((f) => document.fonts.load(f, "Privé Aa").catch(() => null)))
    .then(() => document.fonts.ready);
}

// Fonts and logos. The preview redraws once this resolves, and the PNG export
// waits for it, so issued certificates always have the logo.
let assetsReady;
export function ensureFonts() {
  if (!assetsReady) assetsReady = Promise.all([loadFonts(), loadLogos()]).then(() => undefined);
  return assetsReady;
}

/* ------------------------------------------------------------------ helpers */

function font(ctx, { size, family, weight = 400, style = "normal" }) {
  ctx.font = `${style} ${weight} ${px(size)}px ${family}`;
}

// Font ascent/descent of the current font, used to place text in a CSS line box.
function fontBox(ctx) {
  const m = ctx.measureText("Hg");
  const sizePx = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] || "16");
  const asc = m.fontBoundingBoxAscent ?? sizePx * 0.95;
  const desc = m.fontBoundingBoxDescent ?? sizePx * 0.27;
  return { asc, desc };
}

// Baseline y for one line of text in a CSS line box that starts at `top` (px)
// and is `lineHeight` (px) tall: half-leading above, then the ascent.
function baselineIn(ctx, top, lineHeight) {
  const { asc, desc } = fontBox(ctx);
  return top + (lineHeight - (asc + desc)) / 2 + asc;
}

// Width with CSS-style letter-spacing (added after every character).
function spacedWidth(ctx, text, spacing) {
  if (!spacing) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w;
}

// Draws text starting at x (left edge) with letter-spacing.
function fillSpaced(ctx, text, x, y, spacing) {
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  if (!spacing) ctx.fillText(text, x, y);
  else {
    let cx = x;
    for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
  }
  ctx.textAlign = prev;
}

// Greedy word wrap, like the browser does for the certificate's centred blocks.
function wrap(ctx, text, maxWidth) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// The gold text gradient from .cert__gold, spanning an element's box (px).
function goldGradient(ctx, top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#e6cf55");
  g.addColorStop(0.45, "#d4b43e");
  g.addColorStop(1, "#bf9028");
  return g;
}

// QR code with no quiet zone (the white certificate is the margin), drawn on
// whole pixels so modules never show seams.
function drawQr(ctx, text, x, y, size) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  ctx.fillStyle = "#3a3a3a";
  for (let r = 0; r < n; r++) {
    const y0 = Math.round(y + r * cell);
    const y1 = Math.round(y + (r + 1) * cell);
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) { c++; continue; }
      const start = c;
      while (c < n && qr.modules.get(r, c)) c++;
      const x0 = Math.round(x + start * cell);
      const x1 = Math.round(x + c * cell);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
}

/* ------------------------------------------------------------------ drawing */

/**
 * Draws the certificate onto ctx at full size (2267 × 1638 units).
 * cert: { header, programTitle, speakerName, speakerTitle, recipientName,
 *         citation, eventDate, location, certificateId, verifyUrl, signatures }
 * opts.placeholderName: shown (greyed) when recipientName is empty, for previews.
 * Returns { signatures: [box], overlap } for the preview: the boxes let it drag
 * signatures, and overlap is true when a signature covers text, the QR code or
 * another signature.
 */
export function drawCertificate(ctx, cert, { placeholderName = "Recipient name" } = {}) {
  const cx = CERT_W / 2;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  // Areas already printed on, so the preview can warn when a signature covers them
  const taken = [];
  const mark = (x0, y0, w, h) => { if (w > 0 && h > 0) taken.push({ x0, y0, x1: x0 + w, y1: y0 + h }); };
  const markCentered = (w, top, h) => mark(cx - w / 2, top, w, h);

  // Paper
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CERT_W, CERT_H);

  // Double rule (.cert__border--outer / --inner): 0.13cqw lines, inset 2.12 / 3.02cqw
  ctx.strokeStyle = "#1f1f1f";
  ctx.lineWidth = px(0.13);
  for (const inset of [2.12, 3.02]) {
    const o = px(inset) + px(0.13) / 2;
    ctx.strokeRect(o, o, CERT_W - 2 * o, CERT_H - 2 * o);
  }

  let y = px(7.3); // .cert__body padding-top

  // Brand: the Privé Team or Privé logo, centred in the brand row
  const logoKey = cert.header === "prive" ? "prive" : "priveTeam";
  const logo = logoImages[logoKey];
  if (logo) {
    const lh = px(BRAND_BOX);
    const h = px(BRAND_LOGO_H);
    const w = h * LOGOS[logoKey].aspect;
    ctx.drawImage(logo, cx - w / 2, y + (lh - h) / 2, w, h);
    markCentered(w, y, lh);
    y += lh;
  } else {
    // Fallback while the logo loads (or if the file is missing): the text brand
    const lh = px(BRAND_BOX);
    font(ctx, { size: 4.5, family: LORA, weight: 700 });
    const nameSpacing = -0.02 * px(4.5);
    const nameW = spacedWidth(ctx, "Privé", nameSpacing);
    const base = baselineIn(ctx, y, lh);
    const team = cert.header !== "prive";
    let teamW = 0;
    if (team) { font(ctx, { size: 3, family: LORA, style: "italic" }); teamW = ctx.measureText("Team").width; }
    const gap = team ? px(1.1) : 0;
    const left = cx - (nameW + gap + teamW) / 2;

    ctx.fillStyle = goldGradient(ctx, y, y + lh);
    font(ctx, { size: 4.5, family: LORA, weight: 700 });
    fillSpaced(ctx, "Privé", left, base, nameSpacing);
    if (team) {
      font(ctx, { size: 3, family: LORA, style: "italic" });
      ctx.textAlign = "left";
      ctx.fillText("Team", left + nameW + gap, base);
      ctx.textAlign = "center";
    }
    y += lh;
  }

  // Programme title: Great Vibes, gold, wraps at the admin's chosen width and
  // never goes past TITLE_MAX_LINES (the font shrinks slightly for very long titles)
  {
    y += px(1.7);
    const pct = Math.min(TITLE_WIDTH.max, Math.max(TITLE_WIDTH.min, Number(cert.titleWidth) || TITLE_WIDTH.default));
    const maxW = px(pct);
    let size = TITLE_SIZE;
    font(ctx, { size, family: VIBES });
    let lines = wrap(ctx, cert.programTitle, maxW);
    while (lines.length > TITLE_MAX_LINES && size > TITLE_MIN_SIZE) {
      size = Math.max(TITLE_MIN_SIZE, size - 0.1);
      font(ctx, { size, family: VIBES });
      lines = wrap(ctx, cert.programTitle, maxW);
    }
    const lh = px(TITLE_LH * (size / TITLE_SIZE));
    const boxBottom = y + lines.length * lh + px(1.2);
    ctx.fillStyle = goldGradient(ctx, y, boxBottom);
    lines.forEach((line, i) => ctx.fillText(line, cx, baselineIn(ctx, y + i * lh, lh)));
    markCentered(Math.max(0, ...lines.map((l) => ctx.measureText(l).width)), y, lines.length * lh);
    y += lines.length * lh; // padding-bottom 1.2 and margin-bottom -1.2 cancel out
  }

  // Speaker
  y += px(3.6);
  font(ctx, { size: 4.3, family: LORA, weight: 700 });
  ctx.fillStyle = "#54585c";
  ctx.fillText(cert.speakerName || "", cx, baselineIn(ctx, y, px(5)));
  markCentered(ctx.measureText(cert.speakerName || "").width, y, px(5));
  y += px(5);

  // Speaker's title
  y += px(0.3);
  font(ctx, { size: 2.05, family: INTER, weight: 500, style: "italic" });
  ctx.fillStyle = "#111111";
  ctx.fillText(cert.speakerTitle || "", cx, baselineIn(ctx, y, px(2.6)));
  markCentered(ctx.measureText(cert.speakerTitle || "").width, y, px(2.6));
  y += px(2.6);

  // "This certificate is proudly presented to"
  y += px(1.4);
  font(ctx, { size: 2.05, family: INTER });
  ctx.fillText("This certificate is proudly presented to", cx, baselineIn(ctx, y, px(2.6)));
  markCentered(ctx.measureText("This certificate is proudly presented to").width, y, px(2.6));
  y += px(2.6);

  // Recipient: shrinks for long names (same rule as the CSS), underlined
  {
    y += px(1.1);
    const name = (cert.recipientName || "").trim();
    const text = name || placeholderName;
    let size = text.length > 24 ? 4.3 * Math.max(0.62, 24 / text.length) : 4.3;
    font(ctx, { size, family: LORA });
    // Never run past the inner frame, whatever the font does
    while (ctx.measureText(text).width > px(80) && size > 1.5) { size -= 0.1; font(ctx, { size, family: LORA }); }
    const base = baselineIn(ctx, y, px(5));
    ctx.fillStyle = name ? "#54585c" : "#b9b4a9";
    ctx.fillText(text, cx, base);
    const w = ctx.measureText(text).width;
    ctx.fillRect(cx - w / 2, base + px(0.55), w, px(0.2));
    markCentered(w, y, px(5));
    y += px(5);
  }

  // Citation: wraps inside 50cqw
  {
    y += px(1.4);
    const lh = px(2);
    font(ctx, { size: 1.85, family: INTER });
    ctx.fillStyle = "#111111";
    const lines = wrap(ctx, cert.citation, px(50));
    lines.forEach((line, i) => ctx.fillText(line, cx, baselineIn(ctx, y + i * lh, lh)));
    markCentered(Math.max(0, ...lines.map((l) => ctx.measureText(l).width)), y, lines.length * lh);
    y += lines.length * lh;
  }

  // Date and location. Centred on their own; with signatures they move to a
  // right-hand column and the signatures take the left (one row, like a
  // classic certificate).
  const hasSignatures = Array.isArray(cert.signatures) && cert.signatures.length > 0;
  y += px(2.8);
  const metaTop = y;
  {
    const lh = px(META_LH);
    const mx = hasSignatures ? px(META_COLUMN_X) : cx;
    font(ctx, { size: 1.85, family: INTER });
    ctx.fillText(formatCertDate(cert.eventDate), mx, baselineIn(ctx, y, lh));
    ctx.fillText(cert.location || "", mx, baselineIn(ctx, y + lh, lh));
    const w = Math.max(ctx.measureText(formatCertDate(cert.eventDate)).width, ctx.measureText(cert.location || "").width);
    mark(mx - w / 2, y, w, 2 * lh);
    y += 2 * lh;
  }

  // Verification strip: ID bottom left, QR bottom right (inside the inner frame)
  if (cert.certificateId) {
    const bottom = CERT_H - px(4.6);
    const lh = px(1.5);
    const top = bottom - 3 * lh;
    const left = px(5);

    font(ctx, { size: 1.05, family: INTER });
    ctx.fillStyle = "#6b6b6b";
    ctx.textAlign = "left";
    ctx.fillText("Certificate ID", left, baselineIn(ctx, top, lh));

    font(ctx, { size: 1.25, family: INTER, weight: 600 });
    ctx.fillStyle = "#3a3a3a";
    fillSpaced(ctx, cert.certificateId, left, baselineIn(ctx, top + lh, lh), 0.04 * px(1.25));

    font(ctx, { size: 1.05, family: INTER });
    ctx.fillStyle = "#6b6b6b";
    const verifyText = `Verify at ${verifyHost(cert.verifyUrl, cert.certificateId)}`;
    ctx.fillText(verifyText, left, baselineIn(ctx, top + 2 * lh, lh));
    mark(left, top, Math.max(ctx.measureText(verifyText).width, px(14)), 3 * lh);

    const qrSize = px(6.4);
    drawQr(ctx, cert.verifyUrl || cert.certificateId, CERT_W - px(5) - qrSize, bottom - qrSize, qrSize);
    mark(CERT_W - px(5) - qrSize, bottom - qrSize, qrSize, qrSize);
  }

  // Signatures go last so they sit on top of everything else
  const signatures = drawSignatures(ctx, cert.signatures, metaTop);

  ctx.restore();
  return { signatures, overlap: signaturesOverlap(signatures, taken) };
}

// True if a signature covers printed content or another signature. The
// signature's box is trimmed a little so touching edges don't count.
function signaturesOverlap(boxes, taken) {
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const inset = px(0.3);
  const tight = boxes.map((b) => {
    const m = b.metrics;
    const w = Math.max(m.imgW, m.textW, b.line ? m.lineW : 0) / 2;
    return { x0: b.ax - w + inset, x1: b.ax + w - inset, y0: b.y0 + inset, y1: b.y1 - inset };
  });
  return tight.some((t, i) => taken.some((r) => hit(t, r)) || tight.some((o, j) => j > i && hit(t, o)));
}

/* --------------------------------------------------------------- signatures */
// Each signature is an image standing on a signing line, with an optional name
// and title under the line. Its position is the centre of the line, in cqw.
// See lib/signatures.js for the shape of one signature.

const META_LH = 2.45;         // cqw, line height of the date and location
const META_COLUMN_X = 70;     // cqw, centre of the date/location column when there are signatures
const SIG_IMAGE_MAX_W = 28;   // cqw, very wide signatures shrink to fit this
const SIG_LINE_MIN_W = 13;    // cqw
const SIG_SINK = 0.12;        // share of the image that dips below the line, like real ink
const SIG_GAP = 0.45;         // cqw between the line and the name
const SIG_NAME = { size: 1.1, lh: 1.6, spacing: 0.12 }; // spacing in em, the spaced-out name under the line
const SIG_TITLE = { size: 0.98, lh: 1.35 };
const SIG_FRAME = 3.6;        // cqw, keep clear of the inner border (inset 3.02)
const STRIP_TOP = CERT_H - px(4.6) - 3 * px(1.5); // top of the Certificate ID block

// Decoded images, keyed by data URL, so drawing stays synchronous.
const sigImages = new Map();

/** Loads every signature image so drawCertificate can use it. Resolves when all are ready. */
export function ensureSignatureImages(list) {
  const wanted = new Set((list || []).map((s) => s.image).filter(Boolean));
  if (sigImages.size > 8) for (const key of sigImages.keys()) if (!wanted.has(key)) sigImages.delete(key);
  return Promise.all([...wanted].map((src) => {
    let entry = sigImages.get(src);
    if (!entry) {
      entry = { img: null };
      entry.ready = loadImage(src).then((img) => { entry.img = img; });
      sigImages.set(src, entry);
    }
    return entry.ready;
  })).then(() => undefined);
}

const clampSize = (v) => Math.min(SIGNATURE_SIZE.max, Math.max(SIGNATURE_SIZE.min, Number(v) || SIGNATURE_SIZE.default));

// Sizes of one signature block (px), relative to the centre of its line.
function measureSignature(ctx, sig, maxImgW = SIG_IMAGE_MAX_W) {
  const aspect = Number(sig.aspect) > 0 ? Number(sig.aspect) : 3;
  let imgH = px(clampSize(sig.size));
  let imgW = imgH * aspect;
  if (imgW > px(maxImgW)) { imgW = px(maxImgW); imgH = imgW / aspect; }

  const name = String(sig.name || "").trim();
  const title = String(sig.title || "").trim();
  font(ctx, { size: SIG_NAME.size, family: INTER });
  const nameSpacing = SIG_NAME.spacing * px(SIG_NAME.size);
  const nameW = name ? spacedWidth(ctx, name, nameSpacing) - nameSpacing : 0;
  font(ctx, { size: SIG_TITLE.size, family: INTER });
  const titleW = title ? ctx.measureText(title).width : 0;

  const lineW = Math.max(imgW * 1.08, nameW + px(2), titleW + px(2), px(SIG_LINE_MIN_W));
  const below = name || title
    ? px(SIG_GAP) + (name ? px(SIG_NAME.lh) : 0) + (title ? px(SIG_TITLE.lh) : 0)
    : px(0.3);
  return { name, nameW, nameSpacing, title, imgW, imgH, lineW, textW: Math.max(nameW, titleW), width: Math.max(lineW, imgW), above: imgH * (1 - SIG_SINK), below };
}

/** Keeps a signature block inside the inner frame. x, y and the result are px. */
export function clampSignatureAnchor(m, x, y) {
  const minX = px(SIG_FRAME) + m.width / 2;
  const maxX = CERT_W - px(SIG_FRAME) - m.width / 2;
  const minY = px(SIG_FRAME) + m.above;
  const maxY = CERT_H - px(SIG_FRAME) - m.below;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

// Where a signature goes when it hasn't been dragged: side by side on the left,
// level with the date/location column on the right. The line sits between the
// date and the location, so the name under it lines up with the location.
// Returns the anchor and how wide the image may be in that slot.
const SIG_ROW = { left: 12, right: 56 }; // cqw, the span the signatures share

function autoSlot(index, count) {
  if (count === 1) return { x: 30, maxW: 26 };
  const span = SIG_ROW.right - SIG_ROW.left;
  const w = span / count;
  return { x: SIG_ROW.left + w * (index + 0.5), maxW: Math.min(SIG_IMAGE_MAX_W, w - 3) };
}

function autoAnchor(slot, m, metaTop) {
  const lineY = metaTop + px(META_LH) * 1.05;
  // Stay clear of the Certificate ID block underneath
  const y = Math.min(lineY, STRIP_TOP - px(0.8) - m.below);
  return { x: px(slot.x), y };
}

/**
 * Draws the signatures and returns one box per signature, in px:
 * { id, x0, y0, x1, y1, ax, ay, metrics }, where (ax, ay) is the line centre.
 */
function drawSignatures(ctx, list, metaTop) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const boxes = [];
  ctx.save();
  list.forEach((sig, i) => {
    const manual = Number.isFinite(sig.x) && Number.isFinite(sig.y);
    const slot = manual ? null : autoSlot(i, list.length);
    const m = measureSignature(ctx, sig, slot ? slot.maxW : SIG_IMAGE_MAX_W);
    const want = manual ? { x: px(sig.x), y: px(sig.y) } : autoAnchor(slot, m, metaTop);
    const { x: ax, y: ay } = clampSignatureAnchor(m, want.x, want.y);

    const img = sigImages.get(sig.image)?.img;
    if (img) ctx.drawImage(img, ax - m.imgW / 2, ay - m.above, m.imgW, m.imgH);

    if (sig.line !== false) {
      ctx.fillStyle = "#54585c";
      const t = px(0.08);
      ctx.fillRect(ax - m.lineW / 2, ay - t / 2, m.lineW, t);
    }

    ctx.textAlign = "center";
    let ty = ay + px(SIG_GAP);
    if (m.name) {
      font(ctx, { size: SIG_NAME.size, family: INTER });
      ctx.fillStyle = "#3a3a3a";
      fillSpaced(ctx, m.name, ax - m.nameW / 2, baselineIn(ctx, ty, px(SIG_NAME.lh)), m.nameSpacing);
      ctx.textAlign = "center";
      ty += px(SIG_NAME.lh);
    }
    if (m.title) {
      font(ctx, { size: SIG_TITLE.size, family: INTER });
      ctx.fillStyle = "#6b6b6b";
      ctx.fillText(m.title, ax, baselineIn(ctx, ty, px(SIG_TITLE.lh)));
    }

    boxes.push({
      id: sig.id,
      x0: ax - m.width / 2, x1: ax + m.width / 2,
      y0: ay - m.above, y1: ay + m.below,
      ax, ay, metrics: m, line: sig.line !== false,
    });
  });
  ctx.restore();
  return boxes;
}

/** Renders at full size and returns the PNG as a Blob (for POST /certificates). */
export async function renderCertificatePng(cert) {
  await Promise.all([ensureFonts(), ensureSignatureImages(cert.signatures)]);
  const canvas = document.createElement("canvas");
  canvas.width = CERT_W;
  canvas.height = CERT_H;
  drawCertificate(canvas.getContext("2d"), cert);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't create the certificate image."))), "image/png");
  });
}