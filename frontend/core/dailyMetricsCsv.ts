// Tolerant CSV reader for the two off-platform metric feeds the daily fact
// table can't derive for itself: X (Twitter) analytics and Google Search
// Console. Pure — no I/O — so the parser is unit-tested directly
// (tests/dailyMetricsMath.test.ts) rather than exercised through an upload.
//
// Why a parser at all instead of an API client: neither feed has credentials
// configured in this app (there is no X Analytics token and no Search Console
// OAuth client anywhere in the env surface), and both consoles export exactly
// the per-day CSV this table wants. A paste-the-export path is therefore the
// whole integration, and it backfills history the same day it is wired up
// instead of starting a fresh collection from zero.
//
// The two exports overlap on a bare `Impressions` column with different
// meanings, which is why `source` is an explicit argument rather than sniffed:
// guessing wrong would silently file Google's impressions as X's.

export type MetricSource = 'x' | 'google' | 'combined';

/** One imported day. Absent fields stay undefined and never overwrite a stored value. */
export type ExternalMetricRow = {
  day: string;
  xImpressions?: number;
  xProfileVisits?: number;
  googleClicks?: number;
  googleImpressions?: number;
};

export type CsvParseResult = {
  rows: ExternalMetricRow[];
  /** Human-readable problems, one per offending line (capped). */
  errors: string[];
  /** Which incoming header fed each field, for the "did it read my file right" readout. */
  mapping: Record<string, string>;
  /** Header cells that were understood as nothing — surfaced so a renamed export is obvious. */
  ignoredColumns: string[];
};

const MAX_REPORTED_ERRORS = 20;
/** Guard against a pasted multi-megabyte export blocking the event loop. */
export const MAX_CSV_ROWS = 5000;

// ---------------------------------------------------------------------------
// Lexing
// ---------------------------------------------------------------------------

/**
 * Split one delimited line, honoring RFC-4180 quoting: a quoted field may hold
 * the delimiter, and a doubled quote inside a quoted field is a literal quote.
 * X's exports quote their thousands-separated numbers ("1,234"), so this is
 * required, not defensive.
 */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** Comma or tab, whichever the header line actually uses. */
export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const US_DAY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Normalize a date cell to a 'YYYY-MM-DD' key, or null. Accepts the ISO form
 * both consoles emit and the M/D/YYYY form an English-locale spreadsheet
 * round-trip produces. Anything else is rejected rather than guessed — a
 * D/M/YYYY file silently read as M/D would shuffle a third of the year.
 */
