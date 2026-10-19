'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { X } from 'lucide-react';

// Admin → Monitoring → Export: every tab, one after another, saved as one PDF.
//
// The PDF comes from the browser's own print dialog ("Save as PDF"). The
// production box carries no Chromium to render one server-side (see
// `make email-audit`), and printing keeps the text selectable and the charts as
// vectors, where a screenshot library would flatten every page to a picture.
//
// The tabs are laid out inside an iframe, not on the page itself. Two things on
// these tabs are sized against the window: the sm:/md:/lg: breakpoints, and
// every chart, which measures its width once, on screen, and keeps it. Paper
// is a different window from the browser's, so a chart sized for one comes out
// the wrong width on the other. The frame is sized to agree with the paper on
// both counts, whatever size the operator's browser window is:
//
//   - Its content is exactly as wide as the printed page's.
//   - Its breakpoints match the paper's. When printing, Chrome evaluates
//     breakpoints against the width of the default paper in the print settings
//     (816px for Letter portrait, 794px for A4), whatever @page asks for, so on
//     paper the tabs always lay out in the md band (768–1023px). The frame's
//     width sits in that same band.

/** US Letter landscape with half-inch margins: the printed content box, in CSS px (96 to the inch). */
const PAPER_WIDTH = 10 * 96;
/** The paper plus room for a scrollbar: inside the md band (768–1023px), like the paper's breakpoints. */
const FRAME_WIDTH = PAPER_WIDTH + 32;
/** How long the charts must sit still before printing: longer than any gap between two frames of a draw-in animation. */
const STILL_MS = 750;
/** Stop waiting for stillness after this long, so a chart that never settles cannot hold the export forever. */
const STILL_CAP_MS = 10_000;

const FRAME_HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';

/**
 * The frame's own rules. Light theme only: the frame never carries `.dark`
 * (see dressFrame). On paper every element prints its own colors, so the bars
 * and pills drawn as backgrounds survive "Background graphics" being off, and
 * each page carries the title, the export time and its page number in the
 * margins (which also keeps Chrome from printing the frame's "about:srcdoc"
 * address there).
 */
function frameCss(title: string, stamp: string): string {
  const margin = 'font: 10px/1.2 var(--font-body, ui-sans-serif, system-ui, sans-serif); color: #6b7280;';
  return `
html, body { background: var(--color-bg); }
.zg-export { width: ${PAPER_WIDTH}px; margin: 0 auto; padding: 24px 0 64px; }
.zg-export-section + .zg-export-section { margin-top: 56px; }
@page {
  size: letter landscape;
  margin: 0.5in;
  @top-left { content: ${JSON.stringify(`ZeroGEX · ${title}`)}; ${margin} }
  @top-right { content: ${JSON.stringify(stamp)}; ${margin} }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); ${margin} }
}
@media print {
  html, body { background: #fff; }
  .zg-export, .zg-export * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .zg-export { padding: 0; }
  .zg-export-section + .zg-export-section { margin-top: 0; break-before: page; }
  /* A heading, and a heading's intro line, stays with what it introduces. */
  .zg-export :is(h1, h2, h3, h4, :is(h2, h3, h4) + p) { break-after: avoid; }
  /* A card or chart moves to the next page whole rather than splitting (one
     taller than a page still splits). Not on the <svg> itself: a Recharts
     chart hangs out of a zero-height box, and pushing just the overflow down a
     page drops it on top of whatever is there. */
  .zg-export :is(.rounded-lg, .grid > *, .recharts-responsive-container, tr) { break-inside: avoid; }
  .zg-export :is(.overflow-x-auto, .overflow-y-auto, .overflow-auto) { overflow: visible !important; }
}
`;
}

// ── What is still loading ──────────────────────────────────────────────────
// Every tab fetches for itself, so the export cannot know when one is done
// unless the tab says so. A tab calls useExportPending with its own "still
// loading" flag; the export prints once no section holds a flag.

type PendingStore = {
  hold: (section: string) => () => void;
  /** Lets go of the hold a section starts with. */
  mounted: (section: string) => void;
  subscribe: (listener: () => void) => () => void;
  waitingOn: () => readonly string[];
};

