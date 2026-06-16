import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'SPX Gamma Levels — Call Wall, Put Wall, Gamma Flip';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #00202E 0%, #042D3F 100%)',
          color: '#FFF1E6',
          fontFamily: 'sans-serif',
          padding: '64px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: 'linear-gradient(90deg, #FF8531 0%, #FFD380 100%)',
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 44 }}>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              border: '1px solid #FF853166',
              background: '#FF853115',
              color: '#FF8531',
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Free · 15-min Delayed
          </div>
        </div>
        <div
          style={{
            fontSize: 90,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: '-2.5px',
            color: '#FFF1E6',
            maxWidth: 1080,
            display: 'flex',
          }}
        >
          SPX Gamma Levels — Today
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 32,
            color: '#C8D8DF',
            lineHeight: 1.4,
            maxWidth: 1030,
            display: 'flex',
          }}
        >
          Call wall, put wall, gamma flip, max pain, net dealer GEX — for SPX, SPY and QQQ. Updated every 15 minutes.
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: 64,
            right: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: '-0.5px',
              color: '#FFF1E6',
              display: 'flex',
            }}
          >
            ZeroGEX
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#FF8531',
              fontWeight: 700,
              display: 'flex',
            }}
          >
            zerogex.io/spx-gamma-levels
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
