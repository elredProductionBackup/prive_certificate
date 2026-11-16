// Draws the Privé certificate on a <canvas> and exports it as a PNG.
//
// The API docs: "The canvas is drawn in the browser, so the page needs the real
// ID before it draws. Print the ID bottom left and the QR code bottom right.
// Export as PNG." This file is that step. In this design the ID sits at the
// bottom right, just left of the QR code, so the speaker and signatures can
// have the bottom left.
//
// Layout (every measurement in cqw, 1% of the certificate width, mirrored in
// app/certificate.css so the PNG matches the on-screen artwork):
//   cream paper with a fine grain, a faint gold guilloche behind the text and a
//   gold double frame; one left-aligned column with the logo, a gold rule,
//   "Presents to", the recipient, the citation, the programme title and the
//   date · location; along the bottom, the speaker / signatures on the left and
//   the Certificate ID with the QR code on the right.
import QRCode from "qrcode";
import { formatLongDate, verifyHost } from "./site";
import { SIGNATURE_SIZE } from "./signatures";

export const CERT_W = 2267;
export const CERT_H = 1638;
const U = CERT_W / 100; // 1cqw in px at full size
const px = (cqw) => cqw * U;
/** px at full size -> cqw */
export const toCqw = (pxValue) => pxValue / U;
const H_CQW = toCqw(CERT_H); // certificate height in cqw (~72.25)

const LORA = '"Lora", Georgia, "Times New Roman", serif';
const INTER = '"Inter", Arial, Helvetica, sans-serif';

// Page geometry (cqw)
const PAD_L = 6.8;
const PAD_R = 6.8;
const PAD_T = 6.2;
const PAD_B = 5.6;
const CONTENT_W = 100 - PAD_L - PAD_R; // 86.4
const FOOT_BOTTOM = H_CQW - PAD_B;    // bottom edge of the signature row and the QR code

const INK = "#1f1f1f";
const TEXT = "#333333";
const MUTED = "#5e5e5e";
const PLACEHOLDER = "#b9b4a9";

// Programme title layout. The admin picks how wide the title can run (as a %
// of the certificate width) with cert.titleWidth; very long titles shrink
// (down to TITLE_MIN_SIZE) rather than spill past TITLE_MAX_LINES.
// max 85 keeps the title inside the content column (86.4% wide).
export const TITLE_WIDTH = { min: 40, max: 85, default: 76 };
const NAME_SIZE = 5.4;       // cqw, the recipient's name
const TITLE_SIZE = 4.6;      // cqw
const TITLE_MIN_SIZE = 3.2;  // cqw
const TITLE_LH = 1.18;       // × font size
const TITLE_MAX_LINES = 2;

// Each face used below. They're loaded by @fontsource in app/layout.js;
// document.fonts.load makes sure they're ready before we draw.
const FACES = [
  `700 40px ${LORA}`,
  `400 40px ${INTER}`,
  `600 40px ${INTER}`,
  `700 40px ${INTER}`,
  `italic 500 40px ${INTER}`,
];

// Artwork served from /public/brand. Same-origin files keep the canvas
// exportable. `aspect` is the SVG's width ÷ height, so we don't depend on
// naturalWidth (some browsers report 0 for SVG).
const LOGOS = {
  priveTeam: { src: "/brand/prive-team.svg", aspect: 150 / 29, h: 5 },
  prive: { src: "/brand/prive.svg", aspect: 90 / 29, h: 5.8 },
};
const ART = {
  paper: "/brand/paper.png",          // 320px grain tile, drawn at PAPER_TILE cqw
  guilloche: "/brand/guilloche.svg",  // square line pattern
};
const PAPER_TILE = 30.3;              // cqw
const PAPER_COLOUR = "#fbf9f3";
const GUILLOCHE = { x: 55.5, y: 6.6, size: 58.7, alpha: 0.16 }; // cqw
const images = {};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // fall back (text brand, plain paper)
    img.src = src;
  });
}

function loadArtwork() {
  if (typeof Image === "undefined") return Promise.resolve();
  const all = { ...Object.fromEntries(Object.entries(LOGOS).map(([k, v]) => [k, v.src])), ...ART };
  return Promise.all(
    Object.entries(all).map(([key, src]) => loadImage(src).then((img) => { if (img) images[key] = img; }))
  );
}

