'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import WidgetFrame, { type AutoHeight, type WidgetBox } from './WidgetFrame';
import { COMPACT_MAX_WIDTH, DESKTOP_MIN_WIDTH } from '@/components/GammaTerminalChart';
import { getWidget, type WidgetDef } from './registry';
import {
  GRID_TRACKS,
  HALF_PANE_TRACKS,
  SPAN_STEP,
  WIDGET_COLSPAN,
  type PaneId,
  type PlacedWidget,
  type WidgetSize,
  type WidgetZoom,
} from '@/core/myDashboardLayout';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import { readGridGeometry, spanFloor, type GridGeometry } from './gridGeometry';

/**
 * The grid cell's class and inline style for one placement. A footprint tile
 * is just its footprint class. A free-resize tile with a dragged width spans
 * that many columns instead: --zg-span in the desktop grid's tracks,
 * --zg-span-half at twice that for a side-by-side split half (a width is a
 * share of the whole board, like a footprint), half or all of the tablet row
 * via --zg-span-tab, and the full row on a phone. On the desktop grid it is
 * never drawn narrower than the widget's px floor (`floorSpan`), so a width
 * saved on a wide screen stays usable on a narrow one. Its height is either
 * the one it was dragged to — top-aligned, so a shorter tile leaves the row's
 * spare height visible rather than stretching into it — or, with none of its
 * own, `auto` (see chartLinedHeights): exactly a chart's height beside one,
 * else the row's own, never less than the floor.
 */
function cellLayout(
  item: PlacedWidget,
  widget: WidgetDef,
  geo: GridGeometry | null,
  auto: AutoHeight | undefined,
): { className: string; style?: CSSProperties } {
  const tile = widget.tile && item.size === 'sm' ? ' zg-w-tile' : '';
  const free = widget.freeResize;
  if (!free) return { className: `zg-w-${item.size}${tile}` };
  const style: Record<string, string | number> = {};
  // Always drawn as a width — the footprint's share of the board when none
  // was dragged — so the px floor applies to it too. In a side-by-side split
  // half an undragged tile keeps its footprint's half-pane width (as it was
  // drawn before it could be dragged, so saved split boards don't reflow); a
  // dragged one is a share of the board, at twice the tracks.
  const stored = item.span ?? WIDGET_COLSPAN[item.size];
  const floor = geo?.desktop ? spanFloor(geo, free.minWidthPx) : 0;
  const tracks = Math.min(GRID_TRACKS, Math.round(Math.max(stored, floor) / SPAN_STEP));
  const className = 'zg-w-span';
  style['--zg-span'] = tracks;
  style['--zg-span-half'] =
    item.span === undefined
      ? Math.min(GRID_TRACKS, Math.max(HALF_PANE_TRACKS[item.size], Math.round(floor / SPAN_STEP) * 2))
      : Math.min(GRID_TRACKS, tracks * 2);
  style['--zg-span-tab'] = stored <= 6 ? 1 : 2;
  if (item.height !== undefined) {
    style.height = item.height;
    style.alignSelf = 'start';
  } else if (auto?.exact) {
    style.height = auto.height;
    style.alignSelf = 'start';
  } else {
    style.minHeight = auto?.height ?? free.defaultHeight;
  }
  return { className, style: style as CSSProperties };
}

// The chart widgets a free-resize tile lines its default height up with.
const CHART_WIDGET_IDS: ReadonlySet<string> = new Set(['gamma-chart', 'gamma-terminal']);

// What the Gamma Chart adds above and below its plot (title and price block,
// toolbar, padding), for the estimate below. Approximate: it wraps with width.
const CHART_CHROME_ESTIMATE_PX = 190;

// A classic page scrollbar coming or going moves the grid by ~15-17px. Width
// changes under this keep the last estimate, so an estimate can't toggle the
// scrollbar that changed it, every frame.
const ESTIMATE_WIDTH_SLACK_PX = 24;

/**
 * The height a full-width Gamma Chart would be in a grid this wide, for a
 * board with no chart on it to measure. Mirrors the chart's own canvas rules
 * (components/GammaTerminalChart: desktopCanvas / compactCanvas): the
 * 1360×636 board scaled to the card, never under 460 units tall; or, under
 * DESKTOP_MIN_WIDTH (COMPACT_MAX_WIDTH on a phone-sized or touch screen), the
 * compact board — short and wide in a landscape window, tall in a portrait one.
 */
function estimatedChartHeight(cardWidth: number): number {
  const landscape = window.innerWidth > window.innerHeight;
  const touchUi = window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches;
  const plot =
    cardWidth < (touchUi ? COMPACT_MAX_WIDTH : DESKTOP_MIN_WIDTH)
      ? landscape
        ? Math.min(420, Math.max(330, Math.round(cardWidth * 0.62)))
        : Math.min(640, Math.max(400, Math.round(cardWidth * 1.3)))
      : cardWidth >= 1360
        ? Math.round((636 * cardWidth) / 1360)
        : Math.max(460, Math.round((636 * cardWidth) / 1360));
  return plot + CHART_CHROME_ESTIMATE_PX;
}

