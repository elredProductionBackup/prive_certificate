// Profile photo, or initials when there isn't one.
export default function Avatar({ admin, size = 32 }) {
  const label = admin?.name || admin?.email || "";
  const initials = label
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {admin?.avatar
        ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={admin.avatar} alt="" />
        : initials}
    </span>
  );
}
