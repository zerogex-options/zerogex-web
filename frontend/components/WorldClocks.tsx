'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Theme } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { colors } from '@/lib/colors';

interface WorldClocksProps {
  theme: Theme;
}

export default function WorldClocks({ theme }: WorldClocksProps) {
  const [times, setTimes] = useState({
    ny: formatTime('America/New_York'),
    london: formatTime('Europe/London'),
    tokyo: formatTime('Asia/Tokyo'),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimes({
        ny: formatTime('America/New_York'),
        london: formatTime('Europe/London'),
        tokyo: formatTime('Asia/Tokyo'),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 text-sm font-mono">
      <div className="flex items-center gap-1.5">
        <Clock size={14} className="opacity-60" />
        <span className="font-medium opacity-60">NY</span>
        <span className="font-semibold">{times.ny}</span>
      </div>
      <div className="w-px h-4 opacity-30" style={{ backgroundColor: theme === 'dark' ? colors.light : colors.dark }} />
      <div className="flex items-center gap-1.5">
        <span className="font-medium opacity-60">LON</span>
        <span className="font-semibold">{times.london}</span>
      </div>
      <div className="w-px h-4 opacity-30" style={{ backgroundColor: theme === 'dark' ? colors.light : colors.dark }} />
      <div className="flex items-center gap-1.5">
        <span className="font-medium opacity-60">TKY</span>
        <span className="font-semibold">{times.tokyo}</span>
      </div>
    </div>
  );
}
