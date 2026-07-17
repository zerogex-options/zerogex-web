import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Real-Time GEX for 0DTE Traders';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 50 }}>
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
            For 0DTE Traders
          </div>
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: '-2.5px',
            color: '#FFF1E6',
            maxWidth: 1050,
            display: 'flex',
          }}
        >
          Real-Time GEX. Live Dealer Book.
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 32,
            color: '#C8D8DF',
            lineHeight: 1.4,
            maxWidth: 1000,
            display: 'flex',
          }}
        >
          Gamma flip, call and put walls, dealer positioning, and composite signals — built for SPX and 0DTE intraday flow.
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
            Free gamma levels · zerogex.io
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
