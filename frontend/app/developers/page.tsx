'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { useAuthSession } from '@/hooks/useAuthSession';
import { getCsrfToken } from '@/core/csrfClient';

// ---------------------------------------------------------------------------
// API payload types — mirror the FastAPI response_model shapes in
// src/api/routers/dev_portal.py. Keep these *narrow* (no over-eager
// optionality) so the linter catches an upstream field rename rather than
// silently rendering `undefined`.
// ---------------------------------------------------------------------------

type KeyInfo = {
  id: number;
  name: string;
  prefix: string;
  tier: 'analytics' | 'signals' | 'full' | null;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  active: boolean;
};

type KeyListResponse = {
  keys: KeyInfo[];
  limit_per_user: number;
};

type KeyCreateResponse = {
  key: KeyInfo;
  raw_key: string;
};

type UsageDayPoint = {
  day: string;
  request_count: number;
  error_count: number;
};

type UsageResponse = {
  points: UsageDayPoint[];
  total_requests: number;
  total_errors: number;
  window_days: number;
};

type UsageSummaryResponse = {
  current_month_requests: number;
  last_month_requests: number;
  last_30_days_requests: number;
  last_seen_at: string | null;
};

const SELLABLE_TIERS: Array<{ id: 'analytics' | 'signals'; label: string; blurb: string }> = [
  {
    id: 'analytics',
    label: 'Analytics',
    blurb: 'GEX, options flow, max-pain, technicals. The clean derived product.',
  },
  {
    id: 'signals',
    label: 'Signals',
    blurb: 'Analytics + the composite signal engine (MSI, components).',
  },
];

// ---------------------------------------------------------------------------
// Tiny presentational helpers — kept inline so the page stays a single file.
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

function relativeDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DevelopersPage() {
  const router = useRouter();
  const { data: session, loading: sessionLoading } = useAuthSession();

  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [keyLimit, setKeyLimit] = useState<number>(5);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTier, setCreateTier] = useState<'analytics' | 'signals'>('analytics');
  const [pendingId, setPendingId] = useState<number | null>(null);

  // The single-use raw key shown after create/rotate. Cleared on dismiss
  // and never persisted anywhere — the server keeps only the SHA-256 hash.
  const [freshSecret, setFreshSecret] = useState<{ name: string; raw: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Redirect logged-out users on first paint. We don't gate the page render
  // because the surrounding /middleware also enforces it; this is belt-and-
  // suspenders so a server-rendered first paint can't show a stale UI.
  useEffect(() => {
    if (sessionLoading) return;
    if (!session?.authenticated) {
      router.replace('/login?next=/developers');
    }
  }, [router, session, sessionLoading]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysRes, usageRes, summaryRes] = await Promise.all([
        fetch('/api/dev/keys', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/dev/usage?days=30', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/dev/usage/summary', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (!keysRes.ok) throw new Error(`Failed to load API keys (${keysRes.status})`);
      const keysJson = (await keysRes.json()) as KeyListResponse;
      setKeys(keysJson.keys);
      setKeyLimit(keysJson.limit_per_user);

      if (usageRes.ok) setUsage((await usageRes.json()) as UsageResponse);
      else setUsage({ points: [], total_requests: 0, total_errors: 0, window_days: 30 });

      if (summaryRes.ok) setSummary((await summaryRes.json()) as UsageSummaryResponse);
      else
        setSummary({
          current_month_requests: 0,
          last_month_requests: 0,
          last_30_days_requests: 0,
          last_seen_at: null,
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load developer portal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && session?.authenticated) {
      refresh();
    }
  }, [refresh, session, sessionLoading]);

  const activeCount = useMemo(() => keys.filter((k) => k.active).length, [keys]);
  const atLimit = activeCount >= keyLimit;

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating || atLimit) return;
    const trimmed = createName.trim();
    if (!trimmed) {
      setError('Key name is required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch('/api/dev/keys', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({ name: trimmed, tier: createTier }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || `Failed to create key (${res.status})`);
      }
      const created = (await res.json()) as KeyCreateResponse;
      setFreshSecret({ name: created.key.name, raw: created.raw_key });
      setCreateName('');
      setCopied(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const handleRotate = async (id: number) => {
    if (pendingId !== null) return;
    if (!window.confirm('Rotate this key? The old key will stop working immediately.')) return;
    setPendingId(id);
    setError(null);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/dev/keys/${id}/rotate`, {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'x-csrf-token': csrf } : {},
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || `Failed to rotate key (${res.status})`);
      }
      const created = (await res.json()) as KeyCreateResponse;
      setFreshSecret({ name: created.key.name, raw: created.raw_key });
      setCopied(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rotate key');
    } finally {
      setPendingId(null);
    }
  };

  const handleRevoke = async (id: number) => {
    if (pendingId !== null) return;
    if (!window.confirm('Revoke this key? Any service still using it will fail authentication.'))
      return;
    setPendingId(id);
    setError(null);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/dev/keys/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: csrf ? { 'x-csrf-token': csrf } : {},
      });
      if (!res.ok && res.status !== 204) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || `Failed to revoke key (${res.status})`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke key');
    } finally {
      setPendingId(null);
    }
  };

  const handleCopySecret = async () => {
    if (!freshSecret) return;
    try {
      await navigator.clipboard.writeText(freshSecret.raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked on insecure origins / older browsers.
      // The secret is still visible in the modal — user can select-and-copy.
    }
  };

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  if (sessionLoading || !session?.authenticated) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12 text-[var(--color-text-primary)]">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-[var(--color-text-primary)]">
      <header className="mb-10">
        <h1 className="mb-2 text-3xl font-bold">Developers</h1>
        <p className="max-w-3xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Programmatic access to ZeroGEX analytics. Mint an API key, point your code at{' '}
          <code className="rounded bg-[var(--color-surface-alt,var(--color-surface))] px-1 py-0.5">
            api.zerogex.io
          </code>
          , and call the same endpoints the website uses. Usage is metered per day; the chart below
          updates within an hour of each request.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="https://api.zerogex.io/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold transition hover:text-[var(--color-brand-primary)]"
          >
            API reference (Swagger)
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold transition hover:text-[var(--color-brand-primary)]"
          >
            Pricing & tiers
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--color-danger-soft,var(--color-border))] bg-[var(--color-danger-soft,transparent)] px-4 py-3 text-sm text-[var(--color-danger,var(--color-text-primary))]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <UsageSummary summary={summary} />
      <UsageChart usage={usage} />

      <section className="mt-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">API Keys</h2>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {activeCount} / {keyLimit} active
          </span>
        </div>

        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Create a new key
          </h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="text"
              required
              maxLength={128}
              placeholder="Key name (e.g. backtest-laptop)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            />
            <select
              value={createTier}
              onChange={(e) => setCreateTier(e.target.value as 'analytics' | 'signals')}
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            >
              {SELLABLE_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating || atLimit}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-surface,#000)] transition hover:opacity-90 disabled:opacity-50"
            >
              <KeyRound size={14} />
              {creating ? 'Creating…' : 'Create key'}
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            {SELLABLE_TIERS.find((t) => t.id === createTier)?.blurb}
          </p>
          {atLimit && (
            <p className="mt-2 text-xs text-[var(--color-warning,var(--color-text-secondary))]">
              You&apos;ve hit the active-key cap ({keyLimit}). Revoke an unused key to issue a new
              one.
            </p>
          )}
        </form>

        <KeyTable
          keys={keys}
          loading={loading}
          pendingId={pendingId}
          onRotate={handleRotate}
          onRevoke={handleRevoke}
        />
      </section>

      {freshSecret && (
        <SecretRevealModal
          name={freshSecret.name}
          raw={freshSecret.raw}
          copied={copied}
          onCopy={handleCopySecret}
          onDismiss={() => setFreshSecret(null)}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function UsageSummary({ summary }: { summary: UsageSummaryResponse | null }) {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <SummaryCard label="This month" value={summary?.current_month_requests ?? 0} />
      <SummaryCard label="Last 30 days" value={summary?.last_30_days_requests ?? 0} />
      <SummaryCard label="Last month" value={summary?.last_month_requests ?? 0} />
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{formatCount(value)}</div>
      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">requests</div>
    </div>
  );
}

function UsageChart({ usage }: { usage: UsageResponse | null }) {
  const data = useMemo(
    () =>
      (usage?.points ?? []).map((p) => ({
        day: relativeDay(p.day),
        requests: p.request_count,
      })),
    [usage],
  );

  if (!usage || data.length === 0) {
    return (
      <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Last 30 days
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No requests yet. Once you make a call against your API key, the daily counts will appear
          here within an hour.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        Last 30 days · {formatCount(usage.total_requests)} requests
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-border)', opacity: 0.2 }}
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number | undefined) => [formatCount(v ?? 0), 'Requests']}
              labelStyle={{ color: 'var(--color-text-secondary)' }}
            />
            <Bar dataKey="requests" fill="var(--color-brand-primary)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function KeyTable({
  keys,
  loading,
  pendingId,
  onRotate,
  onRevoke,
}: {
  keys: KeyInfo[];
  loading: boolean;
  pendingId: number | null;
  onRotate: (id: number) => void;
  onRevoke: (id: number) => void;
}) {
  if (loading && keys.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">
        Loading keys…
      </p>
    );
  }
  if (keys.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">
        No API keys yet. Create one above to get started.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Prefix</th>
            <th className="px-4 py-3 font-semibold">Tier</th>
            <th className="px-4 py-3 font-semibold">Created</th>
            <th className="px-4 py-3 font-semibold">Last used</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const busy = pendingId === key.id;
            return (
              <tr
                key={key.id}
                className="border-b border-[var(--color-border)] last:border-0 align-middle"
              >
                <td className="px-4 py-3 font-medium">{key.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                  {key.prefix}…
                </td>
                <td className="px-4 py-3 capitalize text-[var(--color-text-secondary)]">
                  {key.tier ?? '—'}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {formatDate(key.created_at)}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {formatDate(key.last_used_at)}
                </td>
                <td className="px-4 py-3">
                  {key.active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-soft,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--color-success,var(--color-text-primary))]">
                      <ShieldCheck size={12} /> Active
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-secondary)]">Revoked</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {key.active && (
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRotate(key.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold transition hover:text-[var(--color-brand-primary)] disabled:opacity-50"
                      >
                        <RefreshCw size={12} />
                        Rotate
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRevoke(key.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-semibold transition hover:text-[var(--color-danger,var(--color-text-primary))] disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                        Revoke
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SecretRevealModal({
  name,
  raw,
  copied,
  onCopy,
  onDismiss,
}: {
  name: string;
  raw: string;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-bold">New API key — copy it now</h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          This is the only time the raw key for <strong>{name}</strong> will be shown. Store it in a
          password manager or secret store. We keep only its SHA-256 hash; we can&apos;t recover it for
          you later.
        </p>
        <div className="mb-4 break-all rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt,transparent)] p-3 font-mono text-xs">
          {raw}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:text-[var(--color-brand-primary)]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-surface,#000)] transition hover:opacity-90"
          >
            I&apos;ve saved it
          </button>
        </div>
      </div>
    </div>
  );
}
