// Mix a hex color with white by `amount` (0..1). Used to derive a second
// shade of a row's brand color so stacked series stay visually distinct.
export function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${((1 << 24) | (nr << 16) | (ng << 8) | nb).toString(16).slice(1)}`;
}

// Extract "YYYY-MM-DDTHH" or "YYYY-MM-DD" from either the frontend bucket
// keys (already in that shape) or the backend `bucket_start` ISO-8601
// timestamps ("2026-05-26T11:00:00-04:00"). Falls back to the raw input
// when the shape doesn't match so labels never go blank.
export function formatHourLabel(bucket: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(bucket);
  if (!match) return bucket;
  return `${Number(match[2])}/${Number(match[3])} ${match[4]}:00`;
}

export function formatDayLabel(bucket: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(bucket);
  if (!match) return bucket;
  return `${Number(match[2])}/${Number(match[3])}`;
}

// Round a positive integer max up to a "nice" axis cap with evenly spaced
// integer ticks (e.g. 90 -> cap 100 with ticks 0/25/50/75/100).
export function niceYScale(value: number): { max: number; ticks: number[] } {
  if (value < 10) {
    const max = Math.max(4, Math.ceil(value));
    const ticks: number[] = [];
    for (let i = 0; i <= max; i++) ticks.push(i);
    return { max, ticks };
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let stepMul: number;
  if (normalized <= 1) stepMul = 0.2;
  else if (normalized <= 2) stepMul = 0.5;
  else if (normalized <= 4) stepMul = 1;
  else if (normalized <= 8) stepMul = 2;
  else stepMul = 2.5;
  const step = stepMul * magnitude;
  const max = Math.ceil(value / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v));
  return { max, ticks };
}
