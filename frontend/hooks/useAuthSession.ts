'use client';

import { useCallback, useEffect, useState } from 'react';
import { TierId } from '@/core/auth';

type SessionUser = {
  id: string;
  email: string;
  tier: TierId;
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
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
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
