'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Lock, Plus, Search, X } from 'lucide-react';

import {
  CATEGORY_META,
  CATEGORY_ORDER,
  WIDGETS,
  type WidgetCategory,
  type WidgetDef,
} from './registry';
import { WIDGET_SIZE_LABEL } from '@/core/myDashboardLayout';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './AddWidgetGallery.i18n';

export default function AddWidgetGallery({
  open,
  onClose,
  hasPro,
  presentIds,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  hasPro: boolean;
  presentIds: ReadonlySet<string>;
  onToggle: (widget: WidgetDef) => void;
}) {
  const t = usePageT(dict);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<WidgetCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return WIDGETS.filter((w) => {
      if (activeCat !== 'all' && w.category !== activeCat) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.blurb.toLowerCase().includes(q) ||
        CATEGORY_META[w.category].label.toLowerCase().includes(q)
      );
    });
  }, [query, activeCat]);

  const grouped = useMemo(() => {
    const map = new Map<WidgetCategory, WidgetDef[]>();
    for (const w of filtered) {
      const list = map.get(w.category) ?? [];
      list.push(w);
      map.set(w.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, widgets: map.get(c)! }));
  }, [filtered]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t('dialogLabel')}>
      {/* Scrim */}
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      />

      {/* Panel */}
      <div
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l shadow-2xl"
        style={{
          background: 'var(--bg-main)',
          borderColor: 'var(--border-default)',
          animation: 'zgSlideIn var(--dur-3, 320ms) var(--ease-standard, ease)',
        }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <h2 className="zg-h3">{t('title')}</h2>
            <p className="zg-caption" style={{ color: 'var(--text-muted)' }}>
              {t('subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <div
            className="flex items-center gap-2 rounded-lg border px-3"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-transparent py-2.5 text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')}>
                <X size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5 px-5 py-3">
          <CatChip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>
            {t('all')}
          </CatChip>
          {CATEGORY_ORDER.map((c) => (
            <CatChip key={c} active={activeCat === c} onClick={() => setActiveCat(c)}>
              {CATEGORY_META[c].label}
            </CatChip>
          ))}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          {grouped.length === 0 && (
            <p className="zg-small py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              {t('noResults', { query })}
            </p>
          )}
          {grouped.map(({ category, widgets }) => (
            <section key={category} className="mb-5">
              <h3 className="zg-label mb-2 mt-1">{CATEGORY_META[category].label}</h3>
              <div className="flex flex-col gap-2">
                {widgets.map((w) => (
                  <GalleryItem
                    key={w.id}
                    widget={w}
                    added={presentIds.has(w.id)}
                    locked={w.tier === 'pro' && !hasPro}
                    onToggle={() => onToggle(w)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <style>{`@keyframes zgSlideIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}

function CatChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--color-accent-hot)' : 'var(--border-default)'}`,
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        color: active ? 'var(--color-accent-hot)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function GalleryItem({
  widget,
  added,
  locked,
  onToggle,
}: {
  widget: WidgetDef;
  added: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  const t = usePageT(dict);
  const Icon = widget.icon;
  const sizeHint = WIDGET_SIZE_LABEL[widget.defaultSize];

  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3 transition-colors"
      style={{
        borderColor: added ? 'var(--color-accent-hot)' : 'var(--border-subtle)',
        background: added ? 'var(--color-accent-soft)' : 'var(--bg-card)',
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--bg-hover)', color: 'var(--color-accent-hot)' }}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {widget.title}
          </span>
          {widget.tier === 'pro' && (
            <span
              className="zg-chip"
              style={{ ['--chip-color' as string]: 'var(--color-accent-hot)' }}
            >
              {t('pro')}
            </span>
          )}
        </div>
        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {widget.blurb}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {sizeHint}
        </p>
      </div>

      {locked ? (
        <Link
          href="/pricing"
          className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold"
          style={{ background: 'var(--color-accent-hot)', color: 'var(--text-inverse)' }}
        >
          <Lock size={13} /> {t('upgrade')}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={added}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
          style={{
            border: `1px solid ${added ? 'var(--color-accent-hot)' : 'var(--border-strong)'}`,
            background: added ? 'transparent' : 'var(--color-accent-hot)',
            color: added ? 'var(--color-accent-hot)' : 'var(--text-inverse)',
          }}
        >
          {added ? (
            <>
              <Check size={13} /> {t('added')}
            </>
          ) : (
            <>
              <Plus size={13} /> {t('add')}
            </>
          )}
        </button>
      )}
    </div>
  );
}
