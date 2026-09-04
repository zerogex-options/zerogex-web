import { NextRequest, NextResponse } from 'next/server';
import { requireSession, validateCsrf } from '@/core/serverAuth';
import {
  MAX_SERIES_DAYS,
  buildDailySignalsSnapshot,
  importExternalMetrics,
  rebuildDailyMetrics,
  refreshDailyMetrics,
} from '@/core/dailyMetrics';
import { MAX_CSV_ROWS, parseExternalMetricsCsv, type MetricSource } from '@/core/dailyMetricsCsv';

export const dynamic = 'force-dynamic';

// Admin-only. Kept on its own route rather than folded into
// /api/admin/monitoring because it is the only monitoring surface with a WRITE
// (the CSV import), because its window is caller-chosen, and because the daily
// rollup rebuild shouldn't run on every poll of the main dashboard.

/** Refuse an oversized paste before it reaches the parser. ~2 MB of CSV. */
const MAX_CSV_BYTES = 2_000_000;

const VALID_SOURCES = new Set<MetricSource>(['x', 'google', 'combined']);

function adminOnly(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}

export async function GET(request: NextRequest) {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    return adminOnly(NextResponse.json({ error: 'Admin access required' }, { status: 403 }));
  }

  const params = request.nextUrl.searchParams;
  const requested = Number.parseInt(params.get('days') ?? '', 10);
  const days = Number.isFinite(requested) ? Math.max(7, Math.min(MAX_SERIES_DAYS, requested)) : 90;

  // `rebuild=1` forces a full recompute (the button in the panel); an ordinary
  // load takes the throttled path so a 60-second poll doesn't re-scan the audit
  // log every minute.
  try {
    if (params.get('rebuild') === '1') rebuildDailyMetrics();
    else refreshDailyMetrics();
  } catch {
    // A failed refresh must not blank the panel — serve whatever is stored.
  }

  try {
    const snapshot = buildDailySignalsSnapshot({ days });
    return adminOnly(NextResponse.json({ ok: true, ...snapshot }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build daily signals';
    return adminOnly(NextResponse.json({ error: message }, { status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  // CSRF first (double-submit), then session + admin tier — mirrors the other
  // state-changing admin routes.
  if (!validateCsrf(request)) {
    return adminOnly(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  }
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    return adminOnly(NextResponse.json({ error: 'Admin access required' }, { status: 403 }));
  }

  const body = (await request.json().catch(() => null)) as { source?: unknown; csv?: unknown } | null;
  if (!body || typeof body.csv !== 'string') {
    return adminOnly(NextResponse.json({ error: 'Expected { source, csv }' }, { status: 400 }));
  }
  if (body.csv.length > MAX_CSV_BYTES) {
    return adminOnly(
      NextResponse.json(
        { error: `That export is larger than ${Math.round(MAX_CSV_BYTES / 1_000_000)} MB — split it and import in parts.` },
        { status: 413 },
      ),
    );
  }
  const source = body.source as MetricSource;
  if (!VALID_SOURCES.has(source)) {
    return adminOnly(NextResponse.json({ error: 'source must be "x", "google" or "combined"' }, { status: 400 }));
  }

  const parsed = parseExternalMetricsCsv(body.csv, source);
  if (parsed.rows.length === 0) {
    return adminOnly(
      NextResponse.json(
        { error: parsed.errors[0] ?? 'Nothing to import.', errors: parsed.errors, mapping: parsed.mapping },
        { status: 400 },
      ),
    );
  }

  try {
    const imported = importExternalMetrics(parsed.rows.slice(0, MAX_CSV_ROWS));
    return adminOnly(
      NextResponse.json({
        ok: true,
        ...imported,
        // Parse warnings ride along with a successful import: some rows landing
        // is not the same as every row landing, and the caller should see which
        // lines were dropped.
        errors: parsed.errors,
        mapping: parsed.mapping,
        ignoredColumns: parsed.ignoredColumns,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return adminOnly(NextResponse.json({ error: message }, { status: 500 }));
  }
}
