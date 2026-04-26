export const SESSION_COOKIE_NAME = 'zgx_session';
export const CSRF_COOKIE_NAME = 'zgx_csrf';

export const AUTH_TIERS = [
  { id: 'public', label: 'Public', rank: 0 },
  { id: 'basic', label: 'Basic', rank: 10 },
  { id: 'pro', label: 'Pro', rank: 20 },
  { id: 'admin', label: 'Admin', rank: 30 },
] as const;

export type TierId = (typeof AUTH_TIERS)[number]['id'];

export type RouteAccessRule = {
  pattern: string;
  minimumTier: TierId;
};

const PUBLIC_ROUTE_PATTERNS = ['/', '/about', '/pricing', '/privacy', '/terms', '/login', '/register', '/unauthorized'] as const;

export const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  // Advanced Signals — Pro only.
  { pattern: '/signal-score', minimumTier: 'pro' },
  { pattern: '/trading-signals', minimumTier: 'pro' },
  { pattern: '/advanced-signals', minimumTier: 'pro' },
  { pattern: '/eod-pressure', minimumTier: 'pro' },
  { pattern: '/squeeze-setup', minimumTier: 'pro' },
  { pattern: '/trap-detection', minimumTier: 'pro' },
  { pattern: '/0dte-position-imbalance', minimumTier: 'pro' },
  { pattern: '/gamma-vwap-confluence', minimumTier: 'pro' },
  { pattern: '/volatility-expansion', minimumTier: 'pro' },
  // Basic Signals — included with Basic.
  { pattern: '/basic-signals', minimumTier: 'basic' },
  { pattern: '/tape-flow-bias', minimumTier: 'basic' },
  { pattern: '/skew-delta', minimumTier: 'basic' },
  { pattern: '/vanna-charm-flow', minimumTier: 'basic' },
  { pattern: '/dealer-delta-pressure', minimumTier: 'basic' },
  { pattern: '/gex-gradient', minimumTier: 'basic' },
  { pattern: '/positioning-trap', minimumTier: 'basic' },
];

const TIER_RANKS: Record<TierId, number> = AUTH_TIERS.reduce(
  (acc, tier) => ({ ...acc, [tier.id]: tier.rank }),
  {} as Record<TierId, number>
);

function trimTrailingSlash(pathname: string) {
  if (pathname === '/') return pathname;
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function matchesPattern(pathname: string, pattern: string) {
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    return pathname === base || pathname.startsWith(`${base}/`);
  }

  return pathname === pattern;
}

export function normalizeTier(tier?: string | null): TierId {
  if (!tier) return 'public';
  // Back-compat: legacy tier ids fold into the current two-tier system.
  if (tier === 'starter') return 'basic';
  if (tier === 'elite') return 'pro';
  return AUTH_TIERS.some((candidate) => candidate.id === tier) ? (tier as TierId) : 'public';
}

export function isPublicRoute(pathname: string) {
  const normalized = trimTrailingSlash(pathname);
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => matchesPattern(normalized, pattern));
}

export function requiredTierForRoute(pathname: string): TierId | null {
  const normalized = trimTrailingSlash(pathname);

  if (isPublicRoute(normalized)) {
    return null;
  }

  const match = ROUTE_ACCESS_RULES.find((rule) => matchesPattern(normalized, rule.pattern));
  return match?.minimumTier ?? null;
}

export function hasTierAccess(currentTier: TierId, requiredTier: TierId | null) {
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== '1') {
    return true;
  }

  if (!requiredTier) {
    return true;
  }

  return TIER_RANKS[currentTier] >= TIER_RANKS[requiredTier];
}

export function hasRequiredTier(pathname: string, currentTier?: string | null) {
  return hasTierAccess(normalizeTier(currentTier), requiredTierForRoute(pathname));
}
