// Saves a Blob through a temporary <a download>, as the API docs suggest for the ZIP.
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Issued certificates as a CSV of names, emails, IDs and verify links. */
export function downloadCsv(rows, verifyLink) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["name", "email", "certificate_id", "email_status", "verify_link"];
  const body = rows.map((c) =>
    [c.recipientName, c.recipientEmail, c.certificateId, c.emailStatus, verifyLink(c.certificateId)].map(esc).join(",")
  );
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  saveBlob(blob, `prive-certificates-${new Date().toISOString().slice(0, 10)}.csv`);
}
