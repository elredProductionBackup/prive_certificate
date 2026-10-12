import { EMAIL_STATUS } from "@/lib/site";

export default function EmailBadge({ cert }) {
  const s = EMAIL_STATUS[cert.emailStatus] || EMAIL_STATUS[cert.recipientEmail ? "not-sent" : "no-email"];
  return (
    <span className={`badge badge--${s.tone}`} title={cert.emailStatus === "failed" ? cert.emailError : undefined}>
      {s.label}
    </span>
  );
}