/**
 * What each free-resize tile draws at with no height of its own, keyed by
 * instance id — computed for every free tile, with a height or not, so a drag
 * knows what "no height" would mean. The rule is to line up with the charts:
 * a tile that shares its row with a Gamma Chart or Gamma Terminal is exactly
 * that chart's height (`exact`; the tallest, if two), so the edges meet even
 * when a taller tile stretches the row; one that doesn't takes the height of
 * this grid's first chart widget as a floor, measured as the chart draws
 * itself; and with no chart in the grid, the height a full-width Gamma Chart
 * would be here.
 *
 * Read from the DOM after layout. Rows are found by matching tops, and the
 * result only ever changes heights, never which row a tile is in, so applying
 * it cannot change it.
 */
function chartLinedHeights(
  grid: HTMLElement,
  items: PlacedWidget[],
  estimateWidth: { current: number | null },
): Record<string, AutoHeight> {
  const cells = Array.from(grid.children) as HTMLElement[];
  const placed = cells.map((el) => {
    const isChart = CHART_WIDGET_IDS.has(el.dataset.widgetId ?? '');
    const natural = isChart ? el.querySelector<HTMLElement>('[data-zg-natural-height]') : null;
    return {
      id: el.dataset.instanceId ?? '',
      isChart,
      chartHeight: natural?.getBoundingClientRect().height ?? 0,
      top: el.getBoundingClientRect().top,
    };
  });
  let reference = placed.find((c) => c.isChart && c.chartHeight > 0)?.chartHeight ?? null;
  if (reference === null) {
    const width = grid.getBoundingClientRect().width - readGridGeometry(grid).gutter;
    if (estimateWidth.current === null || Math.abs(width - estimateWidth.current) > ESTIMATE_WIDTH_SLACK_PX) {
      estimateWidth.current = width;
    }
    reference = estimatedChartHeight(estimateWidth.current);
  }
  const out: Record<string, AutoHeight> = {};
  for (const item of items) {
    const free = getWidget(item.widgetId)?.freeResize;
    if (!free) continue;
    const cell = placed.find((c) => c.id === item.instanceId);
    if (!cell) continue;
    const rowChart = Math.max(
      0,
      ...placed.filter((o) => o !== cell && o.isChart && Math.abs(o.top - cell.top) <= 2).map((o) => o.chartHeight),
    );
    out[item.instanceId] =
      rowChart > 0
        ? { height: Math.max(free.minHeight, Math.round(rowChart)), exact: true }
        : { height: Math.max(free.minHeight, Math.round(reference)), exact: false };
  }
  return out;
}

function sameHeights(a: Record<string, AutoHeight>, b: Record<string, AutoHeight>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] !== undefined && a[k].height === b[k].height && a[k].exact === b[k].exact);
}

/**
 * The widget grid + reordering. Drag-and-drop uses the native HTML5 DnD API
 * (no dependency); live reordering happens on drag-enter. Touch devices — where
 * HTML5 DnD is unreliable — use the tile's move-earlier / move-later buttons,
 * so reordering is fully usable without a drag.
 *
 * One grid renders one pane. On a split board each half gets its own instance
 * with `half` set, which doubles each footprint on the desktop grid so the
 * footprints still mean "quarter / half / three-quarters / full" of the space
 * the pane actually has. Reordering is within a pane; `sendToPane` adds
 * the cross-pane move to each tile's edit controls.
 */
