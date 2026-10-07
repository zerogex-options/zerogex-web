'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import WidgetFrame, { type WidgetBox } from './WidgetFrame';
import { getWidget, type WidgetDef } from './registry';
import {
  GRID_TRACKS,
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
 * spare height visible rather than stretching into it — or the row's own,
 * never less than `autoHeight` (see chartLinedHeights).
 */
function cellLayout(
  item: PlacedWidget,
  widget: WidgetDef,
  geo: GridGeometry | null,
  autoHeight: number | undefined,
): { className: string; style?: CSSProperties } {
  const tile = widget.tile && item.size === 'sm' ? ' zg-w-tile' : '';
  const free = widget.freeResize;
  if (!free) return { className: `zg-w-${item.size}${tile}` };
  const style: Record<string, string | number> = {};
  // Always drawn as a width, the footprint's share of the board when none was
  // dragged: then a split half doubles it by the same rule as a dragged width,
  // and what the drag and the arrow keys measure there reads back as what is
  // stored. (A footprint TILE's M is half a split half; a free tile's M is the
  // whole half, exactly as a six-column drag would be.)
  const stored = item.span ?? WIDGET_COLSPAN[item.size];
  const floor = geo?.desktop ? spanFloor(geo, free.minWidthPx) : 0;
  const tracks = Math.min(GRID_TRACKS, Math.round(Math.max(stored, floor) / SPAN_STEP));
  const className = 'zg-w-span';
  style['--zg-span'] = tracks;
  style['--zg-span-half'] = Math.min(GRID_TRACKS, tracks * 2);
  style['--zg-span-tab'] = stored <= 6 ? 1 : 2;
  if (item.height !== undefined) {
    style.height = item.height;
    style.alignSelf = 'start';
  } else {
    style.minHeight = autoHeight ?? free.defaultHeight;
  }
  return { className, style: style as CSSProperties };
}

// The chart widgets a free-resize tile lines its default height up with.
const CHART_WIDGET_IDS: ReadonlySet<string> = new Set(['gamma-chart', 'gamma-terminal']);

// What the Gamma Chart adds above and below its plot (title and price block,
// toolbar, padding), for the estimate below. Approximate: it wraps with width.
const CHART_CHROME_ESTIMATE_PX = 190;

/**
 * The height a full-width Gamma Chart would be in a grid this wide, for a
 * board with no chart on it to measure. Mirrors the chart's own canvas rules
 * (components/GammaTerminalChart: desktopCanvas / compactCanvas): the
 * 1360×636 board scaled to the card, never under 460 units tall, or the
 * portrait compact board under 700px.
 */
function estimatedChartHeight(cardWidth: number): number {
  const plot =
    cardWidth < 700
      ? Math.min(640, Math.max(400, Math.round(cardWidth * 1.3)))
      : cardWidth >= 1360
        ? Math.round((636 * cardWidth) / 1360)
        : Math.max(460, Math.round((636 * cardWidth) / 1360));
  return plot + CHART_CHROME_ESTIMATE_PX;
}

/**
 * The minimum height of each free-resize tile that has no height of its own,
 * keyed by instance id. The rule is to line up with the charts: a tile that
 * shares its row with a Gamma Chart or Gamma Terminal just fills the row (its
 * floor drops to the widget's minimum, so the chart sets the height and the
 * edges meet); one that doesn't takes the height of this grid's first chart
 * widget, measured as the chart draws itself; and with no chart in the grid,
 * the height a full-width Gamma Chart would be here.
 *
 * Read from the DOM after layout. Rows are found by matching tops, and a
 * floor only ever changes heights, never which row a tile is in, so applying
 * the result cannot change it.
 */
function chartLinedHeights(grid: HTMLElement, items: PlacedWidget[]): Record<string, number> {
  const cells = Array.from(grid.children) as HTMLElement[];
  const placed = cells.map((el) => ({
    el,
    id: el.dataset.instanceId ?? '',
    widgetId: el.dataset.widgetId ?? '',
    top: el.getBoundingClientRect().top,
  }));
  let reference: number | null = null;
  for (const cell of placed) {
    if (!CHART_WIDGET_IDS.has(cell.widgetId)) continue;
    const natural = cell.el.querySelector<HTMLElement>('[data-zg-natural-height]');
    const h = natural?.getBoundingClientRect().height ?? 0;
    if (h > 0) {
      reference = h;
      break;
    }
  }
  if (reference === null) {
    const geo = readGridGeometry(grid);
    reference = estimatedChartHeight(grid.getBoundingClientRect().width - geo.gutter);
  }
  const out: Record<string, number> = {};
  for (const item of items) {
    const free = getWidget(item.widgetId)?.freeResize;
    if (!free || item.height !== undefined) continue;
    const cell = placed.find((c) => c.id === item.instanceId);
    if (!cell) continue;
    const besideChart = placed.some(
      (o) => o !== cell && CHART_WIDGET_IDS.has(o.widgetId) && Math.abs(o.top - cell.top) <= 2,
    );
    out[item.instanceId] = besideChart ? free.minHeight : Math.max(free.minHeight, Math.round(reference));
  }
  return out;
}

function sameHeights(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
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

  // Free-resize tiles without a height of their own line up with the charts
  // (chartLinedHeights). Measured before paint, then again whenever the grid
  // or a chart widget changes size (a chart sizes itself to its width, and a
  // Gamma Terminal changes height when its panel stacks or its view changes).
  const [autoHeights, setAutoHeights] = useState<Record<string, number>>({});
  const needsAutoHeights = items.some((item) => item.height === undefined && getWidget(item.widgetId)?.freeResize);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || !needsAutoHeights) return;
    const measure = () => {
      const next = chartLinedHeights(grid, items);
      setAutoHeights((cur) => (sameHeights(cur, next) ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    grid.querySelectorAll('[data-zg-natural-height]').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [items, needsAutoHeights]);
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
