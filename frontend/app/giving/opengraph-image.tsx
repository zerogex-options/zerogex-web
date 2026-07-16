import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = '3% of every ZeroGEX subscription supports Folds of Honor';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Read the Proud Supporter badge from disk once at build/render and inline as
// a data URI so ImageResponse doesn't need network access to fetch it. The PNG
// ships via `make logo` into frontend/public/.
function getBadgeDataUri(): string {
  const badgePath = path.join(process.cwd(), 'public', 'folds-of-honor-proud-supporter.png');
  const buffer = fs.readFileSync(badgePath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

export default async function Image() {
  const badgeDataUri = getBadgeDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #00202E 0%, #042D3F 100%)',
          color: '#FFF1E6',
          fontFamily: 'sans-serif',
          padding: '64px',
          position: 'relative',
        }}
      >
        {/* Top accent bar — matches the site OG family */}
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

        {/* Left column — badge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginRight: 56,
          }}
        >
          <div
            style={{
              width: 380,
              height: 380,
              borderRadius: '50%',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 14,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeDataUri}
              alt=""
              width={352}
              height={352}
              style={{ width: 352, height: 352, objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Right column — text */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '6px 16px',
              borderRadius: 999,
              border: '1px solid #FF853166',
              background: '#FF853115',
              color: '#FF8531',
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              alignSelf: 'flex-start',
              marginBottom: 26,
            }}
          >
            Proud Supporter · Folds of Honor
          </div>
          <div
            style={{
              fontSize: 62,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-2px',
              color: '#FFF1E6',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex' }}>3% of every</div>
            <div style={{ display: 'flex' }}>ZeroGEX subscription</div>
            <div style={{ display: 'flex', color: '#FF8531' }}>funds military families.</div>
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 24,
              color: '#C8D8DF',
              lineHeight: 1.4,
              display: 'flex',
            }}
          >
            Educational scholarships for the spouses and children of fallen and disabled U.S. service members.
          </div>
        </div>

        {/* Footer band */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 64,
            right: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 26,
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
              fontSize: 22,
              color: '#FF8531',
              fontWeight: 700,
              display: 'flex',
            }}
          >
            zerogex.io/giving
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
