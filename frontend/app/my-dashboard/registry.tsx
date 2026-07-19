'use client';

/**
 * The widget catalog — the set of "pieces of the site" a member can pull into
 * their custom board. Each entry declares its metadata (title, blurb, category,
 * plan tier, footprint) and a render() that mounts the reusable component.
 *
 * `feeds` lists the shared MyDashboardData feeds a widget reads, so the page can
 * poll only what the current board actually needs.
 */

import type { ReactNode } from 'react';
import {
  Activity,
  AlarmClock,
  BarChart3,
  CandlestickChart,
  Crosshair,
  Gauge,
  GitCompare,
  Grid2x2,
  LineChart,
  Radar,
  ScrollText,
  Signal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Waves,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { WidgetSize } from '@/core/myDashboardLayout';
import type { FeedKey } from './DashboardData';

import {
  PriceTile,
  NetGexTile,
  GammaFlipTile,
  MaxPainTile,
  CallGexTile,
  PutGexTile,
  CallWallTile,
  PutWallTile,
  NetFlowTile,
  NetPremiumTile,
  PutCallRatioTile,
  VixTile,
} from './tiles';
import {
  TodaysReadPanel,
  DealerExposuresPanel,
  PriceActionPanel,
  GammaPulseWidget,
  SignalsSynthesisPanel,
  TradeBiasPanel,
  ConfluencePanel,
  CompositeScorePanel,
  SignalScoreWidget,
  VolExpansionEventsWidget,
  EodPressureEventsWidget,
  VolatilityPanel,
  WorldClocksPanel,
} from './panels';

export type WidgetTier = 'basic' | 'pro';

export type WidgetCategory = 'overview' | 'gamma' | 'flow' | 'signals' | 'volatility' | 'tools';

export type WidgetDef = {
  id: string;
  title: string;
  /** One-line description shown in the add-widget gallery. */
  blurb: string;
  category: WidgetCategory;
  tier: WidgetTier;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  /** Shared data feeds this widget reads from MyDashboardData (empty = self-fetches). */
  feeds: FeedKey[];
  render: () => ReactNode;
};

export const CATEGORY_META: Record<WidgetCategory, { label: string; blurb: string }> = {
  overview: { label: 'Overview', blurb: 'At-a-glance market read' },
  gamma: { label: 'Gamma & GEX', blurb: 'Dealer positioning & key levels' },
  flow: { label: 'Options Flow', blurb: 'Live volume & premium' },
  signals: { label: 'Signals', blurb: 'Proprietary directional reads' },
  volatility: { label: 'Volatility', blurb: 'Implied-vol regime' },
  tools: { label: 'Tools', blurb: 'Utilities & context' },
};

export const CATEGORY_ORDER: WidgetCategory[] = [
  'overview',
  'gamma',
  'flow',
  'signals',
  'volatility',
  'tools',
];

export const WIDGETS: WidgetDef[] = [
  // ── Overview ──
  {
    id: 'price',
    title: 'Underlying Price',
    blurb: 'Live price with session change and day volume.',
    category: 'overview',
    tier: 'basic',
    icon: Wallet,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['quote', 'sessionCloses'],
    render: () => <PriceTile />,
  },
  {
    id: 'todays-read',
    title: "Today's Read",
    blurb: 'Auto-generated regime headline and lead — the day in a sentence.',
    category: 'overview',
    tier: 'basic',
    icon: ScrollText,
    defaultSize: 'md',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: ['gex', 'quote', 'sessionCloses', 'vol'],
    render: () => <TodaysReadPanel />,
  },
  {
    id: 'dealer-exposures',
    title: 'Dealer Strike Profile',
    blurb: 'The full strike profile — price, gamma-by-strike and open-interest panels.',
    category: 'overview',
    tier: 'basic',
    icon: BarChart3,
    defaultSize: 'xl',
    allowedSizes: ['lg', 'xl'],
    feeds: [],
    render: () => <DealerExposuresPanel />,
  },
  {
    id: 'price-action',
    title: 'Price Action',
    blurb: 'Candlestick chart of the underlying with selectable timeframe.',
    category: 'overview',
    tier: 'basic',
    icon: CandlestickChart,
    defaultSize: 'lg',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: [],
    render: () => <PriceActionPanel />,
  },

  // ── Gamma & GEX ──
  {
    id: 'net-gex',
    title: 'Net GEX',
    blurb: 'Dealer gamma at spot, with a 30-day historical-context badge.',
    category: 'gamma',
    tier: 'basic',
    icon: Activity,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['gex', 'historical'],
    render: () => <NetGexTile />,
  },
  {
    id: 'gamma-flip',
    title: 'Gamma Flip',
    blurb: 'The level where dealer gamma flips sign, with live distance from spot.',
    category: 'gamma',
    tier: 'basic',
    icon: Crosshair,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['gex', 'quote'],
    render: () => <GammaFlipTile />,
  },
  {
    id: 'max-pain',
    title: 'Max Pain',
    blurb: 'The options-pin strike, with live distance from spot.',
    category: 'gamma',
    tier: 'basic',
    icon: Target,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['gex', 'quote'],
    render: () => <MaxPainTile />,
  },
  {
    id: 'call-wall',
    title: 'Call Wall',
    blurb: 'Heaviest call open interest — the resistance level.',
    category: 'gamma',
    tier: 'basic',
    icon: TrendingDown,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['gex', 'quote'],
    render: () => <CallWallTile />,
  },
  {
    id: 'put-wall',
    title: 'Put Wall',
    blurb: 'Heaviest put open interest — the support level.',
    category: 'gamma',
    tier: 'basic',
    icon: TrendingUp,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['gex', 'quote'],
    render: () => <PutWallTile />,
  },
  {
    id: 'call-gex',
    title: 'Call GEX',
    blurb: 'Total gamma exposure from call options.',
    category: 'gamma',
    tier: 'basic',
    icon: BarChart3,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['gex'],
    render: () => <CallGexTile />,
  },
  {
    id: 'put-gex',
    title: 'Put GEX',
    blurb: 'Total gamma exposure from put options.',
    category: 'gamma',
    tier: 'basic',
    icon: BarChart3,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['gex'],
    render: () => <PutGexTile />,
  },
  {
    id: 'gamma-pulse',
    title: 'Gamma Pulse',
    blurb: 'Where today’s dealer gamma sits versus its own history.',
    category: 'gamma',
    tier: 'basic',
    icon: Waves,
    defaultSize: 'lg',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: [],
    render: () => <GammaPulseWidget />,
  },

  // ── Options Flow ──
  {
    id: 'net-flow',
    title: 'Net Flow',
    blurb: 'Cumulative call minus put contract volume this session.',
    category: 'flow',
    tier: 'basic',
    icon: LineChart,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['flow'],
    render: () => <NetFlowTile />,
  },
  {
    id: 'net-premium',
    title: 'Net Premium',
    blurb: 'Cumulative call minus put premium this session.',
    category: 'flow',
    tier: 'basic',
    icon: Wallet,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['flow'],
    render: () => <NetPremiumTile />,
  },
  {
    id: 'put-call-ratio',
    title: 'Put/Call Ratio',
    blurb: 'Session put volume divided by call volume.',
    category: 'flow',
    tier: 'basic',
    icon: GitCompare,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['flow'],
    render: () => <PutCallRatioTile />,
  },

  // ── Signals ──
  {
    id: 'signals-synthesis',
    title: 'Proprietary Signals',
    blurb: 'Composite MSI, signal breadth and regime triggers in one panel.',
    category: 'signals',
    tier: 'basic',
    icon: Sparkles,
    defaultSize: 'lg',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: [],
    render: () => <SignalsSynthesisPanel />,
  },
  {
    id: 'trade-bias',
    title: 'Trade Bias',
    blurb: 'Glance-first regime, directional bias and playbook read.',
    category: 'signals',
    tier: 'basic',
    icon: Signal,
    defaultSize: 'md',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: [],
    render: () => <TradeBiasPanel />,
  },
  {
    id: 'composite-score',
    title: 'Composite Score',
    blurb: 'The proprietary composite signal score on a single dial.',
    category: 'signals',
    tier: 'basic',
    icon: Gauge,
    defaultSize: 'md',
    allowedSizes: ['sm', 'md'],
    feeds: ['signalScore'],
    render: () => <CompositeScorePanel />,
  },
  {
    id: 'confluence-matrix',
    title: 'Confluence Matrix',
    blurb: 'How the basic signals line up with each other, at a glance.',
    category: 'signals',
    tier: 'basic',
    icon: Grid2x2,
    defaultSize: 'lg',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: [],
    render: () => <ConfluencePanel />,
  },
  {
    id: 'signal-score',
    title: 'Signal Score — Full Panel',
    blurb: 'The complete composite-score radar and component breakdown.',
    category: 'signals',
    tier: 'pro',
    icon: Radar,
    defaultSize: 'xl',
    allowedSizes: ['lg', 'xl'],
    feeds: [],
    render: () => <SignalScoreWidget />,
  },
  {
    id: 'vol-expansion-events',
    title: 'Volatility Expansion — Events',
    blurb: 'Timeline of volatility-expansion signal triggers vs price.',
    category: 'signals',
    tier: 'pro',
    icon: Activity,
    defaultSize: 'lg',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: [],
    render: () => <VolExpansionEventsWidget />,
  },
  {
    id: 'eod-pressure-events',
    title: 'EOD Pressure — Events',
    blurb: 'Timeline of end-of-day pressure signal triggers vs price.',
    category: 'signals',
    tier: 'pro',
    icon: Activity,
    defaultSize: 'lg',
    allowedSizes: ['md', 'lg', 'xl'],
    feeds: [],
    render: () => <EodPressureEventsWidget />,
  },

  // ── Volatility ──
  {
    id: 'volatility',
    title: 'Volatility Monitor',
    blurb: 'VIX/VXN level and momentum gauges.',
    category: 'volatility',
    tier: 'basic',
    icon: Gauge,
    defaultSize: 'md',
    allowedSizes: ['sm', 'md', 'lg'],
    feeds: [],
    render: () => <VolatilityPanel />,
  },
  {
    id: 'vix-level',
    title: 'Vol Index Level',
    blurb: 'Current VIX (or VXN for QQQ) with regime label.',
    category: 'volatility',
    tier: 'basic',
    icon: Activity,
    defaultSize: 'sm',
    allowedSizes: ['sm', 'md'],
    feeds: ['vol'],
    render: () => <VixTile />,
  },

  // ── Tools ──
  {
    id: 'world-clocks',
    title: 'World Clocks',
    blurb: 'New York, London and Tokyo session clocks.',
    category: 'tools',
    tier: 'basic',
    icon: AlarmClock,
    defaultSize: 'md',
    allowedSizes: ['sm', 'md'],
    feeds: [],
    render: () => <WorldClocksPanel />,
  },
];

export const WIDGET_MAP: Map<string, WidgetDef> = new Map(WIDGETS.map((w) => [w.id, w]));

export const WIDGET_IDS: ReadonlySet<string> = new Set(WIDGETS.map((w) => w.id));

export function getWidget(id: string): WidgetDef | undefined {
  return WIDGET_MAP.get(id);
}

// ── Starter presets ───────────────────────────────────────────────────────────
// Curated boards a member can drop in with one click. Pro presets include
// Pro-only widgets; a Basic member gets the Basic-safe subset when they apply
// one (the page filters by entitlement before seeding).

export type DashboardPreset = {
  id: string;
  name: string;
  blurb: string;
  tier: WidgetTier;
  widgets: { widgetId: string; size: WidgetSize }[];
};

export const PRESETS: DashboardPreset[] = [
  {
    id: 'traders-overview',
    name: "Trader's Overview",
    blurb: 'The essentials: price, key levels, regime read and the dealer chart.',
    tier: 'basic',
    widgets: [
      { widgetId: 'todays-read', size: 'xl' },
      { widgetId: 'price', size: 'sm' },
      { widgetId: 'net-gex', size: 'sm' },
      { widgetId: 'gamma-flip', size: 'sm' },
      { widgetId: 'max-pain', size: 'sm' },
      { widgetId: 'dealer-exposures', size: 'xl' },
      { widgetId: 'trade-bias', size: 'lg' },
    ],
  },
  {
    id: 'flow-focus',
    name: 'Flow Focus',
    blurb: 'Live options flow with the walls that frame it.',
    tier: 'basic',
    widgets: [
      { widgetId: 'net-flow', size: 'sm' },
      { widgetId: 'net-premium', size: 'sm' },
      { widgetId: 'put-call-ratio', size: 'sm' },
      { widgetId: 'call-wall', size: 'sm' },
      { widgetId: 'put-wall', size: 'sm' },
      { widgetId: 'dealer-exposures', size: 'xl' },
      { widgetId: 'price-action', size: 'lg' },
    ],
  },
  {
    id: 'gamma-command',
    name: 'Gamma Command',
    blurb: 'Everything dealer-gamma: levels, GEX split, pulse and the chart.',
    tier: 'basic',
    widgets: [
      { widgetId: 'net-gex', size: 'sm' },
      { widgetId: 'call-gex', size: 'sm' },
      { widgetId: 'put-gex', size: 'sm' },
      { widgetId: 'gamma-flip', size: 'sm' },
      { widgetId: 'dealer-exposures', size: 'xl' },
      { widgetId: 'gamma-pulse', size: 'lg' },
    ],
  },
  {
    id: 'signals-command',
    name: 'Signals Command Center',
    blurb: 'The full signal stack — synthesis, score radar and event timelines.',
    tier: 'pro',
    widgets: [
      { widgetId: 'composite-score', size: 'md' },
      { widgetId: 'trade-bias', size: 'md' },
      { widgetId: 'signals-synthesis', size: 'xl' },
      { widgetId: 'signal-score', size: 'xl' },
      { widgetId: 'vol-expansion-events', size: 'lg' },
      { widgetId: 'eod-pressure-events', size: 'lg' },
    ],
  },
];
