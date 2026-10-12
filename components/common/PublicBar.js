import Link from "next/link";

export const LOGO_URL = "https://res.cloudinary.com/dtrv7p3gg/image/upload/v1789624486/Group_1_zecnev.png";

// Public header: brand only. No admin links anywhere on the public side.
export default function PublicBar() {
  return (
    <div className="v-bar">
      <div className="v-bar__row">
        <Link href="/" aria-label="Privé certificate verification">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src={LOGO_URL} alt="Privé" />
        </Link>
        <span className="v-bar__tag">Certificate verification</span>
      </div>
      <div className="v-bar__rule" />
    </div>
  );
}
