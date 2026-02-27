'use client';

import { useState, useEffect } from 'react';
import { Theme, MarketSession } from '@/core/types';
import { colors } from '@/core/colors';

interface WorldClocksProps {
  theme: Theme;
  session: MarketSession;
}

function AnalogClock({ time, label, theme }: { time: Date; label: string; theme: Theme }) {
  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 100 100">
        {/* Clock face */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke={colors.muted}
          strokeWidth="2"
        />
        
        {/* Hour markers */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 50 + 40 * Math.cos(angle);
          const y1 = 50 + 40 * Math.sin(angle);
          const x2 = 50 + 44 * Math.cos(angle);
          const y2 = 50 + 44 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colors.muted}
              strokeWidth="2"
            />
          );
        })}

        {/* Hour hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 25 * Math.sin((hourAngle * Math.PI) / 180)}
          y2={50 - 25 * Math.cos((hourAngle * Math.PI) / 180)}
          stroke={theme === 'dark' ? colors.light : colors.dark}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Minute hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 35 * Math.sin((minuteAngle * Math.PI) / 180)}
          y2={50 - 35 * Math.cos((minuteAngle * Math.PI) / 180)}
          stroke={theme === 'dark' ? colors.light : colors.dark}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Second hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 38 * Math.sin((secondAngle * Math.PI) / 180)}
          y2={50 - 38 * Math.cos((secondAngle * Math.PI) / 180)}
          stroke={colors.bearish}
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx="50" cy="50" r="3" fill={colors.bearish} />
      </svg>
      
      <div className="text-sm font-semibold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>
        {label}
      </div>
      <div className="text-xs font-mono opacity-60">
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </div>
    </div>
  );
}

export default function WorldClocks({ theme, session }: WorldClocksProps) {
  const [times, setTimes] = useState({
    ny: new Date(),
    london: new Date(),
    tokyo: new Date(),
  });
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const updateAll = () => {
      const now = new Date();
      
      setTimes({
        ny: new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })),
        london: new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' })),
        tokyo: new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })),
      });

      // Calculate countdown
      const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

      if (session === 'open') {
        // Countdown to market close (4:00 PM ET)
        const closeTime = new Date(nyTime);
        closeTime.setHours(16, 0, 0, 0);
        const diff = closeTime.getTime() - nyTime.getTime();
        
        if (diff > 0) {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${h}h ${m}m ${s}s till close`);
        }
      } else if (session === 'pre-market') {
        // Countdown to market open (9:30 AM ET)
        const openTime = new Date(nyTime);
        openTime.setHours(9, 30, 0, 0);
        const diff = openTime.getTime() - nyTime.getTime();
        
        if (diff > 0) {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${h}h ${m}m ${s}s till open`);
        }
      } else {
        setCountdown('');
      }
    };

    updateAll();
    const interval = setInterval(updateAll, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-8">
        <AnalogClock time={times.ny} label="New York" theme={theme} />
        <AnalogClock time={times.london} label="London" theme={theme} />
        <AnalogClock time={times.tokyo} label="Tokyo" theme={theme} />
      </div>
      
      {countdown && (
        <div 
          className="text-sm font-semibold px-3 py-1.5 rounded-lg"
          style={{ 
            color: colors.bearish,
            backgroundColor: theme === 'dark' ? `${colors.bearish}15` : `${colors.bearish}10`,
          }}
        >
          {countdown}
        </div>
      )}
    </div>
  );
}
