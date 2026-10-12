"use client";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Custom dropdown (accessible listbox).
 * options: [{ value, label, count? }]
 * Keyboard: ↑ ↓ Home End to move, Enter/Space to choose, Esc to close, type a letter to jump.
 */
export default function Select({ value, onChange, options, label, prefix, width }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    listRef.current?.focus({ preventScroll: true });
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(i) {
    onChange(options[i].value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onButtonKey(e) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); }
  }

  function onListKey(e) {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive((i) => Math.min(last, i + 1)); break;
      case "ArrowUp": e.preventDefault(); setActive((i) => Math.max(0, i - 1)); break;
      case "Home": e.preventDefault(); setActive(0); break;
      case "End": e.preventDefault(); setActive(last); break;
      case "Enter": case " ": e.preventDefault(); choose(active); break;
      case "Escape": e.preventDefault(); setOpen(false); buttonRef.current?.focus(); break;
      case "Tab": setOpen(false); break;
      default:
        if (e.key.length === 1) {
          const k = e.key.toLowerCase();
          const start = (active + 1) % options.length;
          for (let n = 0; n < options.length; n++) {
            const i = (start + n) % options.length;
            if (options[i].label.toLowerCase().startsWith(k)) { setActive(i); break; }
          }
        }
    }
  }

  return (
    <div className="select" ref={rootRef} data-open={open || undefined} style={width ? { width } : undefined}>
      <button
        ref={buttonRef}
        type="button"
        className="select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? `${label}: ${selected.label}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
      >
        {prefix && <span className="select__prefix">{prefix}</span>}
        <span className="select__value">{selected.label}</span>
        <svg className="select__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ul
        ref={listRef}
        className="select__list"
        role="listbox"
        tabIndex={-1}
        aria-label={label}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={onListKey}
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${id}-${i}`}
            role="option"
            aria-selected={o.value === value}
            data-active={i === active || undefined}
            onPointerEnter={() => setActive(i)}
            onClick={() => choose(i)}
          >
            <svg className="select__check" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="select__label">{o.label}</span>
            {o.count !== undefined && <span className="select__count">{o.count}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
