"use client";
import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import CertificatePreview from "@/components/certificate/CertificatePreview";
import Switch from "@/components/common/Switch";
import IssueResults from "./IssueResults";
import {
  issueCertificates, parseRecipients, setBatchText, setField, setIssueError,
  setMode, setRecipientEmail, setRecipientName, setSendEmail,
} from "@/store/slices/issueSlice";
import { LIMITS, plural } from "@/lib/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAMPLE_ID = "PRV-2026-XXXX-XXXX";

export default function IssueForm() {
  const dispatch = useDispatch();
  const issue = useSelector((s) => s.issue);
  const { mode, fields, recipientName, recipientEmail, batchText, sendEmail, running, progress, error } = issue;

  const batch = useMemo(() => parseRecipients(batchText), [batchText]);
  const previewName = mode === "single" ? recipientName : batch[0]?.name || "";
  const previewCert = useMemo(
    () => ({ ...fields, recipientName: previewName, certificateId: SAMPLE_ID, verifyUrl: "" }),
    [fields, previewName]
  );

  const set = (key) => (e) => dispatch(setField({ key, value: e.target.value }));

  function validate() {
    const required = [["programTitle", "programme title"], ["speakerName", "speaker"], ["eventDate", "date"]];
    for (const [k, label] of required) if (!String(fields[k] || "").trim()) return `Add the ${label}.`;
    if (mode === "single") {
      if (!recipientName.trim()) return "Add the recipient's name.";
      if (recipientEmail.trim() && !EMAIL_RE.test(recipientEmail.trim())) return "That email address doesn't look right.";
    } else {
      if (batch.length === 0) return "Add at least one name, one per line.";
      const bad = batch.find((r) => r.email && !EMAIL_RE.test(r.email));
      if (bad) return `The email for ${bad.name} doesn't look right: ${bad.email}`;
      const long = batch.find((r) => r.name.length > LIMITS.recipientName);
      if (long) return `${long.name.slice(0, 30)}… is longer than ${LIMITS.recipientName} characters.`;
    }
    return "";
  }

  function onSubmit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) return dispatch(setIssueError(problem));
    dispatch(issueCertificates());
  }

  const count = mode === "single" ? 1 : batch.length;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="issue" aria-labelledby="issue-title">
      <form className="issue__form" onSubmit={onSubmit} noValidate>
        <div className="issue__head">
          <h2 id="issue-title">Issue certificates</h2>
          <div className="segmented" role="group" aria-label="How many recipients">
            <button type="button" aria-pressed={mode === "single"} onClick={() => dispatch(setMode("single"))} disabled={running}>One person</button>
            <button type="button" aria-pressed={mode === "batch"} onClick={() => dispatch(setMode("batch"))} disabled={running}>A list of people</button>
          </div>
        </div>

        {mode === "single" ? (
          <div className="grid2">
            <div className="field">
              <label htmlFor="rname">Recipient name</label>
              <input id="rname" className="input" value={recipientName} maxLength={LIMITS.recipientName}
                onChange={(e) => dispatch(setRecipientName(e.target.value))} placeholder="Meezan Nafees" />
            </div>
            <div className="field">
              <label htmlFor="remail">Email <span className="muted">(optional)</span></label>
              <input id="remail" type="email" className="input" value={recipientEmail}
                onChange={(e) => dispatch(setRecipientEmail(e.target.value))} placeholder="name@company.com" />
            </div>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="rbatch">Recipients</label>
            <textarea id="rbatch" className="textarea" value={batchText}
              onChange={(e) => dispatch(setBatchText(e.target.value))}
              placeholder={"Meezan Nafees, meezan@company.com\nSaurabh Goswamy\nPriya Shah, priya@company.com"} />
            <span className="hint">
              One person per line, with their email after a comma so they receive their certificate. You can paste two columns straight from Excel.{" "}
              {batch.length > 0 && <strong>{plural(batch.length, "person", "people")} found.</strong>}
            </span>
          </div>
        )}

        <fieldset className="issue__programme" disabled={running}>
          <legend>Programme details, printed on every certificate</legend>

          <div className="field">
            <span className="label">Header</span>
            <div className="segmented" role="group" aria-label="Certificate header">
              <button type="button" aria-pressed={fields.header === "priveTeam"} onClick={() => dispatch(setField({ key: "header", value: "priveTeam" }))}>Privé Team</button>
              <button type="button" aria-pressed={fields.header === "prive"} onClick={() => dispatch(setField({ key: "header", value: "prive" }))}>Privé</button>
            </div>
            <span className="hint">Privé Team for members&rsquo; staff, Privé alone for members themselves.</span>
          </div>

          <div className="field">
            <label htmlFor="ptitle">Programme title</label>
            <input id="ptitle" className="input" value={fields.programTitle} maxLength={LIMITS.programTitle} onChange={set("programTitle")} />
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="sname">Speaker</label>
              <input id="sname" className="input" value={fields.speakerName} maxLength={LIMITS.speakerName} onChange={set("speakerName")} />
            </div>
            <div className="field">
              <label htmlFor="stitle">Speaker&rsquo;s title</label>
              <input id="stitle" className="input" value={fields.speakerTitle} maxLength={LIMITS.speakerTitle} onChange={set("speakerTitle")} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cred">Name on LinkedIn</label>
            <input id="cred" className="input" value={fields.credentialName} maxLength={LIMITS.credentialName} onChange={set("credentialName")}
              placeholder={fields.speakerName ? `Completed Workshop by ${fields.speakerName}` : ""} />
            <span className="hint">What the email&rsquo;s &ldquo;Add to LinkedIn&rdquo; button fills in as the certification name.</span>
          </div>
          <div className="field">
            <label htmlFor="cit">Citation</label>
            <textarea id="cit" className="textarea textarea--short" value={fields.citation} maxLength={LIMITS.citation} onChange={set("citation")} />
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="edate">Date</label>
              <input id="edate" type="date" className="input" value={fields.eventDate} onChange={set("eventDate")} />
            </div>
            <div className="field">
              <label htmlFor="loc">Location</label>
              <input id="loc" className="input" value={fields.location} maxLength={LIMITS.location} onChange={set("location")} />
            </div>
          </div>
        </fieldset>

        <Switch id="send-email" checked={sendEmail} onChange={(v) => dispatch(setSendEmail(v))}
          hint="Sends the certificate email with the Add to LinkedIn button. People without an email address are skipped.">
          Email each person their certificate
        </Switch>

        {error && <p className="alert alert--error" role="alert" style={{ margin: 0 }}>{error.message}</p>}

        {running && progress.total > 1 && (
          <div className="progress" role="status" aria-live="polite">
            <div className="progress__text">
              <span>Issuing {Math.min(progress.done + 1, progress.total)} of {progress.total}{progress.current ? `: ${progress.current}` : ""}</span>
              <span className="muted">{pct}%</span>
            </div>
            <div className="progress__bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        <div>
          <button className="btn" type="submit" disabled={running}>
            {running
              ? "Issuing…"
              : mode === "single" ? "Issue certificate" : `Issue ${count || ""} certificate${count === 1 ? "" : "s"}`}
          </button>
        </div>

        <IssueResults />
      </form>

      <div className="issue__preview" aria-label="Live preview">
        <p className="label" style={{ margin: "0 0 10px" }}>Preview</p>
        <div className="issue__sheet">
          <CertificatePreview cert={previewCert} />
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          This is the image that gets issued. The real ID and QR code are added when you issue.
        </p>
      </div>
    </section>
  );
}
