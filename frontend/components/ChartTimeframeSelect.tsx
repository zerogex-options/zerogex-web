'use client';

export type ChartTimeframe = '1min' | '5min' | '15min' | '1hr' | '1day';

const CHART_TIMEFRAME_OPTIONS: Array<{ value: ChartTimeframe; label: string }> = [
  { value: '1min', label: '1 Min' },
  { value: '5min', label: '5 Min' },
  { value: '15min', label: '15 Min' },
  { value: '1hr', label: '1 Hour' },
  { value: '1day', label: '1 Day' },
];

interface ChartTimeframeSelectProps {
  value: ChartTimeframe;
  onChange: (value: ChartTimeframe) => void;
  className?: string;
}

export default function ChartTimeframeSelect({ value, onChange, className = 'mb-4 flex justify-end' }: ChartTimeframeSelectProps) {
  return (
    <div className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ChartTimeframe)}
        className="px-3 py-2 rounded-lg border text-sm font-semibold bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-text-secondary)]"
      >
        {CHART_TIMEFRAME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
