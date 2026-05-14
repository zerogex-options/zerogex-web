'use client';

import { useCallback, useEffect, useState } from 'react';
import { TierId } from '@/core/auth';

type SessionUser = {
  id: string;
  email: string;
  tier: TierId;
  disclaimerAcknowledgedAt?: string | null;
  disclaimerVersionAcknowledged?: string | null;
};

type SessionResponse = {
  authenticated: boolean;
  user?: SessionUser;
  expiresAt?: string;
};

export function useAuthSession() {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Don't short-circuit on NEXT_PUBLIC_AUTH_ENABLED here: that env var is
    // inlined into the client bundle at build time, so it can drift from the
    // server's runtime value. If a build is made without the flag set but the
    // server runs with it enabled, OAuth will create real sessions while the
    // browser would otherwise insist the user is signed out. Always ask the
    // server; if auth is disabled at runtime, the proxy 404s /api/auth/* and
    // we fall through to the unauthenticated branch below.
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      if (!response.ok) {
        setData({ authenticated: false });
        return;
      }
      const payload = (await response.json()) as SessionResponse;
      setData(payload);
    } catch {
      setData({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
