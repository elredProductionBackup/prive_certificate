// Public endpoints: no token.
import { buildUrl, request } from "./apiClient";

export const verifyApi = {
  /** GET /certificate/:id?track=1 -> { valid, status, certificate, checkedAt } */
  lookup: (certificateId, { track = false, signal } = {}) =>
    request(`/certificate/${encodeURIComponent(certificateId)}`, {
      query: track ? { track: 1 } : undefined,
      signal,
    }),

  /** A plain link works here: the server answers with Content-Disposition: attachment. */
  downloadUrl: (certificateId) => buildUrl(`/certificate/${encodeURIComponent(certificateId)}/download`),
};
