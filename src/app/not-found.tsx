import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="screen">
      <header className="band">
        <h1 className="title">Out of bounds</h1>
        <div className="sub">That page doesn&apos;t exist.</div>
      </header>
      <div className="footer-actions">
        <Link href="/" className="btn-yellow">
          Back home
        </Link>
      </div>
    </main>
  );
}
