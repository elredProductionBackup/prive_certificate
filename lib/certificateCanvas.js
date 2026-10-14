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

export const CERT_W = 2267;
export const CERT_H = 1638;
const U = CERT_W / 100; // 1cqw in px at full size
const px = (cqw) => cqw * U;

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
 *         citation, eventDate, location, certificateId, verifyUrl }
 * opts.placeholderName: shown (greyed) when recipientName is empty, for previews.
 */
export function drawCertificate(ctx, cert, { placeholderName = "Recipient name" } = {}) {
  const cx = CERT_W / 2;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

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
    y += lines.length * lh; // padding-bottom 1.2 and margin-bottom -1.2 cancel out
  }

  // Speaker
  y += px(3.6);
  font(ctx, { size: 4.3, family: LORA, weight: 700 });
  ctx.fillStyle = "#54585c";
  ctx.fillText(cert.speakerName || "", cx, baselineIn(ctx, y, px(5)));
  y += px(5);

  // Speaker's title
  y += px(0.3);
  font(ctx, { size: 2.05, family: INTER, weight: 500, style: "italic" });
  ctx.fillStyle = "#111111";
  ctx.fillText(cert.speakerTitle || "", cx, baselineIn(ctx, y, px(2.6)));
  y += px(2.6);

  // "This certificate is proudly presented to"
  y += px(1.4);
  font(ctx, { size: 2.05, family: INTER });
  ctx.fillText("This certificate is proudly presented to", cx, baselineIn(ctx, y, px(2.6)));
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
    y += lines.length * lh;
  }

  // Date and location
  {
    y += px(2.8);
    const lh = px(2.45);
    font(ctx, { size: 1.85, family: INTER });
    ctx.fillText(formatCertDate(cert.eventDate), cx, baselineIn(ctx, y, lh));
    ctx.fillText(cert.location || "", cx, baselineIn(ctx, y + lh, lh));
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
    ctx.fillText(`Verify at ${verifyHost(cert.verifyUrl, cert.certificateId)}`, left, baselineIn(ctx, top + 2 * lh, lh));

    const qrSize = px(6.4);
    drawQr(ctx, cert.verifyUrl || cert.certificateId, CERT_W - px(5) - qrSize, bottom - qrSize, qrSize);
  }

  ctx.restore();
}

/** Renders at full size and returns the PNG as a Blob (for POST /certificates). */
export async function renderCertificatePng(cert) {
  await ensureFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CERT_W;
  canvas.height = CERT_H;
  drawCertificate(canvas.getContext("2d"), cert);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't create the certificate image."))), "image/png");
  });
}