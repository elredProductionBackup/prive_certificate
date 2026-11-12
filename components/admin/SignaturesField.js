"use client";
// "Signatures" in the issue form: add up to MAX_SIGNATURES, edit the name and
// title under each, resize, replace or remove them. They're drawn on the
// certificate canvas (and so into the issued PNG); nothing goes to the API.
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import SignatureDialog from "./SignatureDialog";
import {
  addSignature, autoPlaceSignatures, reinsertSignature, removeSignature, restoreSignatures, updateSignature,
} from "@/store/slices/issueSlice";
import { loadSignatures, MAX_SIGNATURES, SIGNATURE_SIZE } from "@/lib/signatures";
import { LIMITS } from "@/lib/site";

const toFill = (v) => ((v - SIGNATURE_SIZE.min) / (SIGNATURE_SIZE.max - SIGNATURE_SIZE.min)) * 100;

function SignatureCard({ sig, index, selected, onSelect, onReplace, onRemove, disabled }) {
  const dispatch = useDispatch();
  const ids = useId();
  const set = (changes) => dispatch(updateSignature({ id: sig.id, changes }));
  const size = Number(sig.size) || SIGNATURE_SIZE.default;

  return (
    <li
      className={`sig-card${selected ? " is-selected" : ""}`}
      onFocusCapture={() => onSelect(sig.id)}
      onPointerDown={() => onSelect(sig.id)}
    >
      <div className="sig-card__thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sig.image} alt={`Signature ${index + 1}${sig.name ? `, ${sig.name}` : ""}`} />
      </div>

      <div className="sig-card__body">
        <div className="grid2">
          <div className="field">
            <label htmlFor={`${ids}-n`}>Name</label>
            <input id={`${ids}-n`} className="input input--sm" value={sig.name || ""} maxLength={LIMITS.speakerName}
              onChange={(e) => set({ name: e.target.value })} placeholder="Optional" />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-t`}>Title</label>
            <input id={`${ids}-t`} className="input input--sm" value={sig.title || ""} maxLength={LIMITS.speakerTitle}
              onChange={(e) => set({ title: e.target.value })} placeholder="Optional" />
          </div>
        </div>

        <div className="sig-card__row">
          <div className="sig-card__size">
            <label htmlFor={`${ids}-s`} className="label">Size</label>
            <div className="range" style={{ "--p": toFill(size), "--d": toFill(SIGNATURE_SIZE.default) }}>
              <div className="range__track">
                <input id={`${ids}-s`} type="range" className="range__input"
                  min={SIGNATURE_SIZE.min} max={SIGNATURE_SIZE.max} step={0.1} value={size}
                  onChange={(e) => set({ size: Number(e.target.value) })}
                  aria-valuetext={`${Math.round(toFill(size))} percent of the largest size`} />
              </div>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={sig.line !== false} onChange={(e) => set({ line: e.target.checked })} />
            <span>Line</span>
          </label>
        </div>

        <div className="sig-card__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onReplace(sig)} disabled={disabled}>Replace</button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => onRemove(sig, index)} disabled={disabled}>Remove</button>
        </div>
      </div>
    </li>
  );
}

export default function SignaturesField({ selectedId, onSelect }) {
  const dispatch = useDispatch();
  const { signatures, signaturesRestored, running, fields } = useSelector((s) => s.issue);
  const [dialog, setDialog] = useState(null); // { mode: "add" } | { mode: "replace", sig }
  const [removed, setRemoved] = useState(null); // { signature, index } for Undo
  const undoTimer = useRef(0);

  // Bring back the signatures saved in this browser (once per sign-in)
  useEffect(() => {
    if (!signaturesRestored) dispatch(restoreSignatures(loadSignatures()));
  }, [dispatch, signaturesRestored]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const full = signatures.length >= MAX_SIGNATURES;
  const moved = signatures.some((s) => s.x != null);

  function save(result) {
    if (dialog?.mode === "replace") {
      dispatch(updateSignature({ id: dialog.sig.id, changes: result }));
      onSelect(dialog.sig.id);
    } else {
      const action = dispatch(addSignature(result));
      onSelect(action.payload.id);
    }
    setDialog(null);
  }

  function remove(sig, index) {
    dispatch(removeSignature(sig.id));
    if (selectedId === sig.id) onSelect(null);
    setRemoved({ signature: sig, index });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setRemoved(null), 8000);
  }

  function undo() {
    if (!removed) return;
    dispatch(reinsertSignature(removed));
    onSelect(removed.signature.id);
    setRemoved(null);
  }

  return (
    <div className="field sigs">
      <div className="sigs__head">
        <span className="label">Signatures <span className="muted">({signatures.length} of {MAX_SIGNATURES})</span></span>
        {moved && (
          <button type="button" className="range-reset" onClick={() => dispatch(autoPlaceSignatures())}>
            Reset positions
          </button>
        )}
      </div>

      {signatures.length > 0 && (
        <ul className="sigs__list">
          {signatures.map((sig, i) => (
            <SignatureCard key={sig.id} sig={sig} index={i} selected={sig.id === selectedId} disabled={running}
              onSelect={onSelect} onReplace={(s) => setDialog({ mode: "replace", sig: s })} onRemove={remove} />
          ))}
        </ul>
      )}

      {removed && (
        <p className="sigs__undo" role="status">
          Signature removed.{" "}
          <button type="button" className="range-reset" onClick={undo}>Undo</button>
        </p>
      )}

      <div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDialog({ mode: "add" })} disabled={full || running}>
          + Add signature
        </button>
      </div>
      <span className="hint">
        {signatures.length === 0
          ? "Optional. Draw, upload or type a signature and it's printed on every certificate in this run."
          : "Drag a signature on the preview to place it (arrow keys nudge it). Removing one takes it off the next certificates you issue; ones already issued don't change."}
      </span>

      {/* Portalled out of the issue <form>, so Enter in the dialog can't issue certificates */}
      {dialog && createPortal(
        <SignatureDialog
          initial={dialog.mode === "replace" ? dialog.sig : null}
          namePlaceholder={signatures.length === 0 ? fields.speakerName : ""}
          onSave={save}
          onClose={() => setDialog(null)}
        />,
        document.body
      )}
    </div>
  );
}
