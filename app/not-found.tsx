import Link from 'next/link';


export default function NotFound() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      color: '#7ad17a',
      background: '#0b0e0b',
    }}>
      <div style={{ fontSize: '2rem', color: '#ff7a7a' }}>404</div>
      <div style={{ marginTop: '0.5rem' }}>no vibecoder by that handle</div>
      <Link href="/" prefetch={false} style={{ marginTop: '1rem', color: '#7ad17a', textDecoration: 'underline' }}>
        $ cd ..
      </Link>
    </main>
  );
}
