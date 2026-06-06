'use client';

import { useSyncExternalStore } from 'react';
import { colors } from '@/core/colors';
import { FOUNDING_LOCKIN_DEADLINE_ISO } from '@/core/foundingLockin';

type CountdownSnapshot = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  finished: boolean;
};

const DEADLINE_MS = Date.parse(FOUNDING_LOCKIN_DEADLINE_ISO);

// Per-second snapshot cache so useSyncExternalStore sees a referentially-stable
// value within a single second tick (the docs require the snapshot to be ===
// across calls when nothing changed, otherwise React tears).
let cachedBucket = -1;
let cachedSnapshot: CountdownSnapshot = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  finished: false,
};

function computeSnapshot(nowMs: number): CountdownSnapshot {
  const bucket = Math.floor(nowMs / 1000);
  if (bucket === cachedBucket) return cachedSnapshot;
  cachedBucket = bucket;

  const remainingMs = Math.max(0, DEADLINE_MS - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  cachedSnapshot = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    finished: remainingMs === 0,
  };
  return cachedSnapshot;
}

const subscribe = (callback: () => void) => {
  const id = window.setInterval(callback, 1000);
  return () => window.clearInterval(id);
};
const getSnapshot = () => computeSnapshot(Date.now());
const getServerSnapshot = (): CountdownSnapshot => cachedSnapshot;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function Unit({ value, label }: { value: number; label: string }) {
  const display = label === 'Days' ? value.toString() : pad(value);
  return (
    <div
      style={{
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 6px 10px',
        backgroundColor: 'var(--bg-elevated, rgba(255, 255, 255, 0.04))',
        border: `1px solid ${colors.primary}33`,
        borderRadius: 10,
        boxShadow: `inset 0 0 0 1px ${colors.primary}14, 0 1px 0 rgba(0,0,0,0.18)`,
      }}
    >
      <div
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '0.04em',
          color: colors.primary,
          fontVariantNumeric: 'tabular-nums',
        }}
        aria-hidden="true"
      >
        {display}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function FoundingLockinCountdown() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const ariaLabel = snapshot.finished
    ? 'Founding rate offer has ended'
    : `${snapshot.days} days, ${snapshot.hours} hours, ${snapshot.minutes} minutes, ${snapshot.seconds} seconds remaining`;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 18,
        padding: 10,
        borderRadius: 12,
        background: `linear-gradient(180deg, ${colors.primary}14 0%, ${colors.primary}05 100%)`,
        border: `1px solid ${colors.primary}33`,
      }}
    >
      <Unit value={snapshot.days} label="Days" />
      <Unit value={snapshot.hours} label="Hours" />
      <Unit value={snapshot.minutes} label="Minutes" />
      <Unit value={snapshot.seconds} label="Seconds" />
    </div>
  );
}
