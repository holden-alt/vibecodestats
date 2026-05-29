import { ImageResponse } from 'next/og';

// Apple touch icon: same foil tier badge as app/icon.tsx, sized 180x180 for
// iOS home-screen pinning. iOS masks the corners, so we render full-bleed
// foil with the dark Orbitron-900 "S" centered.
export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const FOIL =
  'linear-gradient(110deg,#ff2db3 0%,#ff8a3c 18%,#ffe93c 34%,#3cff8a 52%,#3cd8ff 70%,#9b5cff 86%,#ff2db3 100%)';

export default async function AppleIcon() {
  const orbitron = await fetch(
    new URL('./Orbitron-900.ttf', import.meta.url),
  ).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: FOIL,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Orbitron',
            fontWeight: 900,
            fontSize: 140,
            color: '#08060f',
            lineHeight: 1,
            marginTop: -6,
          }}
        >
          S
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Orbitron', data: orbitron, weight: 900 as const, style: 'normal' as const },
      ],
    },
  );
}
