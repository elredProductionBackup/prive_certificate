"use client";
import { useState } from "react";
import { verifyApi } from "@/services/verifyApi";

function useCopy() {
  const [copied, setCopied] = useState("");
  return [copied, async (key, text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
    setCopied(key);
    setTimeout(() => setCopied(""), 1800);
  }];
}

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
);

export function CopyId({ id }) {
  const [copied, copy] = useCopy();
  return (
    <dd className="ledger__id">
      <span>{id}</span>
      <button className="iconbtn" onClick={() => copy("id", id)} aria-label="Copy certificate ID">
        <CopyIcon /> {copied ? "Copied" : "Copy"}
      </button>
    </dd>
  );
}

export default function ResultActions({ id, verifyLink, linkedInUrl }) {
  const [copied, copy] = useCopy();
  return (
    <div className="result__actions">
  
      <div className="result__row">
        <button className="btn btn--ghost" onClick={() => copy("link", verifyLink)}>{copied === "link" ? "Link copied" : "Copy link"}</button>
        <button className="btn btn--ghost" onClick={() => window.print()}>Print</button>
      </div>
    </div>
  );
}