function createPendingStore(sections: readonly string[]): PendingStore {
  const holds = new Map<string, number>();
  const listeners = new Set<() => void>();
  // Replaced, never mutated, so useSyncExternalStore sees a change only when
  // there is one.
  let waiting: readonly string[] = [];
  const emit = () => {
    waiting = [...holds.keys()];
    listeners.forEach((listener) => listener());
  };
  const hold = (section: string) => {
    holds.set(section, (holds.get(section) ?? 0) + 1);
    emit();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (holds.get(section) ?? 1) - 1;
      if (left > 0) holds.set(section, left);
      else holds.delete(section);
      emit();
    };
  };
  // Every section starts held, so the export never reads as ready in the
  // moment between the tabs rendering and their effects saying what they are
  // still loading.
  const mountHolds = new Map(sections.map((section) => [section, hold(section)]));
  return {
    hold,
    mounted: (section) => mountHolds.get(section)?.(),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    waitingOn: () => waiting,
  };
}

const SectionContext = createContext<{ store: PendingStore; section: string } | null>(null);

/**
 * Holds the export's print while `pending` is true. Pass the tab's own "still
 * loading" flag. Outside an export it does nothing, so the same tab component
 * serves the page and the PDF.
 */
export function useExportPending(pending: boolean) {
  const context = useContext(SectionContext);
  useEffect(() => {
    if (!context || !pending) return;
    return context.store.hold(context.section);
  }, [context, pending]);
}

// ── The frame ──────────────────────────────────────────────────────────────

/** The frame's text of a stylesheet, including rules a script added with insertRule (which never reach textContent). */
function styleText(style: HTMLStyleElement): string {
  if (style.textContent) return style.textContent;
  try {
    return Array.from(style.sheet?.cssRules ?? [], (rule) => rule.cssText).join('\n');
  } catch {
    return '';
  }
}

/**
 * Gives the frame the page's stylesheets, fonts and palette, in the light
 * theme, plus its own rules (`css`). Resolves once every stylesheet has
 * loaded, so no chart measures itself against an unstyled layout.
 */
function dressFrame(source: Document, frame: Document, title: string, css: string): Promise<void> {
  for (const name of ['lang', 'class', 'style']) {
    const value = source.documentElement.getAttribute(name);
    if (value != null) frame.documentElement.setAttribute(name, value);
  }
  frame.documentElement.classList.remove('dark');
  frame.body.className = source.body.className;
  frame.title = title;

  const loads: Array<Promise<void>> = [];
  source.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    if (node.tagName === 'LINK') {
      const link = frame.createElement('link');
      link.rel = 'stylesheet';
      link.href = (node as HTMLLinkElement).href;
      link.media = (node as HTMLLinkElement).media;
      loads.push(new Promise<void>((resolve) => {
        link.onload = () => resolve();
        link.onerror = () => resolve();
      }));
      frame.head.appendChild(link);
    } else {
      const style = frame.createElement('style');
      style.textContent = styleText(node as HTMLStyleElement);
      frame.head.appendChild(style);
    }
  });
  const own = frame.createElement('style');
  own.textContent = css;
  frame.head.appendChild(own);
  return Promise.all(loads).then(() => undefined);
}

// The frame's nodes belong to its own document, where `instanceof Element`
// (this window's Element) is false for every one of them; nodeType is not.
function insideSvg(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest('svg') != null;
}

/**
 * Calls `onStill` once nothing inside a chart has changed for STILL_MS, i.e.
 * every draw-in animation has finished. Only <svg> changes count: the
 * conveyor's countdowns tick every second and would otherwise never let it
 * settle. Returns a function that stops watching.
 */