function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.all(FACES.map((f) => document.fonts.load(f, "Privé Aa").catch(() => null)))
    .then(() => document.fonts.ready);
}

// Fonts and artwork. The preview redraws once this resolves, and the PNG export
// waits for it, so issued certificates always have the logo and the paper.
let assetsReady;
export function ensureFonts() {
  if (!assetsReady) assetsReady = Promise.all([loadFonts(), loadArtwork()]).then(() => undefined);
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

// Like wrap, but evens the lines out (CSS text-wrap: balance): the narrowest
// width that still gives the same number of lines.
function wrapBalanced(ctx, text, maxWidth) {
  const lines = wrap(ctx, text, maxWidth);
  if (lines.length < 2) return lines;
  let lo = maxWidth * 0.4;
  let hi = maxWidth;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrap(ctx, text, mid).length <= lines.length) hi = mid; else lo = mid;
  }
  return wrap(ctx, text, hi);
}

const widest = (ctx, lines) => Math.max(0, ...lines.map((l) => ctx.measureText(l).width));

// "13 November 2026 · Mumbai, India"
export function certMetaLine(cert) {
  return [formatLongDate(cert.eventDate), String(cert.location || "").trim()].filter(Boolean).join(" · ");
}

// QR code with no quiet zone (the light paper is the margin), drawn on whole
// pixels so modules never show seams.
function drawQr(ctx, text, x, y, size) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  ctx.fillStyle = "#2b2b2b";
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

function drawPaper(ctx) {
  ctx.fillStyle = PAPER_COLOUR;
  ctx.fillRect(0, 0, CERT_W, CERT_H);
  const tile = images.paper;
  if (!tile) return;
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const s = px(PAPER_TILE) / (tile.naturalWidth || 320);
  if (pattern.setTransform && typeof DOMMatrix !== "undefined") pattern.setTransform(new DOMMatrix().scale(s, s));
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, CERT_W, CERT_H);
}

function drawGuilloche(ctx) {
  const img = images.guilloche;
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = GUILLOCHE.alpha;
  ctx.drawImage(img, px(GUILLOCHE.x), px(GUILLOCHE.y), px(GUILLOCHE.size), px(GUILLOCHE.size));
  ctx.restore();
}

function drawFrame(ctx) {
  // Outer gold rule, then a lighter inner one (.cert__border--outer / --inner)
  for (const { inset, width, colour } of [
    { inset: 2.12, width: 0.14, colour: "#c9a13a" },
    { inset: 2.8, width: 0.1, colour: "#e2cf8c" },
  ]) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = px(width);
    const o = px(inset) + px(width) / 2;
    ctx.strokeRect(o, o, CERT_W - 2 * o, CERT_H - 2 * o);
  }
}

/**
 * Draws the certificate onto ctx at full size (2267 × 1638 units).
 * cert: { header, programTitle, speakerName, speakerTitle, recipientName,
 *         citation, eventDate, location, certificateId, verifyUrl, signatures, titleWidth }
 * opts.placeholderName: shown (greyed) when recipientName is empty, for previews.
 * Returns { signatures: [box], overlap } for the preview: the boxes let it drag
 * signatures, and overlap is true when a signature covers text, the QR code or
 * another signature.
 */