export default function DashboardGrid({
  items,
  editing,
  hasPro,
  resetKey,
  half = false,
  sendToPane = null,
  onReorder,
  onRemove,
  onResize,
  onDuplicate,
  onBoxChange,
  onZoomChange,
  onSymbolChange,
  onPanelWidthChange,
  onSendToPane,
}: {
  items: PlacedWidget[];
  editing: boolean;
  hasPro: boolean;
  resetKey: string | number;
  /** True when this grid is one half of a split board (two-column desktop). */
  half?: boolean;
  /** The pane a tile can be moved to, or null when the board isn't split. */
  sendToPane?: PaneId | null;
  onReorder: (from: number, to: number) => void;
  onRemove: (instanceId: string) => void;
  onResize: (instanceId: string, size: WidgetSize) => void;
  onDuplicate: (instanceId: string) => void;
  onBoxChange: (instanceId: string, box: WidgetBox) => void;
  onZoomChange: (instanceId: string, zoom: WidgetZoom) => void;
  onSymbolChange: (instanceId: string, symbol: UnderlyingSymbol | null) => void;
  onPanelWidthChange: (instanceId: string, width: number | null) => void;
  onSendToPane?: (instanceId: string, target: PaneId) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  // The grid's live track geometry, for drawing free-resize widths at no less
  // than their px floor. Null until measured (the floor then waits a frame).
  const [geo, setGeo] = useState<GridGeometry | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const ro = new ResizeObserver(() => {
      const next = readGridGeometry(grid);
      // Tight tolerance: the drawn floor has to match the one a drag reads
      // fresh, and a few px of grid width (a scrollbar appearing) can move it.
      setGeo((cur) =>
        cur &&
        cur.tracks === next.tracks &&
        cur.half === next.half &&
        cur.gap === next.gap &&
        cur.gutter === next.gutter &&
        Math.abs(cur.trackWidth - next.trackWidth) < 0.01
          ? cur
          : next,
      );
    });
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);

  // Free-resize tiles line up with the charts (chartLinedHeights). Measured
  // before paint, then again whenever the grid or a chart widget changes size
  // (a chart sizes itself to its width, and a Gamma Terminal changes height
  // when its panel stacks or its view changes).
  const [autoHeights, setAutoHeights] = useState<Record<string, AutoHeight>>({});
  const estimateWidthRef = useRef<number | null>(null);
  const hasFreeTiles = items.some((item) => getWidget(item.widgetId)?.freeResize);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || !hasFreeTiles) return;
    const measure = () => {
      const next = chartLinedHeights(grid, items, estimateWidthRef);
      setAutoHeights((cur) => (sameHeights(cur, next) ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    grid.querySelectorAll('[data-zg-natural-height]').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [items, hasFreeTiles]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // While an edge-drag resize is in progress the grid's native HTML5
  // drag-to-reorder is suspended, so a horizontal resize can't be misread as a
  // reorder gesture.
  const [resizeIndex, setResizeIndex] = useState<number | null>(null);
  // On the desktop grid the 16px between tiles is each cell's own padding,
  // not a grid gap, so a press there lands on the (draggable) cell. A press
  // just outside a tile's edge is someone missing the resize edge, not
  // reaching for a reorder, so it starts nothing — as the old gap didn't.
  const gutterPressRef = useRef(false);

  return (
    <div ref={gridRef} className={half ? 'zg-mydash-grid zg-mydash-grid--half' : 'zg-mydash-grid'}>
      {items.map((item, index) => {
        const widget = getWidget(item.widgetId);
        if (!widget) return null;
        const locked = widget.tier === 'pro' && !hasPro;
        const autoHeight = autoHeights[item.instanceId];
        const cell = cellLayout(item, widget, geo, autoHeight);

        return (
          <div
            key={item.instanceId}
            className={cell.className}
            style={cell.style}
            data-instance-id={item.instanceId}
            data-widget-id={item.widgetId}
            draggable={editing && resizeIndex === null}
            // Capture phase: the resize handles stop propagation on pointerdown.
            onPointerDownCapture={(e) => {
              gutterPressRef.current = e.target === e.currentTarget;
            }}
            onDragStart={(e) => {
              if (!editing || resizeIndex !== null || gutterPressRef.current) {
                e.preventDefault();
                return;
              }
              setDragIndex(index);
              e.dataTransfer.effectAllowed = 'move';
              try {
                e.dataTransfer.setData('text/plain', item.instanceId);
              } catch {
                /* some browsers disallow setData in certain contexts */
              }
            }}
            onDragEnter={() => {
              if (dragIndex === null || dragIndex === index) return;
              onReorder(dragIndex, index);
              setDragIndex(index);
              setOverIndex(index);
            }}
            onDragOver={(e) => {
              if (editing) e.preventDefault();
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            <WidgetFrame
              widget={widget}
              item={item}
              autoHeight={autoHeight}
              editing={editing}
              locked={locked}
              isDragging={dragIndex === index}
              isDropTarget={overIndex === index && dragIndex !== index}
              resetKey={resetKey}
              gridRef={gridRef}
              onResize={(s) => onResize(item.instanceId, s)}
              onResizeStart={() => setResizeIndex(index)}
              onResizeEnd={() => setResizeIndex(null)}
              onBoxChange={(box) => onBoxChange(item.instanceId, box)}
              onZoomChange={(zoom) => onZoomChange(item.instanceId, zoom)}
              onSymbolChange={onSymbolChange}
              onPanelWidthChange={onPanelWidthChange}
              onRemove={() => onRemove(item.instanceId)}
              onDuplicate={() => onDuplicate(item.instanceId)}
              sendToPane={sendToPane}
              onSendToPane={
                sendToPane && onSendToPane
                  ? () => onSendToPane(item.instanceId, sendToPane)
                  : undefined
              }
              onMovePrev={() => onReorder(index, Math.max(0, index - 1))}
              onMoveNext={() => onReorder(index, Math.min(items.length - 1, index + 1))}
              canMovePrev={index > 0}
              canMoveNext={index < items.length - 1}
            />
          </div>
        );
      })}
    </div>
  );
}
