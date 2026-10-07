'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import WidgetFrame, { type WidgetBox } from './WidgetFrame';
import { getWidget, type WidgetDef } from './registry';
import {
  GRID_TRACKS,
  SPAN_STEP,
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
 * never less than its default.
 */
function cellLayout(
  item: PlacedWidget,
  widget: WidgetDef,
  geo: GridGeometry | null,
): { className: string; style?: CSSProperties } {
  const tile = widget.tile && item.size === 'sm' ? ' zg-w-tile' : '';
  const free = widget.freeResize;
  if (!free) return { className: `zg-w-${item.size}${tile}` };
  const style: Record<string, string | number> = {};
  let className = `zg-w-${item.size}`;
  if (item.span !== undefined) {
    const floor = geo?.desktop ? spanFloor(geo, free.minWidthPx) : 0;
    const span = Math.max(item.span, floor);
    const tracks = Math.min(GRID_TRACKS, Math.round(span / SPAN_STEP));
    className = 'zg-w-span';
    style['--zg-span'] = tracks;
    style['--zg-span-half'] = Math.min(GRID_TRACKS, tracks * 2);
    style['--zg-span-tab'] = item.span <= 6 ? 1 : 2;
  }
  if (item.height !== undefined) {
    style.height = item.height;
    style.alignSelf = 'start';
  } else {
    style.minHeight = free.defaultHeight;
  }
  return { className, style: style as CSSProperties };
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
      setGeo((cur) =>
        cur &&
        cur.tracks === next.tracks &&
        cur.half === next.half &&
        Math.abs(cur.trackWidth - next.trackWidth) < 0.5 &&
        cur.gap === next.gap
          ? cur
          : next,
      );
    });
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // While an edge-drag resize is in progress the grid's native HTML5
  // drag-to-reorder is suspended, so a horizontal resize can't be misread as a
  // reorder gesture.
  const [resizeIndex, setResizeIndex] = useState<number | null>(null);

  return (
    <div ref={gridRef} className={half ? 'zg-mydash-grid zg-mydash-grid--half' : 'zg-mydash-grid'}>
      {items.map((item, index) => {
        const widget = getWidget(item.widgetId);
        if (!widget) return null;
        const locked = widget.tier === 'pro' && !hasPro;
        const cell = cellLayout(item, widget, geo);

        return (
          <div
            key={item.instanceId}
            className={cell.className}
            style={cell.style}
            draggable={editing && resizeIndex === null}
            onDragStart={(e) => {
              if (!editing || resizeIndex !== null) {
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