export function drawCertificate(ctx, cert, { placeholderName = "Recipient name" } = {}) {
  const left = px(PAD_L);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Areas already printed on, so the preview can warn when a signature covers them
  const taken = [];
  const mark = (x0, y0, w, h) => { if (w > 0 && h > 0) taken.push({ x0, y0, x1: x0 + w, y1: y0 + h }); };

  drawPaper(ctx);
  drawGuilloche(ctx);
  drawFrame(ctx);

  let y = px(PAD_T);

  // Brand: the Privé Team or Privé logo, top left
  {
    const key = cert.header === "prive" ? "prive" : "priveTeam";
    const spec = LOGOS[key];
    const h = px(spec.h);
    const logo = images[key];
    if (logo) {
      const w = h * spec.aspect;
      ctx.drawImage(logo, left, y, w, h);
      mark(left, y, w, h);
    } else {
      // Fallback while the logo loads (or if the file is missing): the text brand
      font(ctx, { size: spec.h * 0.9, family: LORA, weight: 700 });
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, "#e6cf55"); g.addColorStop(0.45, "#d4b43e"); g.addColorStop(1, "#bf9028");
      ctx.fillStyle = g;
      const text = key === "prive" ? "Privé" : "Privé Team";
      ctx.fillText(text, left, baselineIn(ctx, y, h));
      mark(left, y, ctx.measureText(text).width, h);
    }
    y += h;
  }

  // Gold rule across the column, fading out to the right
  {
    y += px(2.4);
    const g = ctx.createLinearGradient(left, 0, left + px(CONTENT_W), 0);
    g.addColorStop(0, "#bc8c20");
    g.addColorStop(0.45, "#e0d053");
    g.addColorStop(1, "rgba(224, 208, 83, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(left, y, px(CONTENT_W), px(0.19));
    y += px(0.19);
  }

  // "Presents to"
  y += px(3.6);
  font(ctx, { size: 2.1, family: INTER, weight: 500, style: "italic" });
  ctx.fillStyle = TEXT;
  ctx.fillText("Presents to", left, baselineIn(ctx, y, px(2.7)));
  mark(left, y, ctx.measureText("Presents to").width, px(2.7));
  y += px(2.7);

  // Recipient: shrinks for long names, never runs past the column
  {
    y += px(0.4);
    const name = (cert.recipientName || "").trim();
    const text = name || placeholderName;
    let size = text.length > 28 ? NAME_SIZE * Math.max(0.6, 28 / text.length) : NAME_SIZE;
    font(ctx, { size, family: INTER, weight: 700 });
    while (ctx.measureText(text).width > px(CONTENT_W) && size > 1.5) { size -= 0.1; font(ctx, { size, family: INTER, weight: 700 }); }
    const lh = px(NAME_SIZE * 1.12);
    ctx.fillStyle = name ? INK : PLACEHOLDER;
    ctx.fillText(text, left, baselineIn(ctx, y, lh));
    mark(left, y, ctx.measureText(text).width, lh);
    y += lh;
  }

  // Citation
  if (String(cert.citation || "").trim()) {
    y += px(3);
    const lh = px(2.9);
    font(ctx, { size: 2.1, family: INTER });
    ctx.fillStyle = TEXT;
    const lines = wrapBalanced(ctx, cert.citation, px(CONTENT_W));
    lines.forEach((line, i) => ctx.fillText(line, left, baselineIn(ctx, y + i * lh, lh)));
    mark(left, y, widest(ctx, lines), lines.length * lh);
    y += lines.length * lh;
  } else {
    y += px(1.6);
  }

  // Programme title: bold, balanced lines at the admin's chosen width, never
  // past TITLE_MAX_LINES (the font shrinks for very long titles)
  {
    y += px(1.3);
    const pct = Math.min(TITLE_WIDTH.max, Math.max(TITLE_WIDTH.min, Number(cert.titleWidth) || TITLE_WIDTH.default));
    const maxW = px(Math.min(pct, CONTENT_W));
    let size = TITLE_SIZE;
    font(ctx, { size, family: INTER, weight: 700 });
    let lines = wrapBalanced(ctx, cert.programTitle, maxW);
    while (lines.length > TITLE_MAX_LINES && size > TITLE_MIN_SIZE) {
      size = Math.max(TITLE_MIN_SIZE, size - 0.1);
      font(ctx, { size, family: INTER, weight: 700 });
      lines = wrapBalanced(ctx, cert.programTitle, maxW);
    }
    const lh = px(size * TITLE_LH);
    ctx.fillStyle = INK;
    lines.forEach((line, i) => ctx.fillText(line, left, baselineIn(ctx, y + i * lh, lh)));
    mark(left, y, widest(ctx, lines), lines.length * lh);
    y += lines.length * lh;
  }

  // Date · location
  {
    y += px(1.5);
    const text = certMetaLine(cert);
    const lh = px(2.6);
    font(ctx, { size: 1.9, family: INTER });
    ctx.fillStyle = TEXT;
    ctx.fillText(text, left, baselineIn(ctx, y, lh));
    mark(left, y, ctx.measureText(text).width, lh);
    y += lh;
  }

  // Verification block, bottom right: ID text, then the QR code at the corner
  let rowRight = px(100 - PAD_R - 30);
  if (cert.certificateId) {
    const bottom = px(FOOT_BOTTOM);
    const qrSize = px(7.4);
    const qrX = CERT_W - px(PAD_R) - qrSize;
    drawQr(ctx, cert.verifyUrl || cert.certificateId, qrX, bottom - qrSize, qrSize);
    mark(qrX, bottom - qrSize, qrSize, qrSize);

    const right = qrX - px(1.5);
    const rows = [
      { text: "Certificate ID", size: 1.1, lh: 1.6, weight: 400, colour: MUTED, spacing: 0 },
      { text: cert.certificateId, size: 1.3, lh: 1.9, weight: 600, colour: TEXT, spacing: 0.04 },
      { text: `Verify at ${verifyHost(cert.verifyUrl, cert.certificateId)}`, size: 1.1, lh: 1.6, weight: 400, colour: MUTED, spacing: 0 },
    ];
    let top = bottom - px(rows.reduce((s, r) => s + r.lh, 0));
    const blockTop = top;
    let maxW = 0;
    for (const r of rows) {
      font(ctx, { size: r.size, family: INTER, weight: r.weight });
      ctx.fillStyle = r.colour;
      const spacing = r.spacing * px(r.size);
      const w = spacedWidth(ctx, r.text, spacing) - spacing;
      fillSpaced(ctx, r.text, right - w, baselineIn(ctx, top, px(r.lh)), spacing);
      maxW = Math.max(maxW, w);
      top += px(r.lh);
    }
    mark(right - maxW, blockTop, maxW, bottom - blockTop);
    rowRight = right - maxW - px(3);
  }

  // Bottom left: the speaker and the signatures, standing on one baseline
  const signatures = drawSigningRow(ctx, cert, rowRight, mark);

  ctx.restore();
  return { signatures, overlap: signaturesOverlap(signatures, taken) };
}

