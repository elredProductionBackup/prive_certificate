// Admin certificate endpoints.
import { ApiError, errorFromResponse, rawRequest, request } from "./apiClient";

/** filename="x.zip" or filename*=UTF-8''x.zip from Content-Disposition */
function filenameFrom(res, fallback) {
  const cd = res.headers.get("Content-Disposition") || "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? plain[1] : fallback;
}

export const certificatesApi = {
  /** GET /certificates/newId?eventDate -> { certificateId, verifyUrl } */
  newId: (token, eventDate) => request("/certificates/newId", { token, query: { eventDate } }),

  /** POST /certificates (multipart with the canvas PNG) -> certificate */
  issue: (token, form) => request("/certificates", { method: "POST", form, token }),

  /** GET /certificates -> { certificates, totalCount, page, limit, totalPages, stats } */
  list: (token, { q, status, emailStatus, page, limit }) =>
    request("/certificates", { token, query: { q: q?.slice(0, 100), status, emailStatus, page, limit } }),

  /** POST /certificates/:id/email, optionally saving a new address first -> certificate */
  resendEmail: (token, certificateId, recipientEmail) =>
    request(`/certificates/${encodeURIComponent(certificateId)}/email`, {
      method: "POST",
      token,
      json: recipientEmail ? { recipientEmail } : undefined,
    }),

  /** DELETE /certificates/:id -> { certificateId, recipientName, imageDeleted } */
  remove: (token, certificateId) =>
    request(`/certificates/${encodeURIComponent(certificateId)}`, { method: "DELETE", token }),

  /**
   * GET /certificates/export.zip (needs the token, so no plain link).
   * Returns { blob, filename } or throws ApiError.
   */
  exportZip: async (token, query) => {
    const res = await rawRequest("/certificates/export.zip", { token, query });
    const type = res.headers.get("Content-Type") || "";
    if (!res.ok || !type.includes("zip")) throw await errorFromResponse(res);
    try {
      const blob = await res.blob();
      return { blob, filename: filenameFrom(res, "Prive-Certificates.zip") };
    } catch {
      throw new ApiError("The download was cut off. Try again.", { status: res.status });
    }
  },
};
