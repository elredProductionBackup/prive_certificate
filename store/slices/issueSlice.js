// The "Issue certificates" form and the issuing run.
//
// Per person, in this order (API docs, "Issuing a certificate"):
//   1. GET /certificates/newId       -> real ID + verify link for the QR
//   2. draw the canvas in the browser -> PNG
//   3. POST /certificates (multipart) -> stored and emailed
// A 409 means someone used the ID first, so we ask for a new one and redraw.
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { certificatesApi } from "@/services/certificatesApi";
import { toPayload } from "@/services/apiClient";
import { renderCertificatePng } from "@/lib/certificateCanvas";
import { PROGRAMME_DEFAULTS, verifyLink } from "@/lib/site";
import { fetchCertificates, setPage } from "./certificatesSlice";

// "Name" or "Name, email@x.com" per line (commas, semicolons or tabs from Excel)
export function parseRecipients(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", email = ""] = line.split(/\s*[,;\t]\s*/);
      return { name: name.trim(), email: email.trim() };
    })
    .filter((r) => r.name);
}

function buildForm(fields, recipient, certificateId, sendEmail, png) {
  const form = new FormData();
  const put = (k, v) => { const s = String(v ?? "").trim(); if (s) form.append(k, s); };
  put("certificateId", certificateId);
  put("recipientName", recipient.name);
  put("recipientEmail", recipient.email);
  put("header", fields.header);
  put("programTitle", fields.programTitle);
  put("speakerName", fields.speakerName);
  put("speakerTitle", fields.speakerTitle);
  put("credentialName", fields.credentialName);
  put("citation", fields.citation);
  put("eventDate", fields.eventDate);
  put("location", fields.location);
  form.append("sendEmail", sendEmail ? "true" : "false");
  form.append("certificateImage", png, `${certificateId}.png`);
  return form;
}

async function issueOne(token, fields, recipient, sendEmail) {
  for (let attempt = 1; ; attempt++) {
    const { certificateId, verifyUrl } = await certificatesApi.newId(token, fields.eventDate);
    const png = await renderCertificatePng({
      ...fields,
      recipientName: recipient.name,
      certificateId,
      verifyUrl: verifyUrl || verifyLink(certificateId),
    });
    try {
      return await certificatesApi.issue(token, buildForm(fields, recipient, certificateId, sendEmail, png));
    } catch (err) {
      if (err.status === 409 && attempt < 3) continue; // ID taken: get a fresh one
      throw err;
    }
  }
}

export const issueCertificates = createAsyncThunk("issue/run", async (_, { getState, dispatch, rejectWithValue }) => {
  const { auth, issue } = getState();
  const recipients = issue.mode === "single"
    ? [{ name: issue.recipientName.trim(), email: issue.recipientEmail.trim() }]
    : parseRecipients(issue.batchText);

  dispatch(issueStarted({ total: recipients.length }));
  const issued = [];
  const failed = [];

  for (const r of recipients) {
    dispatch(issueProgress({ current: r.name }));
    try {
      const cert = await issueOne(auth.token, issue.fields, r, issue.sendEmail);
      issued.push(cert);
      dispatch(issueProgress({ issued: cert }));
    } catch (err) {
      const p = toPayload(err);
      if (p.status === 401) return rejectWithValue(p); // session over: stop the run
      if (issue.mode === "single") return rejectWithValue(p); // shown under the form
      failed.push({ ...r, message: p.message });
      dispatch(issueProgress({ failed: { ...r, message: p.message } }));
    }
  }

  dispatch(setPage(1));
  dispatch(fetchCertificates());
  return { issuedCount: issued.length, failedCount: failed.length };
});

const initialState = {
  mode: "single", // "single" | "batch"
  fields: PROGRAMME_DEFAULTS,
  recipientName: "",
  recipientEmail: "",
  batchText: "",
  sendEmail: true,
  running: false,
  progress: { done: 0, total: 0, current: "" },
  issued: [], // certificates from the last run
  failed: [], // [{ name, email, message }]
  sentWithEmail: true,
  error: null,
};

const issueSlice = createSlice({
  name: "issue",
  initialState,
  reducers: {
    setMode(state, { payload }) { state.mode = payload; state.error = null; },
    setField(state, { payload: { key, value } }) { state.fields[key] = value; },
    setRecipientName(state, { payload }) { state.recipientName = payload; state.error = null; },
    setRecipientEmail(state, { payload }) { state.recipientEmail = payload; state.error = null; },
    setBatchText(state, { payload }) { state.batchText = payload; state.error = null; },
    setSendEmail(state, { payload }) { state.sendEmail = payload; },
    setIssueError(state, { payload }) { state.error = payload ? { message: payload } : null; },
    dismissResults(state) { state.issued = []; state.failed = []; },
    issueStarted(state, { payload }) {
      state.running = true;
      state.error = null;
      state.issued = [];
      state.failed = [];
      state.sentWithEmail = state.sendEmail;
      state.progress = { done: 0, total: payload.total, current: "" };
    },
    issueProgress(state, { payload }) {
      if (payload.current !== undefined) state.progress.current = payload.current;
      if (payload.issued) { state.issued.push(payload.issued); state.progress.done += 1; }
      if (payload.failed) { state.failed.push(payload.failed); state.progress.done += 1; }
    },
    resetIssue() { return initialState; },
  },
  extraReducers: (b) => {
    b.addCase(issueCertificates.fulfilled, (s) => {
      s.running = false;
      s.progress.current = "";
      // Clear the people that went through; keep the programme for the next batch
      if (s.mode === "single") { s.recipientName = ""; s.recipientEmail = ""; }
      else {
        const failedLines = s.failed.map((f) => (f.email ? `${f.name}, ${f.email}` : f.name));
        s.batchText = failedLines.join("\n");
      }
    }).addCase(issueCertificates.rejected, (s, { payload }) => {
      s.running = false;
      s.progress.current = "";
      s.error = payload || { message: "Couldn't issue the certificate. Try again." };
    });
  },
});

export const {
  setMode, setField, setRecipientName, setRecipientEmail, setBatchText, setSendEmail,
  setIssueError, dismissResults, issueStarted, issueProgress, resetIssue,
} = issueSlice.actions;

export default issueSlice.reducer;