// True if a signature covers printed content or another signature. The
// signature's box is trimmed a little so touching edges don't count.
function signaturesOverlap(boxes, taken) {
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  const inset = px(0.3);
  const tight = boxes.map((b) => ({ x0: b.x0 + inset, x1: b.x1 - inset, y0: b.y0 + inset, y1: b.y1 - inset }));
  return tight.some((t, i) => taken.some((r) => hit(t, r)) || tight.some((o, j) => j > i && hit(t, o)));
}

/* --------------------------------------------------------------- signatures */
// Each signature is an image standing on a signing line, with an optional name
// (printed in capitals) and title under the line, all left-aligned to the line.
// Its stored position is the centre of the line, in cqw. See lib/signatures.js
// for the shape of one signature.
//
// The speaker is printed in the same style at the bottom left. A signature
// "belongs" to the speaker when its name matches the speaker's name, or when
// the first signature has no name and no title: it then takes the speaker's
// place and prints the speaker's name and title under its line. Otherwise the
// speaker gets their own block (a short gold bar instead of a signing line),
// first in the row.

const SIG_BLOCK_MAX_W = 34;   // cqw, widest a signing line gets
const SIG_LINE_MIN_W = 13;    // cqw
const SIG_ROW_GAP = 3;        // cqw between blocks in the row
const SIG_SINK = 0.12;        // share of the image that dips below the line, like real ink
const SIG_GAP = 0.8;          // cqw between the line and the name
const SIG_NAME = { size: 1.3, min: 0.9, lh: 1.8, spacing: 0.08 }; // spacing in em
const SIG_TITLE = { size: 1.2, min: 0.95, lh: 1.6, maxLines: 2 };
const SIG_LINE = { thickness: 0.09, colour: "#9a9a9a" };
const SPEAKER_BAR = { width: 4, thickness: 0.18, colour: "#c9a13a" };
const SIG_FRAME = 3.4;        // cqw, keep clear of the inner border (inset 2.8)

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
const norm = (s) => String(s || "").trim().toLowerCase();

/**
 * Sizes of one block (px). block: { image?, aspect, size, name, title, bar }.
 * fixedLineW (cqw) sets the line width for the automatic row; otherwise the
 * line fits the content.
 */
