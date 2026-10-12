// Local stand-in for the Certification Portal API, following the API docs.
// Run: npm run mock:api   then set NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
// Sign-in code is always 123456 (999999 = expired code). Emails containing "fail"
// get emailStatus "failed". A recipient name containing "reject" gets a 400.
// Data lives in memory and is lost on restart.
import http from "node:http";


const PORT = 4000;
const SITE = "http://localhost:3000";
const PREFIX = "/api/certification";


const admins = new Map([
  ["nandini@elred.io", { adminId: "6ac924057259291a32ccfc35", name: "Nandini Handa", email: "nandini@elred.io", avatar: "", role: "admin" }],
]);
const pendingNew = new Set();
const images = new Map(); // id -> Buffer
const certs = [];
let idn = 0;

const ok = (res, status, message, data, isAuth = true) => send(res, status, { success: true, isAuth, message, result: [data] });
const fail = (res, status, message, errorCode, isAuth = true) =>
  send(res, status, { success: false, isAuth, ...(errorCode !== undefined ? { errorCode } : {}), message, result: [] });
function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
async function formData(req, buf) {
  return new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body: buf }).formData();
}
function auth(req, res) {
  const h = req.headers.authorization || "";
  const t = h.replace(/^Bearer /, "");
  if (!t) { fail(res, 401, "No token provided", -1, false); return null; }
  if (t === "expired") { fail(res, 401, "jwt expired", 1, false); return null; }
  const email = t.replace(/^tok-/, "");
  const a = admins.get(email);
  if (!a) { fail(res, 401, "Admin not found", -1, false); return null; }
  return a;
}
const ALPH = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const rnd = (n) => Array.from({ length: n }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join("");
const norm = (id) => decodeURIComponent(id).toUpperCase().replace(/\s/g, "");
const stats = () => ({
  issued: certs.length,
  active: certs.filter((c) => c.status === "active").length,
  revoked: certs.filter((c) => c.status === "revoked").length,
  verifications: certs.reduce((s, c) => s + c.verifyCount, 0),
});

// Seed: one revoked certificate (no stored image -> DOM fallback)
certs.push({
  _id: "seed1", certificateId: "PRV-2026-A4TY-FH7V", recipientName: "Asha Verma", recipientEmail: "asha@example.com",
  header: "prive", programTitle: "Leadership Circle", speakerName: "Ms. Kiran Rao", speakerTitle: "Founder, Rao Advisory",
  citation: "for thoughtful contributions", eventDate: "2026-08-12", location: "Delhi, India", credentialName: "Completed Workshop by Kiran Rao",
  certificateImageKey: "", certificateImageUrl: "", status: "revoked", emailStatus: "no-email", emailError: "", emailedAt: null,
  verifyCount: 3, lastVerifiedAt: null, issuedBy: { adminId: "x", name: "", email: "old@elred.io" },
  createdAt: "2026-08-12T10:00:00.000Z", updatedAt: "2026-08-12T10:00:00.000Z",
});

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const buf = await readBody(req);
  console.log(req.method, p + url.search);

  if (p.startsWith("/img/")) {
    const img = images.get(p.slice(5).replace(/\.png$/, ""));
    if (!img) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": "image/png" }); return res.end(img);
  }
  if (!p.startsWith(PREFIX)) return fail(res, 404, "Not found");
  const route = p.slice(PREFIX.length);
  const json = () => { try { return JSON.parse(buf.toString() || "{}"); } catch { return null; } };

  // ---------- OTP ----------
  if (route === "/otp/send" && req.method === "POST") {
    const b = json();
    if (!b) return fail(res, 400, "Invalid JSON body", -1, false);
    const email = String(b.email || "").toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "email must be a valid email", undefined, false);
    if (email.startsWith("blocked")) return fail(res, 429, "Too many requests. Try again in 5 minutes.", 113, false);
    const isAdmin = admins.has(email);
    if (!isAdmin) pendingNew.add(email);
    return ok(res, 200, isAdmin ? "OTP sent to your email" : "OTP sent to the super admin for approval",
      { email, sentTo: isAdmin ? "self" : "superAdmin", isNewAdmin: !isAdmin, expiresInSeconds: isAdmin ? 300 : 1800 }, false);
  }
  if (route === "/otp/verify" && req.method === "POST") {
    const b = json();
    const email = String(b.email || "").toLowerCase();
    if (b.otp === "999999") return fail(res, 400, "OTP expired. Request a new one.", 8, false);
    if (b.otp !== "123456") return fail(res, 400, "Invalid OTP", 5, false);
    let isNewAdmin = false;
    if (!admins.has(email)) {
      if (!pendingNew.has(email)) return fail(res, 400, "OTP expired. Request a new one.", 8, false);
      admins.set(email, { adminId: "new" + Date.now(), name: "", email, avatar: "", role: "admin" });
      isNewAdmin = true;
    }
    return ok(res, 200, "Signed in successfully", { accessToken: `tok-${email}`, expiresIn: "12h", isNewAdmin, admin: admins.get(email) }, false);
  }

  // ---------- public ----------
  let m;
  if ((m = /^\/certificate\/([^/]+)\/download$/.exec(route))) {
    const c = certs.find((x) => x.certificateId === norm(m[1]));
    if (!c) return fail(res, 404, "No certificate matches this ID", undefined, false);
    if (c.status === "revoked") return fail(res, 410, "This certificate has been revoked", undefined, false);
    res.writeHead(200, { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="Prive-Certificate-${c.certificateId}.png"` });
    return res.end(images.get(c.certificateId));
  }
  if ((m = /^\/certificate\/([^/]+)$/.exec(route))) {
    const c = certs.find((x) => x.certificateId === norm(m[1]));
    if (!c) return fail(res, 404, "No certificate matches this ID", undefined, false);
    if (url.searchParams.get("track") === "1") c.verifyCount++;
    const { recipientEmail, issuedBy, _id, emailStatus, emailError, emailedAt, certificateImageKey, verifyCount, lastVerifiedAt, updatedAt, createdAt, ...pub } = c;
    return ok(res, 200, "Certificate fetched successfully", {
      valid: c.status === "active", status: c.status,
      certificate: { ...pub, certificateImageUrl: c.status === "active" ? c.certificateImageUrl : "", issuedAt: createdAt },
      checkedAt: new Date().toISOString(),
    }, false);
  }

  // ---------- admin ----------
  const admin = auth(req, res);
  if (!admin) return;

  if (route === "/profile" && req.method === "GET") return ok(res, 200, "Profile fetched successfully", admin);
  if (route === "/profile" && req.method === "PATCH") {
    const f = await formData(req, buf);
    const name = f.get("name"); const avatar = f.get("avatar");
    if (name === null && !avatar) return fail(res, 400, "Send a name or an avatar to update");
    if (name !== null) { if (!String(name).trim()) return fail(res, 400, "name cannot be empty"); admin.name = String(name).trim(); }
    if (avatar) {
      const key = "av-" + admin.adminId + "-" + Date.now();
      images.set(key, Buffer.from(await avatar.arrayBuffer()));
      admin.avatar = `http://localhost:${PORT}/img/${key}.png`;
    }
    return ok(res, 200, "Profile updated successfully", admin);
  }

  if (route === "/certificates/newId") {
    const d = url.searchParams.get("eventDate");
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return fail(res, 400, "eventDate must be a valid date in YYYY-MM-DD format");
    const y = (d || "2026").slice(0, 4);
    // Force one 409 retry: the first ID handed out is pre-taken
    const id = idn++ === 0 && certs.length ? certs[0].certificateId : `PRV-${y}-${rnd(4)}-${rnd(4)}`;
    return ok(res, 200, "Certificate ID generated", { certificateId: id, verifyUrl: `${SITE}/verify/${id}` });
  }
  if (route === "/certificates" && req.method === "POST") {
    if (!(req.headers["content-type"] || "").includes("multipart")) return fail(res, 400, "Send multipart/form-data");
    const f = await formData(req, buf);
    const img = f.get("certificateImage");
    if (!img) return fail(res, 400, "certificateImage is required");
    const id = f.get("certificateId");
    if (certs.some((c) => c.certificateId === id)) return fail(res, 409, "This certificate ID is already used. Ask for a new one.");
    const name = f.get("recipientName");
    if (String(name).toLowerCase().includes("reject")) return fail(res, 400, "recipientName must be at most 80 characters");
    const png = Buffer.from(await img.arrayBuffer());
    images.set(id, png);

    const email = f.get("recipientEmail") || "";
    const sendEmail = f.get("sendEmail") !== "false";
    const emailStatus = !email ? "no-email" : !sendEmail ? "not-sent" : email.includes("fail") ? "failed" : "sent";
    const now = new Date().toISOString();
    const fields = Object.fromEntries([...f.entries()].filter(([k]) => k !== "certificateImage"));
    const c = {
      _id: "c" + Date.now(), certificateId: id, recipientName: name, recipientEmail: email,
      header: fields.header || "priveTeam", programTitle: fields.programTitle, speakerName: fields.speakerName,
      speakerTitle: fields.speakerTitle || "", citation: fields.citation || "", eventDate: fields.eventDate, location: fields.location || "",
      credentialName: fields.credentialName || `Completed Workshop by ${fields.speakerName}`,
      certificateImageKey: `certificationPortal/certificates/${id}.png`, certificateImageUrl: `http://localhost:${PORT}/img/${id}.png`,
      status: "active", emailStatus, emailError: emailStatus === "failed" ? "The from address does not match a verified Sender Identity." : "",
      emailedAt: emailStatus === "sent" ? now : null, verifyCount: 0, lastVerifiedAt: null,
      issuedBy: { adminId: admin.adminId, name: admin.name, email: admin.email }, createdAt: now, updatedAt: now,
    };
    certs.unshift(c);
    return ok(res, 201, "Certificate issued successfully", c);
  }
  if (route === "/certificates" && req.method === "GET") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const st = url.searchParams.get("status") || "all";
    const es = url.searchParams.get("emailStatus") || "all";
    if (!["all", "active", "revoked"].includes(st)) return fail(res, 400, "status must be all, active or revoked");
    const page = +(url.searchParams.get("page") || 1), limit = +(url.searchParams.get("limit") || 20);
    let rows = certs.filter((c) => !q || [c.recipientName, c.recipientEmail, c.certificateId, c.programTitle].some((v) => v.toLowerCase().includes(q)));
    if (st !== "all") rows = rows.filter((c) => c.status === st);
    if (es !== "all") rows = rows.filter((c) => (es === "not-sent" ? ["not-sent", "no-email"].includes(c.emailStatus) : c.emailStatus === es));
    return ok(res, 200, "Certificates fetched successfully", {
      certificates: rows.slice((page - 1) * limit, page * limit), totalCount: rows.length, page, limit,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)), stats: stats(),
    });
  }
  if (route === "/certificates/export.zip") {
    res.writeHead(200, { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="Prive-Certificates-2026-10-12.zip"' });
    return res.end(Buffer.from("PK\x05\x06" + "\0".repeat(18), "binary"));
  }
  if ((m = /^\/certificates\/([^/]+)\/email$/.exec(route)) && req.method === "POST") {
    const c = certs.find((x) => x.certificateId === norm(m[1]));
    if (!c) return fail(res, 404, "Certificate not found");
    if (c.status === "revoked") return fail(res, 400, "This certificate is revoked, so it can't be emailed");
    const b = buf.length ? json() : {};
    if (b?.recipientEmail) c.recipientEmail = b.recipientEmail;
    if (!c.recipientEmail) return fail(res, 400, "This certificate has no email address. Send recipientEmail.");
    const failed = c.recipientEmail.includes("fail");
    c.emailStatus = failed ? "failed" : "sent";
    c.emailError = failed ? "The from address does not match a verified Sender Identity." : "";
    if (!failed) c.emailedAt = new Date().toISOString();
    return ok(res, 200, failed ? "Email could not be sent" : "Email sent successfully", c);
  }
  if ((m = /^\/certificates\/([^/]+)$/.exec(route)) && req.method === "DELETE") {
    const i = certs.findIndex((x) => x.certificateId === norm(m[1]));
    if (i < 0) return fail(res, 404, "Certificate not found");
    const [c] = certs.splice(i, 1);
    return ok(res, 200, "Certificate deleted successfully", { certificateId: c.certificateId, recipientName: c.recipientName, imageDeleted: true });
  }
  return fail(res, 404, "Not found");
});
server.listen(PORT, () => console.log("mock API on", PORT));
