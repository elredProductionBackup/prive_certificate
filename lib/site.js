import { LINKEDIN_ORG_ID, siteUrl } from "./config";

/** Public verify page for an ID on this portal. */
export const verifyLink = (id) => `${siteUrl()}/verify/${id}`;

/** "https://certificate.theprive.network/verify/PRV-…" -> "certificate.theprive.network/verify" */
export function verifyHost(url, id) {
  const base = url ? url.replace(new RegExp(`/${id}$`), "") : `${siteUrl()}/verify`;
  return base.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// "2026-10-01" -> "01.10.2026" (format printed on the certificate)
export function formatCertDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

// "2026-10-01" -> "1 October 2026"
export function formatLongDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// ISO timestamp -> "10 Oct 2026, 1:11 pm"
export function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// ISO timestamp -> "10 October 2026, 2:59 pm IST"
export function formatCheckedAt(iso) {
  const d = iso ? new Date(iso) : new Date();
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  return `${date}, ${time} IST`;
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The header options, as the API names them. */
export const HEADERS = {
  priveTeam: "Privé Team",
  prive: "Privé",
};

/** Field limits from the API docs, so inputs stop at the same place the server does. */
export const LIMITS = {
  recipientName: 80,
  programTitle: 120,
  speakerName: 80,
  speakerTitle: 120,
  credentialName: 120,
  citation: 240,
  location: 80,
  adminName: 80,
};

// The Dr. Anil Lamba programme, so the issue form starts filled in.
export const PROGRAMME_DEFAULTS = {
  header: "priveTeam",
  programTitle: "A One-Day Practice on Finance Management",
  speakerName: "Dr. Anil Lamba",
  speakerTitle: "Author, Chartered accountant",
  citation: "for demonstrating analytical rigor and active engagement throughout the practice",
  eventDate: "2026-10-01",
  location: "Mumbai, India",
  credentialName: "Completed Workshop by Anil Lamba",
};

/** emailStatus values from the API and how each is shown. */
export const EMAIL_STATUS = {
  sent: { label: "Sent", tone: "sent" },
  failed: { label: "Failed", tone: "failed" },
  "not-sent": { label: "Not sent", tone: "muted" },
  "no-email": { label: "No email", tone: "muted" },
};

/** LinkedIn "Add to profile" link for a certificate (same fields the email uses). */
export function linkedInAddUrl(cert, link) {
  const [y, m] = (cert.eventDate || "").split("-");
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.credentialName || `Completed Workshop by ${cert.speakerName}`,
    organizationId: LINKEDIN_ORG_ID,
    issueYear: y || "",
    issueMonth: m ? String(Number(m)) : "",
    certUrl: link,
    certId: cert.certificateId,
  });
  return `https://www.linkedin.com/profile/add?${params}`;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