function measureBlock(ctx, block, fixedLineW = null, textMaxW = null) {
  const maxW = px(textMaxW ?? fixedLineW ?? SIG_BLOCK_MAX_W);
  let imgW = 0;
  let imgH = 0;
  if (block.image) {
    const aspect = Number(block.aspect) > 0 ? Number(block.aspect) : 3;
    imgH = px(clampSize(block.size));
    imgW = imgH * aspect;
    const imgMax = px(fixedLineW ?? SIG_BLOCK_MAX_W);
    if (imgW > imgMax) { imgW = imgMax; imgH = imgW / aspect; }
  }

  const name = String(block.name || "").trim().toUpperCase();
  let nameSize = SIG_NAME.size;
  let nameSpacing = 0;
  let nameW = 0;
  if (name) {
    const measure = () => {
      font(ctx, { size: nameSize, family: INTER, weight: 700 });
      nameSpacing = SIG_NAME.spacing * px(nameSize);
      nameW = spacedWidth(ctx, name, nameSpacing) - nameSpacing;
    };
    measure();
    while (nameW > maxW && nameSize > SIG_NAME.min) { nameSize = Math.max(SIG_NAME.min, nameSize - 0.05); measure(); }
  }

  // Long titles shrink a little to stay within SIG_TITLE.maxLines; if they still
  // don't fit they take an extra line rather than run into the next block
  const title = String(block.title || "").trim();
  let titleSize = SIG_TITLE.size;
  font(ctx, { size: titleSize, family: INTER, weight: 500, style: "italic" });
  let titleLines = title ? wrap(ctx, title, maxW) : [];
  while (titleLines.length > SIG_TITLE.maxLines && titleSize > SIG_TITLE.min) {
    titleSize = Math.max(SIG_TITLE.min, titleSize - 0.05);
    font(ctx, { size: titleSize, family: INTER, weight: 500, style: "italic" });
    titleLines = wrap(ctx, title, maxW);
  }
  const titleW = widest(ctx, titleLines);
  const titleLh = px(SIG_TITLE.lh * (titleSize / SIG_TITLE.size));

  const textW = Math.max(nameW, titleW);
  const lineW = fixedLineW != null
    ? px(fixedLineW)
    : Math.min(px(SIG_BLOCK_MAX_W), Math.max(imgW * 1.04, textW, px(SIG_LINE_MIN_W)));
  const below = name || titleLines.length
    ? px(SIG_GAP) + (name ? px(SIG_NAME.lh) : 0) + titleLines.length * titleLh
    : px(0.3);
  return {
    name, nameSize, nameW, nameSpacing, titleLines, titleSize, titleLh, imgW, imgH, lineW, textW,
    width: Math.max(lineW, imgW, textW),
    above: block.bar ? px(SPEAKER_BAR.thickness) : imgH * (1 - SIG_SINK),
    below,
  };
}

