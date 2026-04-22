'use client';

import { formatEtDate, formatEtTime } from '@/core/signalHelpers';

interface ChartTimeAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  dateTicks: Set<string>;
}

export default function ChartTimeAxisTick({ x = 0, y = 0, payload, dateTicks }: ChartTimeAxisTickProps) {
  const raw = payload?.value;
  const ts = raw == null ? '' : String(raw);
  const time = formatEtTime(ts);
  const showDate = dateTicks.has(ts);
  const date = showDate ? formatEtDate(ts) : '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="var(--color-text-secondary)"
        fontSize={11}
      >
        {time}
      </text>
      {date && (
        <text
          x={0}
          y={0}
          dy={26}
          textAnchor="middle"
          fill="var(--color-text-secondary)"
          fontSize={10}
          fontWeight={600}
        >
          {date}
        </text>
      )}
    </g>
  );
}
