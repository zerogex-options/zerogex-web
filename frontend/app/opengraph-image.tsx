import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'ZeroGEX — Real-Time Options Analytics';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 56 }}>
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
            Real-Time Options Analytics
          </div>
        </div>
        <div
          style={{
            fontSize: 132,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-4px',
            color: '#FFF1E6',
            display: 'flex',
          }}
        >
          ZeroGEX
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 36,
            color: '#C8D8DF',
            lineHeight: 1.35,
            maxWidth: 1000,
            display: 'flex',
          }}
        >
          Real-time gamma exposure, dealer positioning, gamma walls, and live options flow for SPX and 0DTE traders.
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
              fontSize: 24,
              color: '#FF8531',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            Free dashboard · no signup
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#C8D8DF',
              fontWeight: 700,
              display: 'flex',
            }}
          >
            zerogex.io
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
