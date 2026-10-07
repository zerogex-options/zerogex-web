'use client';

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import {
  ALargeSmall,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  ArrowLeftRight,
  Lock,
  Maximize2,
  MoveDiagonal2,
  RotateCw,
  X,
} from 'lucide-react';

import type { PaneId, PlacedWidget, WidgetSize, WidgetZoom } from '@/core/myDashboardLayout';
import { DashboardWidgetContext } from '@/core/dashboardWidget';
import {
  DEFAULT_WIDGET_ZOOM,
  GRID_COLUMNS,
  MAX_WIDGET_HEIGHT,
  MIN_WIDGET_HEIGHT,
  SPAN_STEP,
  WIDGET_COLSPAN,
  WIDGET_SIZE_LABEL,
  WIDGET_ZOOMS,
  WIDGET_ZOOM_SCALE,
} from '@/core/myDashboardLayout';
import { TimeframeSymbolScope, useTimeframe } from '@/core/TimeframeContext';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import type { FreeResizeSpec, WidgetDef } from './registry';
import { MyDashboardDataProvider, type FeedKey } from './DashboardData';
import { WidgetInstanceContext, type WidgetInstanceValue } from './widgetInstance';
import { readGridGeometry, renderedSpan, spanFloor, toSpanStep, tracksForWidth } from './gridGeometry';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './WidgetFrame.i18n';

const SIZE_SHORT: Record<WidgetSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };
const ZOOM_SHORT: Record<WidgetZoom, string> = { sm: 'S', md: 'M', lg: 'L' };
const ZOOM_LABEL_KEY: Record<WidgetZoom, string> = { sm: 'zoomSm', md: 'zoomMd', lg: 'zoomLg' };

// A dragged bottom edge within this many px of the bottom of the tiles beside
// it snaps onto it, so the tile can be fitted to the row exactly.
const ROW_MAGNET_PX = 18;
// Free heights are kept to a 4px step so a board doesn't fill with 437px and
// 441px tiles that are meant to be the same.
const HEIGHT_STEP_PX = 4;
// One arrow-key press on the height handle.
const HEIGHT_KEY_STEP_PX = 20;

/** The box a free-resize drag edits — undefined = leave alone, null = default. */
export type WidgetBox = { span?: number | null; height?: number | null };

/**
 * The natural height of the row `cell` sits in, from the tiles beside it alone
 * — what "fill the row" means for it. Null when nothing else shares the row.
 *
 * The tiles beside it stretch to the row, and the row is as tall as its
 * tallest tile, which may be this one; so it is collapsed for the measurement
 * and put back before the browser paints. One forced layout, at the start of a
 * drag (and again if the drag moves it to another row).
 */
function measureRowFill(cell: HTMLElement): number | null {
  const grid = cell.parentElement;
  if (!grid) return null;
  const top = cell.getBoundingClientRect().top;
  const prev = { height: cell.style.height, minHeight: cell.style.minHeight, alignSelf: cell.style.alignSelf };
  cell.style.height = '0px';
  cell.style.minHeight = '0px';
  cell.style.alignSelf = 'start';
  let fill: number | null = null;
  for (const sibling of Array.from(grid.children)) {
    if (sibling === cell) continue;
    const r = sibling.getBoundingClientRect();
    if (Math.abs(r.top - top) > 2) continue;
    fill = Math.max(fill ?? 0, r.height);
  }
  cell.style.height = prev.height;
  cell.style.minHeight = prev.minHeight;
  cell.style.alignSelf = prev.alignSelf;
  return fill;
}

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
  /** This placement — its footprint and its per-tile settings. */
  item: PlacedWidget;
  /** A free-resize tile's floor while it has no height of its own: what it
   *  lines up with (DashboardGrid's chartLinedHeights). */
  autoHeight?: number;
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
  /** Free-resize tiles: set the dragged width and/or height. */
  onBoxChange: (box: WidgetBox) => void;
  /** Free-resize tiles: set how large the contents are drawn. */
  onZoomChange: (zoom: WidgetZoom) => void;
  /** Pin a tile to a symbol, or null to follow the board. Takes the instance
   *  id (rather than being bound to this tile by the grid) so it is the same
   *  function on every render, which keeps the tile's context stable. */
  onSymbolChange: (instanceId: string, symbol: UnderlyingSymbol | null) => void;
  /** Set a tile's side-panel width, or null for the default. Same shape and
   *  reason as onSymbolChange. */
  onPanelWidthChange: (instanceId: string, width: number | null) => void;
  onRemove: () => void;
  /** Drop a second copy of this widget beside it (side-by-side comparison). */
  onDuplicate: () => void;
  /** The other half of a split board, or null when the board isn't split. */
  sendToPane?: PaneId | null;
  /** Move this tile to `sendToPane`. Absent when there is nowhere to send it. */
  onSendToPane?: () => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  canMovePrev: boolean;
  canMoveNext: boolean;
};

