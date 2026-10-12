"use client";
export default function Switch({ checked, onChange, children, hint, id }) {
  return (
    <div className="switch-row">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
      <label htmlFor={id} className="switch-row__text">
        <span className="label">{children}</span>
        {hint && <span className="hint">{hint}</span>}
      </label>
    </div>
  );
}
