// Every environment value the app reads, in one place.
const trim = (v) => (v || "").trim().replace(/\/+$/, "");

/** e.g. https://api.example.com (empty = same origin, for the proxy setup) */
export const API_BASE_URL = trim(process.env.NEXT_PUBLIC_API_BASE_URL);

/** Every endpoint lives under this prefix. */
export const API_ROOT = `${API_BASE_URL}/api/certification`;

const SITE_FROM_ENV = trim(process.env.NEXT_PUBLIC_SITE_URL);

/** Public address of this portal; falls back to the current origin in the browser. */
export function siteUrl() {
  if (SITE_FROM_ENV) return SITE_FROM_ENV;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export const LINKEDIN_ORG_ID = trim(process.env.NEXT_PUBLIC_LINKEDIN_ORG_ID) || "145235632";

/** Where the session is kept between visits. */
export const SESSION_STORAGE_KEY = "prive.certPortal.session";