export default function WidgetFrame({
  widget,
  item,
  autoHeight,
  editing,
  locked,
  isDragging,
  isDropTarget,
  resetKey,
  gridRef,
  onResize,
  onResizeStart,
  onResizeEnd,
  onBoxChange,
  onZoomChange,
  onSymbolChange,
  onPanelWidthChange,
  onRemove,
  onDuplicate,
  sendToPane,
  onSendToPane,
  onMovePrev,
  onMoveNext,
  canMovePrev,
  canMoveNext,
}: WidgetFrameProps) {
  const t = usePageT(dict);
  const rootRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  // The live "2/12 cols · 480px" readout shown while a free-resize tile is
  // being dragged; null otherwise.
  const [readout, setReadout] = useState<string | null>(null);

  const size = item.size;
  const free: FreeResizeSpec | undefined = widget.freeResize;
  // The floor a free tile renders at with no height of its own.
  const autoFloor = autoHeight ?? free?.defaultHeight ?? 0;
  const zoom: WidgetZoom = item.zoom ?? DEFAULT_WIDGET_ZOOM;
  // A free tile's stored width in board columns, or its footprint's. What it
  // actually renders at can differ (a split half, the px floor), so anything
  // that starts from the current width measures it — see measureNow().
  const span = item.span ?? WIDGET_COLSPAN[size];

  const allowedSizes = widget.allowedSizes.length ? widget.allowedSizes : [size];
  const canResize = free ? true : allowedSizes.length > 1;
  // Ascending by grid footprint — used for the size picker, drag-snap and
  // keyboard stepping alike.
  const sortedSizes = [...allowedSizes].sort((a, b) => WIDGET_COLSPAN[a] - WIDGET_COLSPAN[b]);

  // ── Per-tile symbol ──
  // Read here, OUTSIDE the tile's own scope: this is what the tile follows
  // while unpinned — its half's symbol, or the page's.
  const { symbol: boardSymbol } = useTimeframe();
  const instanceId = item.instanceId;
  const pinnedSymbol = item.symbol ?? null;
  // Picking the board's own symbol is how a tile goes back to following the
  // board; any other symbol pins it. See WidgetInstanceValue.selectSymbol.
  const selectSymbol = useCallback(
    (next: UnderlyingSymbol) => onSymbolChange(instanceId, next === boardSymbol ? null : next),
    [onSymbolChange, instanceId, boardSymbol],
  );
  const followBoard = useCallback(() => onSymbolChange(instanceId, null), [onSymbolChange, instanceId]);
  const setPanelWidth = useCallback(
    (width: number | null) => onPanelWidthChange(instanceId, width),
    [onPanelWidthChange, instanceId],
  );
  const panelWidth = item.panelWidth ?? null;
  const instance = useMemo<WidgetInstanceValue>(
    () => ({
      instanceId,
      symbol: pinnedSymbol ?? boardSymbol,
      boardSymbol,
      pinnedSymbol,
      selectSymbol,
      followBoard,
      zoomScale: free ? WIDGET_ZOOM_SCALE[zoom] : 1,
      panelWidth,
      setPanelWidth,
    }),
    [instanceId, pinnedSymbol, boardSymbol, selectSymbol, followBoard, free, zoom, panelWidth, setPanelWidth],
  );
  // A pinned tile that reads the board's shared feeds needs those feeds for
  // ITS symbol, so it gets a provider of its own (polling only what it reads).
  const ownFeeds = useMemo<Set<FeedKey> | null>(
    () => (pinnedSymbol && widget.feeds.length > 0 ? new Set(widget.feeds) : null),
    [pinnedSymbol, widget.feeds],
  );

  // ── Free-resize width as rendered ──
  // The width a free tile is actually drawn at, in board columns, kept fresh
  // while editing for the handle's aria values. Measured rather than derived:
  // a split half doubles widths and the px floor can widen one.
  const [renderedWidth, setRenderedWidth] = useState<number | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    const cell = rootRef.current?.parentElement;
    if (!editing || !free || !grid || !cell) return;
    const ro = new ResizeObserver(() =>
      setRenderedWidth(renderedSpan(readGridGeometry(grid), cell.getBoundingClientRect().width)),
    );
    ro.observe(cell);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [editing, free, gridRef]);
  const shownSpan = renderedWidth ?? span;
  /** The current rendered width and the free tile's width bounds right now. */
  const measureNow = () => {
    const grid = gridRef.current;
    const cell = rootRef.current?.parentElement;
    if (!grid || !cell || !free) return null;
    const geo = readGridGeometry(grid);
    return { geo, current: renderedSpan(geo, cell.getBoundingClientRect().width), floor: spanFloor(geo, free.minWidthPx) };
  };

  // Whether the last drag on a handle changed anything. A double-click resets
  // a handle, and a quick re-grab right after a drag would otherwise read as
  // one and undo the drag. Kept past pointerup: click and dblclick fire after.
  const gestureMovedRef = useRef(false);

  const readoutText = (s: number, h: number | null) =>
    `${t('readoutCols', { span: s })} · ${h === null ? t('readoutFits') : `${h}px`}`;

  // Drag a handle to resize. Column geometry is read live from the grid (so
  // it's correct at any breakpoint / container width) and the tile's EDGE
  // follows the pointer — the grab's offset inside the handle is kept, so a
  // press without movement changes nothing — applied live as it moves.
  //   • A footprint tile ('x' only) snaps to the nearest *allowed* footprint,
  //     as rendered in this grid.
  //   • A free-resize tile snaps its width to quarter-columns between its px
  //     floor and the end of its row (it never wraps onto the next one), and
  //     its height to the bottom of the tiles beside it ("fill the row") —
  //     the magnets that let it be fitted exactly into the space a row
  //     leaves it. On the two-column tablet grid its width is half or the
  //     whole row.
  const beginPointerResize = (e: ReactPointerEvent<HTMLDivElement>, mode: 'x' | 'y' | 'xy') => {
    const grid = gridRef.current;
    const root = rootRef.current;
    const cell = root?.parentElement;
    if (!canResize || !grid || !root || !cell) return;
    if (mode !== 'x' && !free) return;
    // Primary button only: a right-click (or a macOS ctrl-click) opens a
    // context menu that can swallow the release and strand the drag.
    if (e.button !== 0 || (e.pointerType === 'mouse' && e.ctrlKey)) return;
    e.preventDefault();
    e.stopPropagation();

    // Capture the node + pointer id synchronously: React nulls the synthetic
    // event's currentTarget once this handler returns, but the deferred
    // pointerup cleanup below still needs both.
    const handleEl = e.currentTarget;
    const pointerId = e.pointerId;
    // Focus the slider, so the arrow keys carry on from a click.
    if (mode !== 'xy') handleEl.focus({ preventScroll: true });

    const geo = readGridGeometry(grid);
    const cellRect = cell.getBoundingClientRect();
    const startLeft = cellRect.left;
    const grabDX = cellRect.right - e.clientX;
    const grabDY = cellRect.bottom - e.clientY;
    let rowTop = cellRect.top;
    let rowFill = mode === 'x' ? null : measureRowFill(cell);
    // Free width bounds, in board columns: the px floor, and the room from
    // the tile's left edge to the end of its row.
    const roomTracks = Math.max(1, Math.round(tracksForWidth(geo, geo.right - startLeft)));
    const maxColumns = Math.min(GRID_COLUMNS, roomTracks * geo.columnsPerTrack);
    const minColumns = free ? Math.max(SPAN_STEP, spanFloor(geo, free.minWidthPx)) : 0;

    try {
      handleEl.setPointerCapture(pointerId);
    } catch {
      /* pointer capture unsupported — the window listeners still track the drag */
    }
    const bodyClass = mode === 'x' ? 'zg-col-resizing' : mode === 'y' ? 'zg-row-resizing' : 'zg-box-resizing';
    document.body.classList.add(bodyClass);
    onResizeStart();
    setResizing(true);
    gestureMovedRef.current = false;

    let lastSize = size;
    let lastSpan = renderedSpan(geo, cellRect.width);
    let lastHeight: number | null = item.height ?? null;
    if (free) setReadout(readoutText(lastSpan, lastHeight));

    // The fraction of this grid each footprint renders at: a side-by-side
    // split half doubles them (S and M both half the pane, L and XL all of it).
    const renderedFraction = (s: WidgetSize) =>
      geo.half ? Math.min(1, (2 * WIDGET_COLSPAN[s]) / GRID_COLUMNS) : WIDGET_COLSPAN[s] / GRID_COLUMNS;
    // Nearest footprint, ties to the current one, so a footprint that renders
    // at the same width here (S vs M in a half) is never saved by a nudge.
    const snapSize = (fraction: number): WidgetSize => {
      let best = size;
      let bestDist = Math.abs(renderedFraction(size) - fraction);
      for (const s of sortedSizes) {
        const d = Math.abs(renderedFraction(s) - fraction);
        if (d < bestDist - 1e-6) {
          bestDist = d;
          best = s;
        }
      }
      return best;
    };

    let ended = false;
    const onMove = (ev: PointerEvent) => {
      // The release was lost (a context menu, a window switch): stop here
      // rather than leave the tile following the cursor.
      if (ev.buttons === 0) {
        end();
        return;
      }
      const box: WidgetBox = {};
      if (mode !== 'y') {
        const rawTracks = tracksForWidth(geo, ev.clientX + grabDX - startLeft);
        if (free) {
          let next: number;
          if (geo.desktop) {
            const columns = toSpanStep(rawTracks * geo.columnsPerTrack);
            next = Math.max(minColumns, Math.min(maxColumns, columns));
          } else {
            // Tablet: half or the whole row. Only a change between the two is
            // written, so a touch here doesn't wipe a finer desktop width.
            const wantFull = rawTracks >= 1.5;
            const isFull = lastSpan > GRID_COLUMNS / 2;
            next = wantFull === isFull ? lastSpan : wantFull ? GRID_COLUMNS : GRID_COLUMNS / 2;
          }
          if (next !== lastSpan) {
            lastSpan = next;
            box.span = next;
          }
        } else {
          const next = snapSize(rawTracks / geo.tracks);
          if (next !== lastSize) {
            lastSize = next;
            onResize(next);
          }
        }
      }
      if (mode !== 'x' && free) {
        // Re-read in case the tile moved rows (the tiles before it changed).
        const top = cell.getBoundingClientRect().top;
        if (Math.abs(top - rowTop) > 1) {
          rowTop = top;
          rowFill = measureRowFill(cell);
        }
        const raw = ev.clientY + grabDY - top;
        let next: number | null;
        if (rowFill !== null && rowFill >= MIN_WIDGET_HEIGHT && Math.abs(raw - rowFill) <= ROW_MAGNET_PX) {
          // Snapped onto the row. Stored as "no height of its own" whenever
          // that already draws at the row's height — it then keeps lining up
          // as the tiles beside it change — and as the exact px when the row
          // is shorter than the tile's own floor.
          next = rowFill >= autoFloor ? null : Math.round(rowFill);
        } else {
          next = Math.max(
            free.minHeight,
            Math.min(MAX_WIDGET_HEIGHT, Math.round(raw / HEIGHT_STEP_PX) * HEIGHT_STEP_PX),
          );
        }
        if (next !== lastHeight) {
          lastHeight = next;
          box.height = next;
        }
      }
      if (box.span !== undefined || box.height !== undefined) {
        gestureMovedRef.current = true;
        onBoxChange(box);
        setReadout(readoutText(lastSpan, lastHeight));
      }
    };
    const end = () => {
      if (ended) return;
      ended = true;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('contextmenu', end);
      handleEl.removeEventListener('lostpointercapture', end);
      document.body.classList.remove(bodyClass);
      try {
        handleEl.releasePointerCapture(pointerId);
      } catch {
        /* nothing to release */
      }
      setResizing(false);
      setReadout(null);
      onResizeEnd();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('contextmenu', end);
    handleEl.addEventListener('lostpointercapture', end);
  };

  // Keyboard parity for the width handle: arrows step through the allowed
  // footprints, or a quarter-column at a time on a free-resize tile (half or
  // the whole row on the tablet grid), from the width it is drawn at now.
  const stepSizeByKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canResize) return;
    if (free && e.key === 'Enter') {
      e.preventDefault();
      onBoxChange({ span: null });
      return;
    }
    const grow = e.key === 'ArrowRight' || e.key === 'ArrowUp';
    const shrink = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
    if (!grow && !shrink) return;
    e.preventDefault();
    if (free) {
      const now = measureNow();
      if (!now) return;
      const next = !now.geo.desktop
        ? grow
          ? GRID_COLUMNS
          : GRID_COLUMNS / 2
        : Math.max(Math.max(SPAN_STEP, now.floor), Math.min(GRID_COLUMNS, now.current + (grow ? SPAN_STEP : -SPAN_STEP)));
      if (next !== now.current || item.span === undefined) onBoxChange({ span: next });
      return;
    }
    const idx = sortedSizes.indexOf(size);
    const next = sortedSizes[grow ? Math.min(sortedSizes.length - 1, idx + 1) : Math.max(0, idx - 1)];
    if (next !== size) onResize(next);
  };

  // Keyboard parity for the height handle: Down grows (the edge moves down),
  // Up shrinks, Enter goes back to fitting the row.
  const stepHeightByKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!free) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onBoxChange({ height: null });
      return;
    }
    const grow = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const shrink = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    if (!grow && !shrink) return;
    e.preventDefault();
    const current = item.height ?? rootRef.current?.parentElement?.getBoundingClientRect().height ?? autoFloor;
    const next = Math.max(
      free.minHeight,
      Math.min(MAX_WIDGET_HEIGHT, Math.round(current) + (grow ? HEIGHT_KEY_STEP_PX : -HEIGHT_KEY_STEP_PX)),
    );
    onBoxChange({ height: next });
  };

  // Everything a widget renders is marked as living in a tile, so the reused
  // feature components drop their own expand / fullscreen affordance — the tile
  // owns its top-right corner (that button used to sit on top of the remove
  // button) and is resized by its footprint, not blown up to the viewport.
  //
  // It also gets its own symbol scope. Unpinned, the scope passes the board's
  // symbol straight through; pinned, every component inside reads the tile's
  // symbol, and a symbol switcher inside it pins the tile rather than moving
  // the page.
  // Rendered once per tile: the element is the same object on every render of
  // the frame, so React skips re-rendering the widget when only the board
  // around it changed (a drag on another tile, a reorder) and re-renders it
  // for its own data, settings and contexts alone. A drag-resize updates the
  // board on every pointer move; without this every chart on it re-drew too.
  const content = useMemo(() => widget.render(), [widget]);
  const body = locked ? (
    <UpgradeCard widget={widget} />
  ) : (
    <DashboardWidgetContext.Provider value>
      <WidgetInstanceContext.Provider value={instance}>
        <TimeframeSymbolScope symbol={pinnedSymbol} onSymbolChange={selectSymbol}>
          <WidgetErrorBoundary resetKey={`${resetKey}:${pinnedSymbol ?? ''}`}>
            {ownFeeds ? <MyDashboardDataProvider activeFeeds={ownFeeds}>{content}</MyDashboardDataProvider> : content}
          </WidgetErrorBoundary>
        </TimeframeSymbolScope>
      </WidgetInstanceContext.Provider>
    </DashboardWidgetContext.Provider>
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
        // It wraps onto a second line rather than overflowing a narrow tile,
        // and sits above the edge handles so they never take its clicks.
        <div
          className="pointer-events-auto absolute right-2 top-2 flex flex-wrap items-center justify-end gap-0.5 rounded-lg border p-0.5"
          style={{
            zIndex: 5,
            maxWidth: 'calc(100% - 16px)',
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
          {pinnedSymbol && (
            // This tile is on its own underlying. The chip says which, and a
            // click hands it back to the board's — the one way back that works
            // for every widget, including a chart whose own dropdown has no
            // "follow the board" entry.
            <button
              type="button"
              onClick={followBoard}
              title={t('pinnedChip', { symbol: pinnedSymbol, board: boardSymbol })}
              aria-label={t('pinnedChip', { symbol: pinnedSymbol, board: boardSymbol })}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold"
              style={{ color: 'var(--color-warning)', background: 'var(--color-warning-soft)' }}
            >
              {pinnedSymbol}
              <X size={11} />
            </button>
          )}
          {free && (
            // Tablet (two-column grid) only: half or the whole row. The
            // desktop grid has the edge handles for finer widths, and a phone
            // gives every chart the whole row.
            <button
              type="button"
              onClick={() => onBoxChange({ span: span > GRID_COLUMNS / 2 ? GRID_COLUMNS / 2 : GRID_COLUMNS })}
              title={span > GRID_COLUMNS / 2 ? t('halfRow') : t('fullRow')}
              aria-label={span > GRID_COLUMNS / 2 ? t('halfRow') : t('fullRow')}
              className="hidden h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-bold sm:flex lg:hidden"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Maximize2 size={12} />
              {span > GRID_COLUMNS / 2 ? '½' : '1/1'}
            </button>
          )}
          {free && (
            // A free-resize tile is sized by its edges, so its S / M / L set
            // the size its contents are drawn at instead of a footprint.
            <div
              className="flex items-center rounded-md"
              role="group"
              aria-label={t('textSize')}
              title={t('textSize')}
              style={{ background: 'var(--bg-hover)' }}
            >
              <ALargeSmall size={14} style={{ color: 'var(--text-secondary)', margin: '0 2px 0 4px' }} />
              {WIDGET_ZOOMS.map((z) => {
                const active = z === zoom;
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onZoomChange(z)}
                    aria-pressed={active}
                    title={t(ZOOM_LABEL_KEY[z])}
                    aria-label={t(ZOOM_LABEL_KEY[z])}
                    className="flex h-6 min-w-[18px] items-center justify-center rounded-md px-1 text-[10px] font-bold transition-colors"
                    style={{
                      color: active ? 'var(--color-accent-hot)' : 'var(--text-secondary)',
                      background: active ? 'var(--color-accent-soft)' : 'transparent',
                    }}
                  >
                    {ZOOM_SHORT[z]}
                  </button>
                );
              })}
            </div>
          )}
          {!free && canResize && size === 'sm' && (
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
          {!free && canResize && size !== 'sm' && (
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
          {sendToPane && onSendToPane && (
            <FrameIconButton
              label={t('moveToSide', { side: sendToPane.toUpperCase() })}
              onClick={onSendToPane}
            >
              <ArrowLeftRight size={13} />
            </FrameIconButton>
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

      {editing && canResize && (
        // Right-edge width handle: the whole edge drags. Snaps to this
        // widget's allowed footprints, or to quarter-columns on a free-resize
        // tile; arrow keys step through them for keyboard users. Desktop-only
        // for footprint tiles (see globals.css) — the desktop grid is where
        // footprints render at distinct widths, and the toolbar's size buttons
        // are the control on narrower layouts. A free tile's handle also works
        // on the tablet grid, as half or the whole row.
        //
        // The real guard against the cell's native drag-to-reorder hijacking
        // this gesture is the pointerdown preventDefault plus DashboardGrid's
        // `resizeIndex` (the cell stops being draggable while it is set); the
        // draggable/onDragStart here are belt and braces.
        <div
          role="slider"
          tabIndex={0}
          aria-label={free ? t('resizeWidthFree') : t('resizeDragHandle')}
          aria-orientation="horizontal"
          aria-valuemin={free ? SPAN_STEP : WIDGET_COLSPAN[sortedSizes[0]]}
          aria-valuemax={free ? GRID_COLUMNS : WIDGET_COLSPAN[sortedSizes[sortedSizes.length - 1]]}
          aria-valuenow={free ? shownSpan : WIDGET_COLSPAN[size]}
          aria-valuetext={free ? t('readoutCols', { span: shownSpan }) : WIDGET_SIZE_LABEL[size]}
          title={free ? t('resizeWidthFree') : t('resizeDragHandle')}
          className={`zg-w-resize-handle${free ? ' zg-w-resize-handle--free' : ''} pointer-events-auto`}
          draggable={false}
          data-active={resizing ? 'true' : undefined}
          onDragStart={(e) => e.preventDefault()}
          onPointerDown={(e) => beginPointerResize(e, 'x')}
          onKeyDown={stepSizeByKey}
          onDoubleClick={
            free
              ? () => {
                  if (!gestureMovedRef.current) onBoxChange({ span: null });
                }
              : undefined
          }
        >
          <span className="zg-w-resize-grip" aria-hidden />
        </div>
      )}

      {editing && free && (
        <>
          {/* Bottom-edge height handle. Snaps to the bottom of the tiles beside
              it; double-click (or Enter) goes back to fitting the row. */}
          <div
            role="slider"
            tabIndex={0}
            aria-label={t('resizeHeightHandle')}
            aria-orientation="vertical"
            aria-valuemin={free.minHeight}
            aria-valuemax={MAX_WIDGET_HEIGHT}
            aria-valuenow={item.height ?? autoFloor}
            aria-valuetext={item.height == null ? t('readoutFits') : `${item.height}px`}
            title={t('resizeHeightHandle')}
            className="zg-h-resize-handle pointer-events-auto"
            draggable={false}
            data-active={resizing ? 'true' : undefined}
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={(e) => beginPointerResize(e, 'y')}
            onKeyDown={stepHeightByKey}
            onDoubleClick={() => {
              if (!gestureMovedRef.current) onBoxChange({ height: null });
            }}
          >
            <span className="zg-h-resize-grip" aria-hidden />
          </div>
          {/* Corner handle: width and height in one drag. */}
          <div
            aria-hidden
            title={t('resizeBoxHandle')}
            className="zg-box-resize-handle pointer-events-auto"
            draggable={false}
            data-active={resizing ? 'true' : undefined}
            onDragStart={(e) => e.preventDefault()}
            onPointerDown={(e) => beginPointerResize(e, 'xy')}
          >
            <MoveDiagonal2 size={12} />
          </div>
          {readout && <div className="zg-resize-readout">{readout}</div>}
        </>
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
