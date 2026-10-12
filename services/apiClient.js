// One fetch wrapper for every endpoint in the API docs.
//
// The API always answers { success, isAuth, message, result: [data], errorCode? }.
// On success we return result[0] (the docs: "the data is always the first item
// of result"). On failure we throw an ApiError carrying the HTTP status, the
// elRED errorCode (when sent) and the message, which is meant to be shown as is.
import { API_ROOT } from "@/lib/config";

export class ApiError extends Error {
  constructor(message, { status = 0, errorCode, isAuth } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.isAuth = isAuth;
  }
}

/** What thunks hand to rejectWithValue: plain and serializable for Redux. */
export const toPayload = (err) => ({
  message: err?.message || "Something went wrong. Try again.",
  status: err?.status ?? 0,
  errorCode: err?.errorCode,
});

const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";

export function buildUrl(path, query) {
  const url = `${API_ROOT}${path}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

/** Sends the request and returns the raw Response (throws only on network failure). */
export async function rawRequest(path, { method = "GET", query, json, form, token, signal } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (form) body = form; // the browser sets the multipart boundary itself
  else if (json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }

  try {
    return await fetch(buildUrl(path, query), { method, headers, body, signal, cache: "no-store" });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(NETWORK_MESSAGE, { status: 0 });
  }
}

/** Reads an error body (JSON when the API sends it) into an ApiError. */
export async function errorFromResponse(res) {
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  return new ApiError(data?.message || `Request failed (HTTP ${res.status})`, {
    status: res.status,
    errorCode: data?.errorCode,
    isAuth: data?.isAuth,
  });
}

/** JSON endpoints: returns result[0], or throws ApiError. */
export async function request(path, options = {}) {
  const res = await rawRequest(path, options);
  let data = null;
  try { data = await res.json(); } catch { /* empty or not JSON */ }

  if (!res.ok || !data || data.success === false) {
    throw new ApiError(data?.message || `Request failed (HTTP ${res.status})`, {
      status: res.status,
      errorCode: data?.errorCode,
      isAuth: data?.isAuth,
    });
  }
  return Array.isArray(data.result) ? data.result[0] : data.result;
}
