// Per-browser wall-alert preferences — conveniences only, never the source of
// truth for what a member is sent (that lives server-side on their rules).
//
// Desktop notifications are a property of THIS browser: permission is granted
// per origin per browser, so the opt-in is stored beside it in localStorage
// rather than on the account. Every access is guarded: storage can be absent
// (private mode, blocked site data) and the feature must degrade to "off".

const DESKTOP_KEY = 'zgx_wall_alerts_desktop';
// The newest alert id this browser has already announced (toast / desktop
// notification). Shared across tabs through localStorage, so three open tabs
// announce a new alert once, not three times.
const ANNOUNCED_KEY = 'zgx_wall_alerts_announced';

export type DesktopPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function desktopPermission(): DesktopPermission {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as DesktopPermission;
}

export function desktopEnabled(): boolean {
  if (desktopPermission() !== 'granted') return false;
  try {
    return window.localStorage.getItem(DESKTOP_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDesktopEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(DESKTOP_KEY, '1');
    else window.localStorage.removeItem(DESKTOP_KEY);
  } catch {
    /* storage unavailable — the toggle just won't persist */
  }
  notifyDesktopPref();
}

// Subscribers for useSyncExternalStore. A write in this tab does not fire
// 'storage' in this tab, so setDesktopEnabled notifies them itself; other tabs
// arrive through the 'storage' event.
const desktopListeners = new Set<() => void>();

export function subscribeDesktopPref(onChange: () => void): () => void {
  desktopListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === DESKTOP_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    desktopListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Make subscribers re-read, e.g. after the browser's permission prompt closes. */
export function notifyDesktopPref(): void {
  for (const onChange of desktopListeners) onChange();
}

export function lastAnnouncedId(): number {
  try {
    const n = Number(window.localStorage.getItem(ANNOUNCED_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Record ``id`` as announced; returns false if another tab already did. */
export function claimAnnouncement(id: number): boolean {
  try {
    if (lastAnnouncedId() >= id) return false;
    window.localStorage.setItem(ANNOUNCED_KEY, String(id));
    return true;
  } catch {
    return true;
  }
}
