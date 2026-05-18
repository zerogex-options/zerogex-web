'use client';

import { useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  DASHBOARD_WIDGETS,
  DashboardWidgetCtx,
  getWidgetDef,
  spanClassFor,
} from '@/core/dashboardWidgets';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';

type LayoutApi = ReturnType<typeof useDashboardLayout>;

export default function DashboardGrid({
  ctx,
  layout,
}: {
  ctx: DashboardWidgetCtx;
  layout: LayoutApi;
}) {
  const { widgets, editing, setEditing, reorder, nudge, hide, add, reset } = layout;
  const dragId = useRef<string | null>(null);

  const visible = widgets.filter((w) => w.visible);
  const hidden = widgets.filter((w) => !w.visible);

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        {editing && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <RotateCcw size={14} /> Reset to default
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border"
          style={{
            borderColor: editing ? 'var(--color-info)' : 'var(--border-default)',
            color: editing ? 'var(--color-info)' : 'var(--text-secondary)',
          }}
        >
          <Pencil size={14} /> {editing ? 'Done' : 'Edit dashboard'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {visible.map((w) => {
          const def = getWidgetDef(w.id);
          if (!def) return null;
          return (
            <div
              key={w.id}
              className={`${spanClassFor(def.span)} ${editing ? 'relative' : ''}`}
              draggable={editing}
              onDragStart={() => {
                dragId.current = w.id;
              }}
              onDragOver={(e) => {
                if (editing) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!editing) return;
                e.preventDefault();
                if (dragId.current) reorder(dragId.current, w.id);
                dragId.current = null;
              }}
            >
              {editing && (
                <div
                  className="absolute z-10 top-2 right-2 flex items-center gap-1 rounded-lg px-1.5 py-1"
                  style={{ backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)' }}
                >
                  <span className="cursor-grab text-[var(--text-muted)]" aria-hidden>
                    <GripVertical size={14} />
                  </span>
                  <button
                    type="button"
                    aria-label={`Move ${def.label} earlier`}
                    onClick={() => nudge(w.id, -1)}
                    className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${def.label} later`}
                    onClick={() => nudge(w.id, 1)}
                    className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${def.label}`}
                    onClick={() => hide(w.id)}
                    className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--color-bear)]"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              <div
                className={editing ? 'rounded-2xl ring-1 ring-dashed ring-[var(--border-strong)] p-1' : ''}
                style={editing ? { opacity: 0.98 } : undefined}
              >
                {def.render(ctx)}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div
          className="mt-6 rounded-2xl p-4"
          style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Add widgets
          </h3>
          {hidden.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Every widget is already on your dashboard.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {DASHBOARD_WIDGETS.filter((d) => hidden.some((h) => h.id === d.id)).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => add(d.id)}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border"
                  style={{
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-card)',
                  }}
                >
                  <Plus size={14} /> {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
