'use client';

/**
 * Named boards: save the working board under a name, then switch between them.
 *
 * The live board still lives in the browser and still auto-saves on every
 * change — nothing here alters that. These are named copies kept on the
 * ACCOUNT, so they survive a new browser or a second machine, which is the
 * whole reason a member would trust one enough to rearrange the live board
 * freely.
 *
 * Shaped so that publishing a board to a shared library later is additive:
 * a published board is one of these rows plus a visibility flag, so the save,
 * list and apply paths here are the same ones that would serve it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { getCsrfToken } from '@/core/csrfClient';
import { sanitizeLayout, type DashboardLayout } from '@/core/myDashboardLayout';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

export type SavedBoard = {
  id: string;
  name: string;
  layout: unknown;
  createdAt: string;
  updatedAt: string;
};

async function call(
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: boolean; layouts?: SavedBoard[]; error?: string }> {
  const csrf = await getCsrfToken();
  const res = await fetch(path, {
    method: init.method,
    headers: {
      'content-type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as { layouts?: SavedBoard[]; error?: string };
  return { ok: res.ok, layouts: json.layouts, error: json.error };
}

export default function BoardSwitcher({
  layout,
  validWidgetIds,
  onApply,
}: {
  /** The working board, saved as-is when the member names it. */
  layout: DashboardLayout;
  /** Widget ids that exist in THIS release — see onApply. */
  validWidgetIds: ReadonlySet<string>;
  onApply: (layout: DashboardLayout) => void;
}) {
  const t = usePageT(dict);
  const [boards, setBoards] = useState<SavedBoard[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load lazily, on first open. A member who never opens the menu never pays
  // for the request, and signing out simply leaves the list empty.
  useEffect(() => {
    if (!open || boards !== null) return;
    let cancelled = false;
    void (async () => {
      const res = await call('/api/account/layouts', { method: 'GET' });
      if (cancelled) return;
      // A 401 is the ordinary signed-out case, not an error worth showing.
      setBoards(res.layouts ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, boards]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; layouts?: SavedBoard[]; error?: string }>) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      setBusy(false);
      if (!res.ok) {
        setError(res.error ?? t('boardsGenericError'));
        return false;
      }
      if (res.layouts) setBoards(res.layouts);
      return true;
    },
    [t],
  );

  const handleSave = useCallback(async () => {
    const suggested = '';
    const name = window.prompt(t('boardsSavePrompt'), suggested);
    if (name === null) return;
    if (!name.trim()) return;
    const existing = (boards ?? []).some((b) => b.name.toLowerCase() === name.trim().toLowerCase());
    // Saving over a name is how you update a board you have just rearranged,
    // so it is allowed — but never silently.
    if (existing && !window.confirm(t('boardsOverwriteConfirm', { name: name.trim() }))) return;
    await run(() => call('/api/account/layouts', { method: 'POST', body: { name, layout } }));
  }, [boards, layout, run, t]);

  const handleApply = useCallback(
    (board: SavedBoard) => {
      if (!window.confirm(t('boardsApplyConfirm', { name: board.name }))) return;
      // Sanitize against THIS release's widget registry: a board saved before a
      // widget was renamed or retired would otherwise try to render an id that
      // no longer exists. Same guard a shared board would need.
      onApply(sanitizeLayout(board.layout, validWidgetIds));
      setOpen(false);
    },
    [onApply, t, validWidgetIds],
  );

  const handleRename = useCallback(
    async (board: SavedBoard) => {
      const name = window.prompt(t('boardsRenamePrompt'), board.name);
      if (name === null || !name.trim() || name.trim() === board.name) return;
      await run(() => call(`/api/account/layouts/${board.id}`, { method: 'PATCH', body: { name } }));
    },
    [run, t],
  );

  const handleDelete = useCallback(
    async (board: SavedBoard) => {
      if (!window.confirm(t('boardsDeleteConfirm', { name: board.name }))) return;
      await run(() => call(`/api/account/layouts/${board.id}`, { method: 'DELETE' }));
    },
    [run, t],
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="zg-btn zg-btn--ghost"
        title={t('boardsTitle')}
      >
        <LayoutGrid size={15} /> {t('boards')} <ChevronDown size={13} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('boards')}
          className="absolute right-0 z-50 mt-2 rounded-lg border p-1.5 shadow-lg"
          style={{
            minWidth: 280,
            maxWidth: 360,
            background: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
          }}
        >
          {boards === null ? (
            <div className="zg-small px-2 py-3" style={{ color: 'var(--text-secondary)' }}>
              {t('boardsLoading')}
            </div>
          ) : boards.length === 0 ? (
            <div className="zg-small px-2 py-3" style={{ color: 'var(--text-secondary)' }}>
              {t('boardsEmpty')}
            </div>
          ) : (
            <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {boards.map((board) => (
                <div key={board.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleApply(board)}
                    disabled={busy}
                    className="zg-small min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left"
                    style={{ color: 'var(--text-primary)' }}
                    title={t('boardsApplyTitle', { name: board.name })}
                  >
                    {board.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRename(board)}
                    disabled={busy}
                    className="rounded p-1 opacity-60 hover:opacity-100"
                    aria-label={t('boardsRenameLabel', { name: board.name })}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(board)}
                    disabled={busy}
                    className="rounded p-1 opacity-60 hover:opacity-100"
                    aria-label={t('boardsDeleteLabel', { name: board.name })}
                    style={{ color: 'var(--color-bear)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="zg-caption px-2 py-1.5" style={{ color: 'var(--color-bear)' }}>
              {error}
            </div>
          )}

          <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSave()}
              disabled={busy}
              className="zg-small flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left"
              style={{ color: 'var(--color-accent-hot)' }}
            >
              <Plus size={14} /> {t('boardsSaveCurrent')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
