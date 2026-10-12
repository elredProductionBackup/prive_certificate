// Saves the admin session in localStorage so a page reload keeps you signed in.
// Only thunks/listeners call these; reducers stay pure.
import { SESSION_STORAGE_KEY } from "./config";

// "12h" | "30m" | "45s" | "2d" | 3600 -> milliseconds
export function durationToMs(value, fallbackMs = 12 * 3600 * 1000) {
  if (typeof value === "number" && Number.isFinite(value)) return value * 1000;
  const m = /^(\d+(?:\.\d+)?)\s*([smhd])?$/i.exec(String(value || "").trim());
  if (!m) return fallbackMs;
  const n = parseFloat(m[1]);
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[(m[2] || "s").toLowerCase()];
  return n * unit;
}

export function loadSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try { window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session)); } catch { /* storage blocked */ }
}

export function clearSession() {
  try { window.localStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* storage blocked */ }
}
