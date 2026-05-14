import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="font-mono text-center space-y-2">
        <p className="text-[color:var(--color-orange)]">404</p>
        <p className="text-[color:var(--color-dim)]">no vibecoder by that handle</p>
        <Link href="/" className="text-[color:var(--color-cyan)] underline">$ cd ..</Link>
      </div>
    </main>
  );
}
