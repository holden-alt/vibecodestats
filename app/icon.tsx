import { ImageResponse } from 'next/og';

// Brand favicon: the tier badge — a foil-gradient square with a dark
// Orbitron-900 "S", matching the OG card tier badge
// (app/[handle]/opengraph-image.tsx:386-411). Dark letter on bright foil
// reads at a 16px tab thumbnail. Orbitron TTF co-located per the same
// per-route font convention as the OG routes.
export const runtime = 'edge';
export const size = { width: 48, height: 48 };
export const contentType = 'image/png';

const FOIL =
  'linear-gradient(110deg,#ff2db3 0%,#ff8a3c 18%,#ffe93c 34%,#3cff8a 52%,#3cd8ff 70%,#9b5cff 86%,#ff2db3 100%)';

export default async function Icon() {
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
            fontSize: 38,
            color: '#08060f',
            lineHeight: 1,
            marginTop: -2,
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
