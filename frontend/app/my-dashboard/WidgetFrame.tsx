'use client';

import {
  Component,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Lock,
  Maximize2,
  RotateCw,
  X,
} from 'lucide-react';

import type { WidgetSize } from '@/core/myDashboardLayout';
import { WIDGET_COLSPAN, WIDGET_SIZE_LABEL } from '@/core/myDashboardLayout';
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
  /** The widget-grid container, read for live column geometry while resizing. */
  gridRef: RefObject<HTMLDivElement | null>;
  onResize: (size: WidgetSize) => void;
  /** Fired when an edge-drag resize begins/ends, so the grid can suspend its
   *  native drag-to-reorder for the duration of the gesture. */
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onRemove: () => void;
  /** Drop a second copy of this widget beside it (side-by-side comparison). */
  onDuplicate: () => void;
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
  gridRef,
  onResize,
  onResizeStart,
  onResizeEnd,
  onRemove,
  onDuplicate,
  onMovePrev,
  onMoveNext,
  canMovePrev,
  canMoveNext,
}: WidgetFrameProps) {
  const t = usePageT(dict);
  const rootRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const allowedSizes = widget.allowedSizes.length ? widget.allowedSizes : [size];
  const canResize = allowedSizes.length > 1;
  // Ascending by grid footprint — used for the size picker, drag-snap and
  // keyboard stepping alike.
  const sortedSizes = [...allowedSizes].sort((a, b) => WIDGET_COLSPAN[a] - WIDGET_COLSPAN[b]);

  // Drag the right-edge handle to resize width. Column geometry is read live
  // from the grid (so it's correct at any breakpoint / container width), the
  // pointer's x maps to a fractional column span, and we snap to the nearest
  // *allowed* footprint and apply it live as the pointer moves.
  const beginPointerResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    const root = rootRef.current;
    if (!canResize || !grid || !root) return;
    e.preventDefault();
    e.stopPropagation();

    const gs = getComputedStyle(grid);
    const cols = gs.gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const gap = parseFloat(gs.columnGap) || 16;
    const colWidth = (grid.getBoundingClientRect().width - gap * (cols - 1)) / cols;
    const startLeft = root.getBoundingClientRect().left;

    // Capture the node + pointer id synchronously: React nulls the synthetic
    // event's currentTarget once this handler returns, but the deferred
    // pointerup cleanup below still needs both.
    const handleEl = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      handleEl.setPointerCapture(pointerId);
    } catch {
      /* pointer capture unsupported — the window listeners still track the drag */
    }
    document.body.classList.add('zg-col-resizing');
    onResizeStart();
    setResizing(true);

    let lastSize = size;
    const snap = (clientX: number): WidgetSize => {
      const rawSpan = (clientX - startLeft + gap) / (colWidth + gap);
      let best = sortedSizes[0];
      let bestDist = Infinity;
      for (const s of sortedSizes) {
        const d = Math.abs(WIDGET_COLSPAN[s] - rawSpan);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      return best;
    };
    const onMove = (ev: PointerEvent) => {
      const next = snap(ev.clientX);
      if (next !== lastSize) {
        lastSize = next;
        onResize(next);
      }
    };
    const end = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      document.body.classList.remove('zg-col-resizing');
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {
        /* nothing to release */
      }
      setResizing(false);
      onResizeEnd();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  // Keyboard parity for the handle: arrows step through the allowed footprints.
  const stepSizeByKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canResize) return;
    const idx = sortedSizes.indexOf(size);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = sortedSizes[Math.min(sortedSizes.length - 1, idx + 1)];
      if (next !== size) onResize(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = sortedSizes[Math.max(0, idx - 1)];
      if (next !== size) onResize(next);
    }
  };

  const body = locked ? (
    <UpgradeCard widget={widget} />
  ) : (
    <WidgetErrorBoundary resetKey={resetKey}>{widget.render()}</WidgetErrorBoundary>
  );

  return (
    <div
      ref={rootRef}
      className="relative h-full transition-[box-shadow,opacity] duration-200"
      style={{
        opacity: isDragging ? 0.4 : 1,
        borderRadius: 'var(--radius-panel)',
        boxShadow: editing
          ? isDropTarget || resizing
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
          {canResize && size === 'sm' && (
            // A small tile has no room for the full picker without burying its
            // title, so it keeps the compact stepper: one click to the next
            // footprint up, wrapping back to the smallest.
            <button
              type="button"
              onClick={() => onResize(sortedSizes[(sortedSizes.indexOf(size) + 1) % sortedSizes.length])}
              title={t('resizeTitle', { label: WIDGET_SIZE_LABEL[size] })}
              aria-label={t('resizeTitle', { label: WIDGET_SIZE_LABEL[size] })}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Maximize2 size={12} />
              {SIZE_SHORT[size]}
            </button>
          )}
          {canResize && size !== 'sm' && (
            // Every allowed footprint is one click away (S / M / L / XL) rather
            // than a cycle — going from XL down to M to sit two charts side by
            // side shouldn't take three clicks.
            <div
              className="flex items-center rounded-md"
              role="group"
              aria-label={t('resizeTitle', { label: WIDGET_SIZE_LABEL[size] })}
              style={{ background: 'var(--bg-hover)' }}
            >
              <Maximize2 size={12} style={{ color: 'var(--text-muted)', margin: '0 2px 0 4px' }} />
              {sortedSizes.map((s) => {
                const active = s === size;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onResize(s)}
                    aria-pressed={active}
                    title={WIDGET_SIZE_LABEL[s]}
                    aria-label={WIDGET_SIZE_LABEL[s]}
                    className="flex h-6 min-w-[18px] items-center justify-center rounded-md px-1 text-[10px] font-bold transition-colors"
                    style={{
                      color: active ? 'var(--color-accent-hot)' : 'var(--text-secondary)',
                      background: active ? 'var(--color-accent-soft)' : 'transparent',
                    }}
                  >
                    {SIZE_SHORT[s]}
                  </button>
                );
              })}
            </div>
          )}
          <FrameIconButton label={t('duplicateWidget', { title: widget.title })} onClick={onDuplicate}>
            <Copy size={13} />
          </FrameIconButton>
          <FrameIconButton
            label={t('removeWidget', { title: widget.title })}
            onClick={onRemove}
            danger
          >
            <X size={14} />
          </FrameIconButton>
        </div>
      )}

      {editing && canResize && (
        // Right-edge width handle. Drag to resize (snaps to this widget's
        // allowed footprints); arrow keys step through them for keyboard users.
        // Desktop-only (see globals.css) — the 4-column grid is where the
        // footprints render at distinct widths; the toolbar's size button
        // remains the control on narrower/touch layouts.
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('resizeDragHandle')}
          aria-orientation="horizontal"
          aria-valuemin={WIDGET_COLSPAN[sortedSizes[0]]}
          aria-valuemax={WIDGET_COLSPAN[sortedSizes[sortedSizes.length - 1]]}
          aria-valuenow={WIDGET_COLSPAN[size]}
          aria-valuetext={WIDGET_SIZE_LABEL[size]}
          title={t('resizeDragHandle')}
          className="zg-w-resize-handle pointer-events-auto"
          draggable={false}
          data-active={resizing ? 'true' : undefined}
          onDragStart={(e) => e.preventDefault()}
          onPointerDown={beginPointerResize}
          onKeyDown={stepSizeByKey}
        >
          <span className="zg-w-resize-grip" aria-hidden />
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
