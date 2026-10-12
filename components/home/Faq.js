"use client";
import { useId, useState } from "react";

const ITEMS = [
  {
    q: "What if no certificate is found?",
    a: "Check the ID character by character against the certificate. Dashes don't matter, and lowercase is fine. If it still isn't found, the certificate was not issued by Privé.",
  },
  {
    q: "Can a certificate stop being valid?",
    a: "Yes. Privé can revoke a certificate, for example if it was issued in error. The check then says clearly that it has been revoked and should not be accepted.",
  },
  {
    q: "What information does the check show?",
    a: "Only what's printed on the certificate: the person's name, the programme, who led it, and the date and place. Nothing else about the person is shown.",
  },
  {
    q: "Who can I contact about a certificate?",
    a: "Write to Member Relations at Privé with the certificate ID and what you'd like to confirm.",
  },
];

export default function Faq() {
  const base = useId();
  const [open, setOpen] = useState(0);
  return (
    <div className="faq">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div className="faq__item" data-open={isOpen || undefined} key={item.q}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${base}-${i}`}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                {item.q}
                <span className="faq__icon" aria-hidden="true" />
              </button>
            </h3>
            <div className="faq__panel" id={`${base}-${i}`} role="region" aria-hidden={!isOpen}>
              <div><p>{item.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
