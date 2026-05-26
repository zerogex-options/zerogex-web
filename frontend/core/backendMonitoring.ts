import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

const STATE_PATH =
  process.env.BACKEND_MONITORING_STATE_PATH ?? path.join('/home/ubuntu/monitoring/state.json');

export const BACKEND_SERVICES = [
  'zerogex-oa-ingestion',
  'zerogex-oa-analytics',
  'zerogex-oa-signals',
  'zerogex-oa-api',
] as const;

export type BackendService = (typeof BACKEND_SERVICES)[number];

export type BackendSnapshotPoint = {
  bucket: string;
  cpuAvg: number | null;
  cpuMax: number | null;
  memAvg: number | null;
  memMax: number | null;
  cycleAvg: number | null;
  cycleMax: number | null;
  cycleMedian: number | null;
  diskRootLatest: number | null;
  diskVarLogLatest: number | null;
  ingestionErrors: number;
  ingestionWarnings: number;
  analyticsErrors: number;
  analyticsWarnings: number;
  signalsErrors: number;
  signalsWarnings: number;
  apiErrors: number;
  apiWarnings: number;
};

export type BackendSnapshot = {
  hourly: BackendSnapshotPoint[];
  daily: BackendSnapshotPoint[];
  lastSampleIso: string | null;
  generatedAt: string;
};

type RawNumeric = number | null | undefined;

type RawMetricStats = {
  max?: RawNumeric;
  avg?: RawNumeric;
  median?: RawNumeric;
  latest?: RawNumeric;
};

type RawServiceCounts = Partial<Record<BackendService, RawNumeric>>;

type RawBucket = {
  bucket_start?: string;
  metrics?: {
    cpu_pct?: RawMetricStats;
    mem_pct?: RawMetricStats;
    cycle_time_s?: RawMetricStats & { count?: RawNumeric };
    disk_root_pct?: RawMetricStats;
    disk_var_log_pct?: RawMetricStats;
    errors_by_service?: RawServiceCounts;
    warnings_by_service?: RawServiceCounts;
  };
};

type RawState = {
  version?: number;
  last_sample_iso?: string | null;
  hourly?: RawBucket[];
  daily?: RawBucket[];
};

function toFloatOrNull(v: RawNumeric): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntCount(v: RawNumeric): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeBucket(raw: RawBucket | undefined): BackendSnapshotPoint {
  const m = raw?.metrics ?? {};
  const errors = m.errors_by_service ?? {};
  const warnings = m.warnings_by_service ?? {};
  return {
    bucket: raw?.bucket_start ?? '',
    cpuAvg: toFloatOrNull(m.cpu_pct?.avg),
    cpuMax: toFloatOrNull(m.cpu_pct?.max),
    memAvg: toFloatOrNull(m.mem_pct?.avg),
    memMax: toFloatOrNull(m.mem_pct?.max),
    cycleAvg: toFloatOrNull(m.cycle_time_s?.avg),
    cycleMax: toFloatOrNull(m.cycle_time_s?.max),
    cycleMedian: toFloatOrNull(m.cycle_time_s?.median),
    diskRootLatest: toFloatOrNull(m.disk_root_pct?.latest),
    diskVarLogLatest: toFloatOrNull(m.disk_var_log_pct?.latest),
    ingestionErrors: toIntCount(errors['zerogex-oa-ingestion']),
    ingestionWarnings: toIntCount(warnings['zerogex-oa-ingestion']),
    analyticsErrors: toIntCount(errors['zerogex-oa-analytics']),
    analyticsWarnings: toIntCount(warnings['zerogex-oa-analytics']),
    signalsErrors: toIntCount(errors['zerogex-oa-signals']),
    signalsWarnings: toIntCount(warnings['zerogex-oa-signals']),
    apiErrors: toIntCount(errors['zerogex-oa-api']),
    apiWarnings: toIntCount(warnings['zerogex-oa-api']),
  };
}

function readStateFromDisk(): RawState | null {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    return JSON.parse(raw) as RawState;
  } catch {
    return null;
  }
}

export function getBackendSnapshot(): BackendSnapshot {
  const state = readStateFromDisk();
  const hourly = Array.isArray(state?.hourly) ? state!.hourly.map(normalizeBucket) : [];
  const daily = Array.isArray(state?.daily) ? state!.daily.map(normalizeBucket) : [];
  return {
    hourly,
    daily,
    lastSampleIso: state?.last_sample_iso ?? null,
    generatedAt: new Date().toISOString(),
  };
}
