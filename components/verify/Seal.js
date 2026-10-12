// The verification seal: a gilt rosette whose mark draws itself in.
// tone: "valid" (gold + check), "revoked" (oxblood + cross), "unknown" (stone + question)

function rosettePath(cx, cy, r, points) {
  let d = "";
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2;
    const x = (cx + r * Math.cos(a)).toFixed(2);
    const y = (cy + r * Math.sin(a)).toFixed(2);
    if (i === 0) d += `M${x} ${y}`;
    else d += ` A${(r * 0.135).toFixed(2)} ${(r * 0.135).toFixed(2)} 0 0 1 ${x} ${y}`;
  }
  return d + "Z";
}
const ROSETTE = rosettePath(60, 60, 52, 28);

const TONES = {
  valid: { from: "#f3dc86", to: "#b2852a", ink: "#3a2f12", ring: "#7a5e1d" },
  revoked: { from: "#d9786a", to: "#7d2219", ink: "#fff4ef", ring: "#5e1810" },
  unknown: { from: "#ddd5c4", to: "#9a917f", ink: "#3d3a33", ring: "#6f6a5f" },
};

export default function Seal({ tone = "valid", size = 128, label }) {
  const t = TONES[tone];
  const gid = `seal-${tone}`;
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      <g className="seal__body">
        <path d={ROSETTE} fill={`url(#${gid})`} />
        <circle cx="60" cy="60" r="41" fill="none" stroke={t.ring} strokeOpacity=".55" strokeWidth="1.2" />
        <circle cx="60" cy="60" r="36" fill="none" stroke={t.ring} strokeOpacity=".4" strokeWidth=".8" strokeDasharray="1.5 3" />
      </g>
      <g className="seal__mark" fill="none" stroke={t.ink} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        {tone === "valid" && <path pathLength="1" d="M43 61l11 11 23-25" />}
        {tone === "revoked" && <path pathLength="1" d="M46 46l28 28M74 46L46 74" />}
        {tone === "unknown" && (
          <>
            <path pathLength="1" d="M49 50c0-7 5-11 11-11s11 4 11 10c0 8-11 9-11 17" />
            <circle cx="60" cy="80" r="1.5" fill={t.ink} />
          </>
        )}
      </g>
    </svg>
  );
}