/** Keeps a signature block inside the inner frame. x, y and the result are px (line centre). */
export function clampSignatureAnchor(m, x, y) {
  const minX = px(SIG_FRAME) + m.lineW / 2;
  const maxX = CERT_W - px(SIG_FRAME) - (m.width - m.lineW / 2);
  const minY = px(SIG_FRAME) + m.above;
  const maxY = CERT_H - px(SIG_FRAME) - m.below;
  return {
    x: Math.min(Math.max(minX, maxX), Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

// Paints one block whose line is centred on (ax, ay).
function paintBlock(ctx, block, m, ax, ay) {
  const x = ax - m.lineW / 2;
  const img = block.image ? sigImages.get(block.image)?.img : null;
  if (img) ctx.drawImage(img, x, ay - m.above, m.imgW, m.imgH);

  if (block.bar) {
    ctx.fillStyle = SPEAKER_BAR.colour;
    ctx.fillRect(x, ay - px(SPEAKER_BAR.thickness), px(SPEAKER_BAR.width), px(SPEAKER_BAR.thickness));
  } else if (block.line !== false) {
    ctx.fillStyle = SIG_LINE.colour;
    const t = px(SIG_LINE.thickness);
    ctx.fillRect(x, ay - t / 2, m.lineW, t);
  }

  let ty = ay + px(SIG_GAP);
  if (m.name) {
    font(ctx, { size: m.nameSize, family: INTER, weight: 700 });
    ctx.fillStyle = "#2b2b2b";
    fillSpaced(ctx, m.name, x, baselineIn(ctx, ty, px(SIG_NAME.lh)), m.nameSpacing);
    ty += px(SIG_NAME.lh);
  }
  if (m.titleLines.length) {
    font(ctx, { size: m.titleSize, family: INTER, weight: 500, style: "italic" });
    ctx.fillStyle = MUTED;
    ctx.textAlign = "left";
    m.titleLines.forEach((line) => { ctx.fillText(line, x, baselineIn(ctx, ty, m.titleLh)); ty += m.titleLh; });
  }
}

/**
 * Lays out and draws the speaker and the signatures. Returns one box per
 * signature, in px: { id, x0, y0, x1, y1, ax, ay, metrics, line }, where
 * (ax, ay) is the line centre.
 */
function drawSigningRow(ctx, cert, rowRight, mark) {
  const list = Array.isArray(cert.signatures) ? cert.signatures : [];
  const speakerName = String(cert.speakerName || "").trim();
  const speakerTitle = String(cert.speakerTitle || "").trim();

  // Which signature, if any, carries the speaker's name
  let claim = speakerName ? list.findIndex((s) => norm(s.name) && norm(s.name) === norm(speakerName)) : -1;
  if (claim === -1 && list[0] && !norm(list[0].name) && !norm(list[0].title)) claim = 0;

  const blocks = list.map((sig, i) => ({
    sig,
    image: sig.image,
    aspect: sig.aspect,
    size: sig.size,
    line: sig.line,
    name: i === claim ? (sig.name || speakerName) : sig.name,
    title: i === claim ? (sig.title || speakerTitle) : sig.title,
    manual: Number.isFinite(sig.x) && Number.isFinite(sig.y),
  }));
  const speakerBlock = claim === -1 && (speakerName || speakerTitle)
    ? { sig: null, bar: true, name: speakerName, title: speakerTitle, manual: false }
    : null;

  // The automatic row: the speaker (or their signature) first, then the rest
  const auto = blocks.filter((b) => !b.manual);
  const lead = speakerBlock || (claim >= 0 && !blocks[claim].manual ? blocks[claim] : null);
  const row = lead ? [lead, ...auto.filter((b) => b !== lead)] : auto;

  const placed = [];
  if (row.length) {
    const rowW = Math.max(px(SIG_LINE_MIN_W), rowRight - px(PAD_L));
    const share = toCqw((rowW - px(SIG_ROW_GAP) * (row.length - 1)) / row.length);
    const slotW = Math.min(SIG_BLOCK_MAX_W, share);
    const metrics = row.map((b) => measureBlock(ctx, b, slotW, share));
    const below = Math.max(...metrics.map((m) => m.below));
    const ay = px(FOOT_BOTTOM) - below;
    row.forEach((b, i) => {
      const m = metrics[i];
      const ax = px(PAD_L) + i * (px(share) + px(SIG_ROW_GAP)) + m.lineW / 2;
      placed.push({ b, m, ax, ay });
    });
  }
  for (const b of blocks.filter((x) => x.manual)) {
    const m = measureBlock(ctx, b);
    const { x, y } = clampSignatureAnchor(m, px(b.sig.x), px(b.sig.y));
    placed.push({ b, m, ax: x, ay: y });
  }

  // Speaker first, then signatures in list order, so later ones sit on top
  const boxes = [];
  ctx.save();
  placed
    .sort((p, q) => (p.b.sig ? list.indexOf(p.b.sig) : -1) - (q.b.sig ? list.indexOf(q.b.sig) : -1))
    .forEach(({ b, m, ax, ay }) => {
      paintBlock(ctx, b, m, ax, ay);
      const x0 = ax - m.lineW / 2;
      const box = { x0, x1: x0 + m.width, y0: ay - m.above, y1: ay + m.below };
      if (!b.sig) { mark(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); return; }
      boxes.push({ id: b.sig.id, ...box, ax, ay, metrics: m, line: b.line !== false });
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