function whenChartsStill(root: HTMLElement, onStill: () => void): () => void {
  let quiet = window.setTimeout(finish, STILL_MS);
  const cap = window.setTimeout(finish, STILL_CAP_MS);
  const observer = new MutationObserver((records) => {
    if (!records.some((record) => insideSvg(record.target))) return;
    window.clearTimeout(quiet);
    quiet = window.setTimeout(finish, STILL_MS);
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  function stop() {
    observer.disconnect();
    window.clearTimeout(quiet);
    window.clearTimeout(cap);
  }
  function finish() {
    stop();
    onStill();
  }
  return stop;
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ── The document ───────────────────────────────────────────────────────────

export type ExportSection = { id: string; label: string; content: ReactNode };

function Section({ store, label, children }: { store: PendingStore; label: string; children: ReactNode }) {
  const context = useMemo(() => ({ store, section: label }), [store, label]);
  // Effects run children first, so by the time this one runs the tab has
  // already said what it is still loading.
  useEffect(() => store.mounted(label), [store, label]);
  return (
    <section className="zg-export-section">
      <h2 className="zg-h2 pb-2 mb-6" style={{ borderBottom: '1px solid var(--color-border)' }}>{label}</h2>
      <SectionContext.Provider value={context}>{children}</SectionContext.Provider>
    </section>
  );
}

function ExportDocument({ title, stamp, sections, store }: {
  title: string;
  stamp: string;
  sections: ExportSection[];
  store: PendingStore;
}) {
  return (
    <div className="zg-export" style={{ color: 'var(--color-text-primary)' }}>
      <header className="flex items-end justify-between gap-6 mb-10">
        <div>
          <div className="zg-eyebrow">ZeroGEX</div>
          <h1 className="zg-h1">{title}</h1>
        </div>
        <div className="text-sm text-right" style={{ color: 'var(--color-text-secondary)' }}>
          <div>{stamp}</div>
          <div>{sections.map((section) => section.label).join(' · ')}</div>
        </div>
      </header>
      {sections.map((section) => (
        <Section key={section.id} store={store} label={section.label}>
          {section.content}
        </Section>
      ))}
    </div>
  );
}

/**
 * The export overlay. Renders `sections` into a page-width frame, waits until
 * none is loading and the charts have stopped drawing, then opens the print
 * dialog on the frame. Closes itself when the dialog does.
 */
export default function PdfExport({ title, at, sections, onClose }: {
  title: string;
  /** When the export was asked for: stamped on the first page and in the filename. */
  at: Date;
  sections: ExportSection[];
  /** Must be stable: it is the afterprint listener. */
  onClose: () => void;
}) {
  const [store] = useState(() => createPendingStore(sections.map((section) => section.label)));
  const waitingOn = useSyncExternalStore(store.subscribe, store.waitingOn, store.waitingOn);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [frameDoc, setFrameDoc] = useState<Document | null>(null);
  const [printing, setPrinting] = useState(false);
  // Save as PDF offers the page title as the file name.
  const fileName = `ZeroGEX ${title} ${isoDay(at)}`;
  const stamp = `Exported ${at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;

  const onFrameLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    void dressFrame(document, doc, fileName, frameCss(title, stamp)).then(() => setFrameDoc(doc));
  }, [fileName, title, stamp]);

  const print = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    // Painted before the dialog opens: print() blocks the page until it closes.
    flushSync(() => setPrinting(true));
    win.addEventListener('afterprint', onClose, { once: true });
    win.focus();
    win.print();
  }, [onClose]);

  // Print once no section is loading and the charts are still. The store is
  // read live as well as through `waitingOn`, which is as of this render: a
  // tab's effect earlier in this same commit may have taken a hold since.
  useEffect(() => {
    if (!frameDoc || printing || waitingOn.length > 0 || store.waitingOn().length > 0) return;
    let cancelled = false;
    const stopWatching = whenChartsStill(frameDoc.body, () => {
      void frameDoc.fonts.ready.then(() => {
        if (!cancelled && store.waitingOn().length === 0) print();
      });
    });
    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [frameDoc, printing, waitingOn, store, print]);

  // The parent page's title too, in case a browser names the file after the
  // top window rather than the frame it prints.
  useEffect(() => {
    const previous = document.title;
    document.title = fileName;
    return () => {
      document.title = previous;
    };
  }, [fileName]);

  // Escape closes, wherever focus is: the page or the preview frame.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const targets = [window, frameDoc?.defaultView].filter((target) => target != null);
    targets.forEach((target) => target.addEventListener('keydown', onKey));
    return () => targets.forEach((target) => target.removeEventListener('keydown', onKey));
  }, [onClose, frameDoc]);

  // The tabs re-render only when their sections change, not every time the
  // status line below does.
  const content = useMemo(
    () => <ExportDocument title={title} stamp={stamp} sections={sections} store={store} />,
    [title, stamp, sections, store],
  );

  const status = printing
    ? 'Print dialog open. Choose “Save as PDF” as the destination.'
    : !frameDoc
      ? 'Preparing…'
      : waitingOn.length > 0
        ? `Loading ${waitingOn.join(', ')}…`
        : 'Drawing charts…';

  return (
    <>
      {createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Export to PDF"
          className="fixed inset-0 z-[100] flex flex-col"
          style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
            style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold">Export to PDF</div>
              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }} aria-live="polite">{status}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={print}
                disabled={!frameDoc || printing}
                title="Print without waiting for everything to finish loading"
                className="px-3 py-1.5 text-xs font-semibold rounded-md"
                style={{ border: '1px solid var(--color-border)', opacity: !frameDoc || printing ? 0.5 : 1 }}
              >
                Print now
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <X size={14} aria-hidden />
                Close
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <iframe
              ref={frameRef}
              title="PDF export preview"
              srcDoc={FRAME_HTML}
              onLoad={onFrameLoad}
              className="block mx-auto h-full border-0"
              style={{ width: FRAME_WIDTH }}
            />
          </div>
        </div>,
        document.body,
      )}
      {frameDoc && createPortal(content, frameDoc.body)}
    </>
  );
}
