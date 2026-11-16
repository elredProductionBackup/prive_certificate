"use client";
import { QRCodeSVG } from "qrcode.react";
import { verifyHost, verifyLink } from "@/lib/site";
import { TITLE_WIDTH, certMetaLine } from "@/lib/certificateCanvas";

/**
 * The certificate artwork in HTML/CSS (app/certificate.css), matching the
 * canvas in lib/certificateCanvas.js. Used where there's no stored PNG to show:
 * the home page sample and revoked certificates.
 * header "priveTeam" -> Privé Team logo, "prive" -> Privé logo.
 */
export default function Certificate({ cert, revoked = false, placeholderName = "Recipient name" }) {
  const name = cert.recipientName?.trim();
  const len = (name || placeholderName).length;
  const nameScale = len > 28 ? Math.max(0.6, 28 / len) : 1;
  const id = cert.certificateId;
  const link = cert.verifyUrl || (id ? verifyLink(id) : "");
  const team = cert.header !== "prive";
  const titleWidth = Math.min(TITLE_WIDTH.max, Math.max(TITLE_WIDTH.min, Number(cert.titleWidth) || TITLE_WIDTH.default));
  const meta = certMetaLine(cert);

  return (
    <div className="cert" role="img" aria-label={`Certificate presented to ${name || "recipient"} for ${cert.programTitle}`}>
      <img className="cert__guilloche" src="/brand/guilloche.svg" alt="" aria-hidden="true" />
      <div className="cert__border cert__border--outer" />
      <div className="cert__border cert__border--inner" />

      <div className="cert__body">
        <img
          className={`cert__logo${team ? "" : " cert__logo--prive"}`}
          src={team ? "/brand/prive-team.svg" : "/brand/prive.svg"}
          alt={team ? "Privé Team" : "Privé"}
        />
        <div className="cert__rule" />
        <div className="cert__presented">Presents to</div>
        <div
          className={`cert__recipient${name ? "" : " cert__recipient--empty"}`}
          style={nameScale < 1 ? { fontSize: `${5.4 * nameScale}cqw` } : undefined}
        >
          {name || placeholderName}
        </div>
        {cert.citation?.trim() && <div className="cert__citation">{cert.citation}</div>}
        <div className="cert__title" style={{ maxWidth: `${titleWidth}cqw` }}>{cert.programTitle}</div>
        {meta && <div className="cert__meta">{meta}</div>}
      </div>

      <div className="cert__foot">
        {(cert.speakerName || cert.speakerTitle) ? (
          <div className="cert__speaker">
            <span className="cert__speaker-bar" aria-hidden="true" />
            {cert.speakerName && <div className="cert__speaker-name">{cert.speakerName}</div>}
            {cert.speakerTitle && <div className="cert__speaker-title">{cert.speakerTitle}</div>}
          </div>
        ) : <span />}

        {id && (
          <div className="cert__verify">
            <div className="cert__verify-id">
              Certificate ID
              <strong>{id}</strong>
              Verify at {verifyHost(link, id)}
            </div>
            <div className="cert__qr">
              <QRCodeSVG value={link} level="M" bgColor="transparent" fgColor="#2b2b2b" />
            </div>
          </div>
        )}
      </div>

      {revoked && <div className="cert__void" aria-hidden="true"><span>REVOKED</span></div>}
    </div>
  );
}
