'use client';

import { useRef, useState } from 'react';
import WidgetFrame from './WidgetFrame';
import { getWidget } from './registry';
import type { PlacedWidget, WidgetSize } from '@/core/myDashboardLayout';

/**
 * The widget grid + reordering. Drag-and-drop uses the native HTML5 DnD API
 * (no dependency); live reordering happens on drag-enter. Touch devices — where
 * HTML5 DnD is unreliable — use the tile's move-earlier / move-later buttons,
 * so reordering is fully usable without a drag.
 */
export default function DashboardGrid({
  items,
  editing,
  hasPro,
  resetKey,
  onReorder,
  onRemove,
  onResize,
  onDuplicate,
}: {
  items: PlacedWidget[];
  editing: boolean;
  hasPro: boolean;
  resetKey: string | number;
  onReorder: (from: number, to: number) => void;
  onRemove: (instanceId: string) => void;
  onResize: (instanceId: string, size: WidgetSize) => void;
  onDuplicate: (instanceId: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // While an edge-drag resize is in progress the grid's native HTML5
  // drag-to-reorder is suspended, so a horizontal resize can't be misread as a
  // reorder gesture.
  const [resizeIndex, setResizeIndex] = useState<number | null>(null);

  return (
    <div ref={gridRef} className="zg-mydash-grid">
      {items.map((item, index) => {
        const widget = getWidget(item.widgetId);
        if (!widget) return null;
        const locked = widget.tier === 'pro' && !hasPro;

        return (
          <div
            key={item.instanceId}
            className={`zg-w-${item.size}`}
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
              size={item.size}
              editing={editing}
              locked={locked}
              isDragging={dragIndex === index}
              isDropTarget={overIndex === index && dragIndex !== index}
              resetKey={resetKey}
              gridRef={gridRef}
              onResize={(s) => onResize(item.instanceId, s)}
              onResizeStart={() => setResizeIndex(index)}
              onResizeEnd={() => setResizeIndex(null)}
              onRemove={() => onRemove(item.instanceId)}
              onDuplicate={() => onDuplicate(item.instanceId)}
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
