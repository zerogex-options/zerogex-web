'use client';

/**
 * Keeps a signed-in member's working board on their account.
 *
 * The board used to live only in localStorage, so a browser that cleared its
 * site data (Brave's shields, Safari's ITP, a cleared cache) took it with it.
 * The browser copy stays — it is what signed-out visitors get, and a cache —
 * but for a member the account copy is the source of truth: the board opens
 * from it (see chooseWorkingBoard) and every change is saved back to it.
 *
 * Changes are sent after a short quiet period, one request at a time, each
 * carrying the latest board. Until the account confirms a change, the browser
 * flags it unsynced, so a save that never lands (offline, a failed request,
 * the tab closed first) is sent again on the next load instead of being
 * overwritten by the account's older copy.
 */

import { useCallback, useEffect, useRef } from 'react';
import { getCsrfToken } from '@/core/csrfClient';
import {
  chooseWorkingBoard,
  emptyLayout,
  hasBoardSynced,
  isBoardUnsynced,
  isLayoutEmpty,
  loadLayout,
  sanitizeLayout,
  setBoardUnsynced,
  type DashboardLayout,
} from '@/core/myDashboardLayout';

/** Quiet period after the last change: a drag or a run of resizes is one save. */
const SAVE_DELAY_MS = 800;
/** Browsers cap a keepalive request at 64 KB; anything larger goes without it. */
const KEEPALIVE_MAX_CHARS = 60 * 1024;
/** Waits before each retry of the first read. */
const READ_RETRY_DELAYS_MS = [500, 1500];

type AccountRead = { ok: true; layout: unknown } | { ok: false };

async function readAccountBoard(): Promise<AccountRead> {
  try {
    const res = await fetch('/api/account/board', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { layout?: unknown };
    return { ok: true, layout: json.layout ?? null };
  } catch {
    return { ok: false };
  }
}

async function writeAccountBoard(serialized: string): Promise<boolean> {
  try {
    const csrf = await getCsrfToken();
    if (!csrf) return false;
    const body = `{"layout":${serialized}}`;
    const res = await fetch('/api/account/board', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body,
      credentials: 'same-origin',
      cache: 'no-store',
      // Lets a save that starts as the tab closes still arrive.
      keepalive: body.length <= KEEPALIVE_MAX_CHARS,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Save `layout` as a named board on the account (the Boards menu). */
async function saveNamedBoard(name: string, layout: DashboardLayout): Promise<boolean> {
  try {
    const csrf = await getCsrfToken();
    if (!csrf) return false;
    const res = await fetch('/api/account/layouts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ name, layout }),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * @param keptBoardName Name for a board this browser held before boards were
 *   kept on the account, when it has to make way for the account's copy. A
 *   template: `{date}` is replaced with the current date and time.
 */
export function useAccountBoard(
  scope: string | null,
  validWidgetIds: ReadonlySet<string>,
  keptBoardName: string,
) {
  const scopeRef = useRef<string | null>(scope);
  // On for a signed-in member whose account copy was read this page view.
  const enabledRef = useRef(false);
  // The serialized board the account is known to hold, and the page's latest.
  const confirmedRef = useRef<string | null>(null);
  const latestRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // A save already running picks up the latest board when it finishes.
    if (!enabledRef.current || savingRef.current) return;
    const saveScope = scopeRef.current;
    const sent = latestRef.current;
    if (sent === null) return;
    if (sent === confirmedRef.current) {
      setBoardUnsynced(saveScope, false);
      return;
    }

    savingRef.current = true;
    const ok = await writeAccountBoard(sent);
    savingRef.current = false;
    if (scopeRef.current !== saveScope) return;

    if (ok) confirmedRef.current = sent;
    if (latestRef.current === confirmedRef.current) {
      setBoardUnsynced(saveScope, false);
    } else if (ok) {
      // Changed again while that save was running.
      void save();
    }
    // A failed save leaves the unsynced flag set: the next change, or the
    // next page load, sends the board again.
  }, []);

  /**
   * Resolve the board to open with. Reads the account copy for a signed-in
   * member and picks between it and this browser's copy.
   */
  const load = useCallback(
    async (isCancelled: () => boolean): Promise<DashboardLayout> => {
      // A save still waiting from before is dropped, not lost: its board is
      // flagged unsynced in this browser, so the read below picks it up.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      scopeRef.current = scope;
      enabledRef.current = false;
      confirmedRef.current = null;
      latestRef.current = null;

      const browser = loadLayout(scope, validWidgetIds);
      if (!scope) return browser ?? emptyLayout();

      let read: AccountRead = { ok: false };
      for (let attempt = 0; ; attempt += 1) {
        read = await readAccountBoard();
        if (read.ok || isCancelled() || attempt >= READ_RETRY_DELAYS_MS.length) break;
        await wait(READ_RETRY_DELAYS_MS[attempt]);
      }
      // Unreadable: open this browser's copy and leave the account alone for
      // this page view. Saving over a copy that could not be read might
      // replace the member's board with an empty one from a cleared browser.
      if (!read.ok) return browser ?? emptyLayout();

      const account = read.layout == null ? null : sanitizeLayout(read.layout, validWidgetIds);
      const chosen = chooseWorkingBoard({ account, browser, browserUnsynced: isBoardUnsynced(scope) });

      // Boards used to live in each browser separately, so a member who used
      // two browsers can hold two different boards. The first to load after
      // the account kept one uploaded its board; this browser's board, never
      // synced and different, is about to be replaced by it. Keep it under
      // Boards first rather than lose it. If that cannot be saved, open this
      // browser's board with syncing off: nothing is overwritten, and the next
      // load tries again.
      if (
        chosen === account &&
        browser &&
        !hasBoardSynced(scope) &&
        !isLayoutEmpty(browser) &&
        JSON.stringify(browser) !== JSON.stringify(account)
      ) {
        const stamp = new Date().toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const kept = await saveNamedBoard(keptBoardName.replace('{date}', stamp), browser);
        if (!kept || isCancelled()) return browser;
      }

      enabledRef.current = true;
      confirmedRef.current = account ? JSON.stringify(account) : null;
      return chosen;
    },
    [scope, validWidgetIds, keptBoardName],
  );

  /** Record the board as it stands now, and save it to the account shortly. */
  const noteChange = useCallback(
    (layout: DashboardLayout) => {
      if (!enabledRef.current || scopeRef.current !== scope) return;
      const serialized = JSON.stringify(layout);
      latestRef.current = serialized;

      if (serialized === confirmedRef.current && !savingRef.current) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setBoardUnsynced(scope, false);
        return;
      }

      // Until the account confirms it, this browser holds the only copy.
      setBoardUnsynced(scope, true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    [scope, save],
  );

  // Send a waiting change straight away when the member leaves: another page
  // in the app (unmount), or the tab closing or going to the background.
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) void save();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [save]);

  return { load, noteChange };
}
