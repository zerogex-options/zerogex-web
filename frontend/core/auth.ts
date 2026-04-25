export const SESSION_COOKIE_NAME = 'zgx_session';
export const CSRF_COOKIE_NAME = 'zgx_csrf';

export const AUTH_TIERS = [
  { id: 'public', label: 'Public', rank: 0 },
  { id: 'starter', label: 'Starter', rank: 10 },
  { id: 'pro', label: 'Pro', rank: 20 },
  { id: 'elite', label: 'Elite', rank: 25 },
  { id: 'admin', label: 'Admin', rank: 30 },
] as const;

export type TierId = (typeof AUTH_TIERS)[number]['id'];

export type RouteAccessRule = {
  pattern: string;
  minimumTier: TierId;
};

const PUBLIC_ROUTE_PATTERNS = ['/', '/about', '/pricing', '/privacy', '/terms', '/login', '/register', '/unauthorized'] as const;

export const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
  // Advanced Signals — gated to Elite.
  { pattern: '/signal-score', minimumTier: 'elite' },
  { pattern: '/trading-signals', minimumTier: 'elite' },
  { pattern: '/advanced-signals', minimumTier: 'elite' },
  { pattern: '/eod-pressure', minimumTier: 'elite' },
  { pattern: '/squeeze-setup', minimumTier: 'elite' },
  { pattern: '/trap-detection', minimumTier: 'elite' },
  { pattern: '/0dte-position-imbalance', minimumTier: 'elite' },
  { pattern: '/gamma-vwap-confluence', minimumTier: 'elite' },
  { pattern: '/volatility-expansion', minimumTier: 'elite' },
  // Basic Signals — gated to Pro.
  { pattern: '/basic-signals', minimumTier: 'pro' },
  { pattern: '/tape-flow-bias', minimumTier: 'pro' },
  { pattern: '/skew-delta', minimumTier: 'pro' },
  { pattern: '/vanna-charm-flow', minimumTier: 'pro' },
  { pattern: '/dealer-delta-pressure', minimumTier: 'pro' },
  { pattern: '/gex-gradient', minimumTier: 'pro' },
  { pattern: '/positioning-trap', minimumTier: 'pro' },
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
  // Back-compat: existing users stored as 'basic' map to 'starter'.
  if (tier === 'basic') return 'starter';
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
