/**
 * Server-side persistence for per-user dashboard layouts.
 *
 * React-free on purpose: this is imported by the API route, which must not
 * pull the 'use client' widget registry into its bundle.
 */

import { getDb } from '@/core/db';
import {
  DASHBOARD_LAYOUT_VERSION,
  DASHBOARD_WIDGET_IDS,
  isDashboardWidgetId,
} from '@/core/dashboardWidgetIds';

export type StoredWidget = { id: string; visible: boolean };

const MAX_WIDGETS = DASHBOARD_WIDGET_IDS.length;

/**
 * Coerce arbitrary client input into a clean layout: drop unknown/duplicate
 * ids, force `visible` to a boolean, cap the length. Returns null when there
 * is nothing usable so callers can reject the request.
 */
export function sanitizeLayout(input: unknown): StoredWidget[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: StoredWidget[] = [];
  for (const raw of input) {
    if (out.length >= MAX_WIDGETS) break;
    if (!raw || typeof raw !== 'object') continue;
    const id = (raw as { id?: unknown }).id;
    if (!isDashboardWidgetId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, visible: (raw as { visible?: unknown }).visible !== false });
  }
  return out.length > 0 ? out : null;
}

export function getDashboardLayout(userId: string): { widgets: StoredWidget[]; version: number } | null {
  const row = getDb()
    .prepare('SELECT layout, version FROM dashboard_layouts WHERE user_id = ?')
    .get(userId) as { layout: string; version: number } | undefined;
  if (!row) return null;

  try {
    const parsed = JSON.parse(row.layout) as unknown;
    const widgets = sanitizeLayout(parsed);
    if (!widgets) return null;
    return { widgets, version: row.version };
  } catch {
    return null;
  }
}

export function saveDashboardLayout(userId: string, widgets: StoredWidget[]): void {
  getDb()
    .prepare(
      `INSERT INTO dashboard_layouts (user_id, layout, version, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         layout = excluded.layout,
         version = excluded.version,
         updated_at = excluded.updated_at`
    )
    .run(userId, JSON.stringify(widgets), DASHBOARD_LAYOUT_VERSION, new Date().toISOString());
}
