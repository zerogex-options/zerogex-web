/**
 * Canonical list of dashboard widget ids.
 *
 * Kept in a React-free module so the API route can validate a posted layout
 * without pulling the 'use client' widget components into the route bundle.
 * The registry in core/dashboardWidgets.tsx must stay in sync with this list.
 */

export const DASHBOARD_WIDGET_IDS = [
  'sec-market',
  'price',
  'net-gex',
  'gamma-flip',
  'max-pain',
  'sec-trade-bias',
  'trade-bias',
  'sec-signals',
  'composite-score',
  'signaled-trades',
  'sec-volatility',
  'volatility',
  'sec-gamma',
  'call-gex',
  'put-gex',
  'call-wall',
  'put-wall',
  'sec-sentiment',
  'net-flow',
  'net-premium',
  'put-call-ratio',
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DASHBOARD_LAYOUT_VERSION = 1;

const ID_SET = new Set<string>(DASHBOARD_WIDGET_IDS);

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string' && ID_SET.has(value);
}