export function normalizeDayKey(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const iso = ISO_DAY_RE.exec(value);
  if (iso) {
    const [, y, m, d] = iso;
    if (!isRealDate(Number(y), Number(m), Number(d))) return null;
    return `${y}-${m}-${d}`;
  }
  const us = US_DAY_RE.exec(value);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    if (!isRealDate(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Parse a metric cell. Strips thousands separators, a trailing %, and the
 * spaces some exports pad with. An empty cell is `undefined` (not measured),
 * which is different from 0 and must not become one.
 */
export function parseMetricValue(raw: string): number | undefined | null {
  const value = raw.trim();
  if (!value || value === '-' || value === '—' || value.toLowerCase() === 'n/a') return undefined;
  const cleaned = value.replace(/,/g, '').replace(/%$/, '').replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------

type Field = keyof Omit<ExternalMetricRow, 'day'>;

function canonical(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const DATE_HEADERS = new Set(['date', 'day', 'dates', 'reportdate']);

// Aliases per source. Matching is on the canonicalized header, so "Profile
// visits", "profile_visits" and "ProfileVisits" all land on the same field.
const X_ALIASES: Record<string, Field> = {
  impressions: 'xImpressions',
  ximpressions: 'xImpressions',
  postimpressions: 'xImpressions',
  tweetimpressions: 'xImpressions',
  views: 'xImpressions',
  profilevisits: 'xProfileVisits',
  xprofilevisits: 'xProfileVisits',
  profileviews: 'xProfileVisits',
  profileclicks: 'xProfileVisits',
};

const GOOGLE_ALIASES: Record<string, Field> = {
  clicks: 'googleClicks',
  googleclicks: 'googleClicks',
  urlclicks: 'googleClicks',
  impressions: 'googleImpressions',
  googleimpressions: 'googleImpressions',
};

// The combined shape is what this app's own CSV export emits, so its headers
// are unambiguous and both consoles' data can round-trip in one file.
const COMBINED_ALIASES: Record<string, Field> = {
  ximpressions: 'xImpressions',
  xprofilevisits: 'xProfileVisits',
  googleclicks: 'googleClicks',
  googleimpressions: 'googleImpressions',
  profilevisits: 'xProfileVisits',
};

function aliasesFor(source: MetricSource): Record<string, Field> {
  if (source === 'x') return X_ALIASES;
  if (source === 'google') return GOOGLE_ALIASES;
  return COMBINED_ALIASES;
}

/**
 * Read a per-day export into rows. Unknown columns are ignored (both consoles
 * ship a dozen we don't store), a malformed line is reported and skipped, and
 * a duplicated date keeps the LAST occurrence — re-exports append corrections
 * at the bottom.
 */
export function parseExternalMetricsCsv(text: string, source: MetricSource): CsvParseResult {
  const errors: string[] = [];
  const mapping: Record<string, string> = {};
  const ignoredColumns: string[] = [];
  const empty: CsvParseResult = { rows: [], errors, mapping, ignoredColumns };

  if (typeof text !== 'string' || !text.trim()) {
    errors.push('The file or pasted text was empty.');
    return empty;
  }

  // Strip a UTF-8 BOM (Search Console exports carry one) before anything reads
  // the first header cell, or "Date" arrives as "﻿Date" and never matches.
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  let headerIndex = lines.findIndex((line) => line.trim().length > 0);
  if (headerIndex === -1) {
    errors.push('The file or pasted text was empty.');
    return empty;
  }

  const delimiter = detectDelimiter(lines[headerIndex]);
  let headers = splitCsvLine(lines[headerIndex], delimiter);
  // Search Console prepends a title line ("Performance on Search…") above the
  // real header; if the first row has no date column, try the next one.
  if (!headers.some((h) => DATE_HEADERS.has(canonical(h)))) {
    const next = lines.findIndex((line, i) => i > headerIndex && line.trim().length > 0);
    if (next !== -1) {
      const candidate = splitCsvLine(lines[next], detectDelimiter(lines[next]));
      if (candidate.some((h) => DATE_HEADERS.has(canonical(h)))) {
        headerIndex = next;
        headers = candidate;
      }
    }
  }

  const dateColumn = headers.findIndex((h) => DATE_HEADERS.has(canonical(h)));
  if (dateColumn === -1) {
    errors.push('No "Date" column found. Export the per-day view (Search Console: the Dates tab; X: the daily account overview).');
    return empty;
  }
  mapping.day = headers[dateColumn] || 'Date';

  const aliases = aliasesFor(source);
  const columnField = new Map<number, Field>();
  const claimed = new Set<Field>();
  headers.forEach((header, index) => {
    if (index === dateColumn) return;
    const field = aliases[canonical(header)];
    // First column wins a field: X's export carries both "Impressions" and
    // "Media views", and only the first should own xImpressions.
    if (!field || claimed.has(field)) {
      if (header.trim()) ignoredColumns.push(header.trim());
      return;
    }
    claimed.add(field);
    columnField.set(index, field);
    mapping[field] = header.trim();
  });

  if (columnField.size === 0) {
    errors.push(
      source === 'google'
        ? 'No "Clicks" column found in this export.'
        : 'No "Impressions" or "Profile visits" column found in this export.',
    );
    return empty;
  }

  const byDay = new Map<string, ExternalMetricRow>();
  let scanned = 0;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (scanned >= MAX_CSV_ROWS) {
      errors.push(`Stopped after ${MAX_CSV_ROWS} rows — split the export and import it in parts.`);
      break;
    }
    scanned += 1;
    const cells = splitCsvLine(line, delimiter);
    const day = normalizeDayKey(cells[dateColumn] ?? '');
    if (!day) {
      if (errors.length < MAX_REPORTED_ERRORS) {
        errors.push(`Line ${i + 1}: unrecognized date "${(cells[dateColumn] ?? '').slice(0, 32)}" (expected YYYY-MM-DD or M/D/YYYY).`);
      }
      continue;
    }
    const row: ExternalMetricRow = byDay.get(day) ?? { day };
    let wroteAny = false;
    for (const [index, field] of columnField) {
      const parsed = parseMetricValue(cells[index] ?? '');
      if (parsed === null) {
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push(`Line ${i + 1}: "${(cells[index] ?? '').slice(0, 32)}" in ${mapping[field]} is not a number.`);
        }
        continue;
      }
      if (parsed === undefined) continue;
      row[field] = parsed;
      wroteAny = true;
    }
    if (wroteAny) byDay.set(day, row);
  }

  const rows = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  if (rows.length === 0 && errors.length === 0) {
    errors.push('No dated rows with values were found in this export.');
  }
  return { rows, errors, mapping, ignoredColumns: [...new Set(ignoredColumns)] };
}
