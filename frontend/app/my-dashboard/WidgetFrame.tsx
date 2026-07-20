'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Lock,
  Maximize2,
  RotateCw,
  X,
} from 'lucide-react';

import type { WidgetSize } from '@/core/myDashboardLayout';
import { WIDGET_SIZE_LABEL } from '@/core/myDashboardLayout';
import type { WidgetDef } from './registry';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './WidgetFrame.i18n';

const SIZE_SHORT: Record<WidgetSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };

// ── Per-widget error boundary ────────────────────────────────────────────────
// One broken widget (a bad API payload, a render throw) must never take down the
// whole board. Each widget body is isolated; a failure shows an inline retry.
class WidgetErrorBoundary extends Component<
  { children: ReactNode; resetKey: string | number },
  { error: boolean }
> {
  constructor(props: { children: ReactNode; resetKey: string | number }) {
    super(props);
    this.state = { error: false };
  }

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidUpdate(prev: { resetKey: string | number }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: false });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="zg-panel flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-5 text-center"
          style={{ borderColor: 'var(--color-bear-soft)' }}
        >
          <AlertTriangle size={20} style={{ color: 'var(--color-bear)' }} />
          <div className="zg-small" style={{ color: 'var(--text-secondary)' }}>
            This widget hit a snag loading its data.
          </div>
          <button
            type="button"
            onClick={() => this.setState({ error: false })}
            className="zg-btn zg-btn--secondary mt-1"
            style={{ padding: '6px 12px' }}
          >
            <RotateCw size={13} /> Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Locked (upgrade) placeholder ─────────────────────────────────────────────
// Shown in place of a Pro widget for a Basic member. Never mounts the widget's
// data-fetching component, so no gated endpoint is ever called.
function UpgradeCard({ widget }: { widget: WidgetDef }) {
  const t = usePageT(dict);
  const Icon = widget.icon;
  return (
    <div className="zg-panel relative flex h-full min-h-[160px] flex-col justify-between overflow-hidden p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(120% 120% at 100% 0%, var(--color-accent-soft) 0%, transparent 55%)',
        }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 className="zg-eyebrow" style={{ color: 'var(--text-secondary)' }}>
            {widget.title}
          </h3>
        </div>
        <span
          className="zg-chip"
          style={{ ['--chip-color' as string]: 'var(--color-accent-hot)' }}
        >
          <Lock size={11} /> {t('proLabel')}
        </span>
      </div>
      <div className="relative mt-3">
        <p className="zg-small mb-3" style={{ color: 'var(--text-secondary)' }}>
          {widget.blurb}
        </p>
        <Link href="/pricing" className="zg-btn zg-btn--primary" style={{ padding: '8px 14px' }}>
          {t('upgradeToPro')}
        </Link>
      </div>
    </div>
  );
}

export type WidgetFrameProps = {
  widget: WidgetDef;
  size: WidgetSize;
  editing: boolean;
  locked: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  resetKey: string | number;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  canMovePrev: boolean;
  canMoveNext: boolean;
};

export default function WidgetFrame({
  widget,
  size,
  editing,
  locked,
  isDragging,
  isDropTarget,
  resetKey,
  onResize,
  onRemove,
  onMovePrev,
  onMoveNext,
  canMovePrev,
  canMoveNext,
}: WidgetFrameProps) {
  const t = usePageT(dict);
  const cycleSize = () => {
    const sizes = widget.allowedSizes.length ? widget.allowedSizes : [size];
    const idx = sizes.indexOf(size);
    const next = sizes[(idx + 1) % sizes.length];
    onResize(next);
  };

  const body = locked ? (
    <UpgradeCard widget={widget} />
  ) : (
    <WidgetErrorBoundary resetKey={resetKey}>{widget.render()}</WidgetErrorBoundary>
  );

  return (
    <div
      className="relative h-full transition-[box-shadow,opacity] duration-200"
      style={{
        opacity: isDragging ? 0.4 : 1,
        borderRadius: 'var(--radius-panel)',
        boxShadow: editing
          ? isDropTarget
            ? '0 0 0 2px var(--color-accent-hot)'
            : '0 0 0 1.5px var(--border-strong)'
          : 'none',
        cursor: editing ? 'grab' : 'default',
      }}
    >
      {/* In edit mode, freeze widget interactivity so the whole tile is a clean
          drag surface (the toolbar re-enables pointer events on itself). */}
      <div className={editing ? 'pointer-events-none select-none h-full' : 'h-full'}>{body}</div>

      {editing && (
        // One control cluster, pinned top-right. Titles live top-left on every
        // tile, so keeping the controls on the right leaves them readable while
        // editing. The whole tile is the drag surface; the grip is the cue.
        <div
          className="pointer-events-auto absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border p-0.5"
          style={{
            borderColor: 'var(--border-default)',
            background: 'color-mix(in srgb, var(--bg-card) 92%, transparent)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <span
            className="flex h-6 w-5 items-center justify-center"
            style={{ color: 'var(--text-muted)', cursor: 'grab' }}
            title={t('dragToReorder')}
            aria-hidden
          >
            <GripVertical size={14} />
          </span>
          <FrameIconButton label={t('moveEarlier')} disabled={!canMovePrev} onClick={onMovePrev}>
            <ChevronLeft size={14} />
          </FrameIconButton>
          <FrameIconButton label={t('moveLater')} disabled={!canMoveNext} onClick={onMoveNext}>
            <ChevronRight size={14} />
          </FrameIconButton>
          {widget.allowedSizes.length > 1 && (
            <button
              type="button"
              onClick={cycleSize}
              title={t('resizeTitle', { label: WIDGET_SIZE_LABEL[size] })}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Maximize2 size={12} />
              {SIZE_SHORT[size]}
            </button>
          )}
          <FrameIconButton
            label={t('removeWidget', { title: widget.title })}
            onClick={onRemove}
            danger
          >
            <X size={14} />
          </FrameIconButton>
        </div>
      )}
    </div>
  );
}

function FrameIconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30"
      style={{ color: danger ? 'var(--color-bear)' : 'var(--text-secondary)' }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
