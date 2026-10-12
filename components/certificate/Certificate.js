"use client";
import { QRCodeSVG } from "qrcode.react";
import { formatCertDate, verifyHost, verifyLink } from "@/lib/site";

/**
 * The certificate artwork in HTML/CSS (app/certificate.css). Used where there's
 * no stored PNG to show: the home page sample and revoked certificates.
 * header "priveTeam" -> "Privé Team", "prive" -> "Privé".
 */
export default function Certificate({ cert, revoked = false, placeholderName = "Recipient name" }) {
  const name = cert.recipientName?.trim();
  const len = (name || placeholderName).length;
  const nameScale = len > 24 ? Math.max(0.62, 24 / len) : 1;
  const id = cert.certificateId;
  const link = cert.verifyUrl || (id ? verifyLink(id) : "");

  return (
    <div className="cert" role="img" aria-label={`Certificate presented to ${name || "recipient"} for ${cert.programTitle}`}>
      <div className="cert__border cert__border--outer" />
      <div className="cert__border cert__border--inner" />

      <div className="cert__body">
        <div className="cert__brand">
          <span className="cert__brand-name cert__gold">Privé</span>
          {cert.header !== "prive" && <span className="cert__brand-team cert__gold">Team</span>}
        </div>
        <div className="cert__title cert__gold">{cert.programTitle}</div>
        <div className="cert__speaker">{cert.speakerName}</div>
        <div className="cert__designation">{cert.speakerTitle}</div>
        <div className="cert__presented">This certificate is proudly presented to</div>
        <div
          className={`cert__recipient${name ? "" : " cert__recipient--empty"}`}
          style={nameScale < 1 ? { fontSize: `${4.3 * nameScale}cqw` } : undefined}
        >
          {name || placeholderName}
        </div>
        <div className="cert__citation">{cert.citation}</div>
        <div className="cert__meta">
          {formatCertDate(cert.eventDate)}
          <br />
          {cert.location}
        </div>
      </div>

      {id && (
        <div className="cert__verify">
          <div className="cert__verify-id">
            Certificate ID
            <strong>{id}</strong>
            Verify at {verifyHost(link, id)}
          </div>
          <div className="cert__qr">
            <QRCodeSVG value={link} level="M" bgColor="#ffffff" fgColor="#3a3a3a" />
          </div>
        </div>
      )}

      {revoked && <div className="cert__void" aria-hidden="true"><span>REVOKED</span></div>}
    </div>
  );
}
