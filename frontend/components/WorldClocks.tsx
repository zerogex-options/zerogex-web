'use client';

import { useState, useEffect } from 'react';
import { Theme, MarketSession } from '@/core/types';
import { colors } from '@/core/colors';

interface WorldClocksProps {
  theme: Theme;
  session: MarketSession;
  hideCountdown?: boolean;
  compact?: boolean;
}

// `time` is null until the clocks have started on the client. The dial still
// renders at full size so nothing shifts when the hands arrive.
function AnalogClock({ time, label, theme }: { time: Date | null; label: string; theme: Theme }) {
  const hours = (time?.getHours() ?? 0) % 12;
  const minutes = time?.getMinutes() ?? 0;
  const seconds = time?.getSeconds() ?? 0;

  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;
  const digital = time
    ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="70" height="70" viewBox="0 0 100 100">
        <title>{digital ? `${label}: ${digital}` : label}</title>
        <circle cx="50" cy="50" r="48" fill="none" stroke={'var(--text-secondary)'} strokeWidth="3" />
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 50 + 38 * Math.cos(angle);
          const y1 = 50 + 38 * Math.sin(angle);
          const x2 = 50 + 44 * Math.cos(angle);
          const y2 = 50 + 44 * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={'var(--text-secondary)'} strokeWidth="3" />;
        })}

        {time && (
          <>
            <line x1="50" y1="50" x2={50 + 25 * Math.sin((hourAngle * Math.PI) / 180)} y2={50 - 25 * Math.cos((hourAngle * Math.PI) / 180)} stroke={'var(--text-primary)'} strokeWidth="4" strokeLinecap="round" />
            <line x1="50" y1="50" x2={50 + 35 * Math.sin((minuteAngle * Math.PI) / 180)} y2={50 - 35 * Math.cos((minuteAngle * Math.PI) / 180)} stroke={'var(--text-primary)'} strokeWidth="3" strokeLinecap="round" />
            <line x1="50" y1="50" x2={50 + 38 * Math.sin((secondAngle * Math.PI) / 180)} y2={50 - 38 * Math.cos((secondAngle * Math.PI) / 180)} stroke={'var(--color-bear)'} strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        <circle cx="50" cy="50" r="4" fill={'var(--color-bear)'} />
      </svg>

      <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{label}</div>
    </div>
  );
}

function CompactTime({ time, label, theme }: { time: Date | null; label: string; theme: Theme }) {
  return (
    <div className="flex flex-col items-center">
      {/* tabular-nums keeps the placeholder exactly as wide as a real time. */}
      <div className="text-sm font-bold" style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
        {time ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
      </div>
      <div className="text-xs opacity-60" style={{ color: 'var(--text-primary)' }}>{label}</div>
    </div>
  );
}

type ClockTimes = { ny: Date; london: Date; tokyo: Date };

export default function WorldClocks({ theme, compact = false }: WorldClocksProps) {
  // Null until the effect below runs on the client. Seeding this with
  // `new Date()` meant the clock was rendered once on the server and again at
  // hydration, a second or so apart, which React reported as a hydration
  // mismatch and recovered from by rebuilding the subtree — intermittently,
  // since it only fired when a second boundary fell between the two renders.
  // It also rendered the machine's LOCAL time under the New York, London and
  // Tokyo labels until the first tick, because that seed skipped the timezone
  // conversion the effect does. Starting empty fixes both: the server and the
  // first client render agree, and the first time shown is already converted.
  const [times, setTimes] = useState<ClockTimes | null>(null);

  useEffect(() => {
    const updateAll = () => {
      const now = new Date();
      setTimes({
        ny: new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })),
        london: new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' })),
        tokyo: new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })),
      });
    };
    updateAll();
    const interval = setInterval(updateAll, 1000);
    return () => clearInterval(interval);
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <CompactTime time={times?.ny ?? null} label="NY" theme={theme} />
        <CompactTime time={times?.london ?? null} label="LON" theme={theme} />
        <CompactTime time={times?.tokyo ?? null} label="TYO" theme={theme} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <AnalogClock time={times?.ny ?? null} label="NEW YORK" theme={theme} />
      <AnalogClock time={times?.london ?? null} label="LONDON" theme={theme} />
      <AnalogClock time={times?.tokyo ?? null} label="TOKYO" theme={theme} />
    </div>
  );
}
