import "../../verify.css";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Verify ${decodeURIComponent(id).toUpperCase()} · Privé`, robots: { index: false } };
}

export default function VerifyLayout({ children }) {
  return children;
}
