// Whole-page PNG capture — the camera button in the app header.
//
// There are three exporters on the site now and they are not interchangeable,
// so it is worth saying which is which:
//
//   app/live-bulletin/imageExport.ts   one hand-built card, 100% inline styles
//   core/chartImageExport.ts           one chart's <svg>, paint properties inlined
//   this file                          an arbitrary page, stylesheets shipped
//
// The middle one explains why this one exists. Inlining resolved declarations
// onto every node works for a chart because an SVG's appearance is a short list
// of paint properties. A page's is not — it is utility classes, pseudo-elements,
// breakpoints and a few hundred custom properties — so this exporter ships the
// page's own CSS alongside the clone instead of trying to precompute its
// effect. core/pageSnapshotCss.ts does the selecting; this file does the DOM.
//
// The capture is framed rather than raw: a header band with the lockup, the
// page name and the timestamp, and a footer band with the permalink and the
// disclaimer. A bare crop of the viewport is a screenshot, which the reader
// could already take; what they cannot take is one that says what it is, when
// it was, and that it is not advice.
//
// Every step is fail-soft. A logo that will not load leaves a text wordmark, a
// font that cannot be read falls back down the stack, an image that will not
// fetch is dropped rather than left as a broken reference. The export is worth
// having slightly degraded; it is not worth failing over.

import { brandTitle } from '@/core/brand';
import {
  downloadBlob,
  embeddedFontCss,
  loadImage,
  resolvedBackground,
  splitFontStack,
} from '@/core/chartImageExport';
import {
  flattenSnapshotCss,
  resolveNestedSelector,
  resolveSnapshotTitle,
  type SnapshotRule,
  snapshotFileName,
} from '@/core/pageSnapshotCss';

export { downloadBlob, snapshotFileName, resolveSnapshotTitle };

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** The class the frame carries, and what `:root`/`html`/`body` are rewritten to. */
const ROOT_CLASS = 'zgx-snapshot-root';

/**
 * Opt a subtree out of captures: `<div data-snapshot="omit">`.
 *
 * For things that are furniture rather than content — an open dropdown, a
 * sticky CTA — which read as debris once frozen into an image.
 */
const OMIT_ATTR = '[data-snapshot="omit"]';

// Chrome refuses a canvas past 16384px on either axis (and Safari lower still).
// A tall dashboard at 2x can reach that, so the scale is dropped rather than
// the export failing on exactly the pages worth capturing.
const MAX_CANVAS_EDGE = 16384;
// Well under Chrome's ~268M-pixel ceiling, with room for the browser's own
// copy of the bitmap during toBlob.
const MAX_CANVAS_AREA = 96_000_000;

export interface PageSnapshotOptions {
  /** The element to capture. Defaults to the app's <main>. */
  node?: HTMLElement | null;
  /** Printed on the header band beside the symbol. */
  title: string;
  /** Printed ahead of the title. Omitted for pages that are not per-symbol. */
  symbol?: string | null;
  /** Printed on the footer band, e.g. `zerogex.io/hedging-flow`. */
  permalink: string;
  /** Device-pixel multiplier. 2 matches the other two exporters. */
  scale?: number;
}

/** What the header band's right column says under the page name. */
function stamp(): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(now);
  return `${date} · ${time} ET`;
}

/** Read a custom property off <html> as its resolved literal value. */
function token(name: string, fallback: string): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Walk a source subtree and its clone in lockstep, fixing up what a deep clone
 * cannot carry on its own.
 *
 * `querySelectorAll` returns document order and the clone is a deep copy, so
 * the two lists are index-aligned — the same lockstep trick core/chartImageExport
 * uses, for the same reason.
 */
function repairClone(source: HTMLElement, clone: HTMLElement): void {
  // A <canvas> serializes as an empty element: the bitmap lives in the context,
  // not the markup. Swap in an <img> of its current contents. Untainted canvases
  // only — a tainted one throws, and a missing heatmap beats a failed export.
  const sourceCanvases = Array.from(source.querySelectorAll('canvas'));
  const cloneCanvases = Array.from(clone.querySelectorAll('canvas'));
  for (let i = 0; i < sourceCanvases.length; i += 1) {
    const target = cloneCanvases[i];
    if (!target) break;
    let dataUrl: string | null = null;
    try {
      dataUrl = sourceCanvases[i].toDataURL('image/png');
    } catch {
      dataUrl = null;
    }
    const replacement = document.createElementNS(XHTML_NS, 'img') as HTMLImageElement;
    replacement.setAttribute('style', target.getAttribute('style') ?? '');
    replacement.setAttribute('class', target.getAttribute('class') ?? '');
    const box = sourceCanvases[i].getBoundingClientRect();
    replacement.setAttribute('width', String(Math.round(box.width)));
    replacement.setAttribute('height', String(Math.round(box.height)));
    if (dataUrl) replacement.setAttribute('src', dataUrl);
    target.replaceWith(replacement);
  }

  // Scroll offsets are state, not markup. Without this, a chart the reader has
  // scrolled halfway across (MobileScrollableChart's 1000px track on a phone)
  // exports from its left edge — a different picture than the one on screen.
  // A transform is paint-only, so it cannot disturb the layout being measured.
  const sourceNodes = Array.from(source.querySelectorAll<HTMLElement>('*'));
  const cloneNodes = Array.from(clone.querySelectorAll<HTMLElement>('*'));
  for (let i = 0; i < sourceNodes.length; i += 1) {
    const target = cloneNodes[i];
    if (!target) break;
    const { scrollLeft, scrollTop } = sourceNodes[i];
    if (!scrollLeft && !scrollTop) continue;
    const inner = target.firstElementChild as HTMLElement | null;
    if (!inner) continue;
    inner.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
  }

  for (const el of Array.from(clone.querySelectorAll(`script, ${OMIT_ATTR}`))) el.remove();
}

/**
 * Replace every remaining <img> src with an inlined data URI.
 *
 * An <img> rasterizing a data: URL is a closed world — it cannot reach back out
 * for a subresource — so an un-inlined reference does not render slowly, it
 * renders as nothing. Cross-origin and unreachable sources are dropped instead
 * of being left to fail silently in the raster.
 */
async function inlineImages(clone: HTMLElement): Promise<void> {
  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const absolute = new URL(src, document.baseURI);
        if (absolute.origin !== window.location.origin) {
          img.remove();
          return;
        }
        const response = await fetch(absolute.href);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        img.setAttribute('src', await blobToDataUri(blob));
      } catch {
        img.remove();
      }
    }),
  );
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Adapt the live CSSOM into the plain shapes core/pageSnapshotCss.ts works on.
 *
 * Rules are identified by shape rather than by `rule.type`, which is deprecated
 * and never had a constant for @layer — the wrapper Tailwind v4 puts everything
 * it emits inside. @font-face is skipped here because it is handled separately
 * (the binaries have to be inlined, not merely copied), and @keyframes because
 * nothing animates in a still.
 */
function collectStyleRules(rootCustomProperties: Set<string>): SnapshotRule[] {
  const adapt = (rule: CSSRule, parentSelector: string): SnapshotRule[] => {
    const text = rule.cssText.trimStart();
    if (
      text.startsWith('@font-face') ||
      text.startsWith('@keyframes') ||
      text.startsWith('@starting-style') ||
      text.startsWith('@charset') ||
      text.startsWith('@namespace')
    ) {
      return [];
    }
    // @property carries Tailwind v4's registered custom properties, including
    // their initial values. Dropping them leaves every un-set --tw-* invalid
    // rather than at its default, which takes shadows and rings with it.
    if (text.startsWith('@property')) return [{ kind: 'verbatim', cssText: rule.cssText }];

    // A style rule is identified by its selector and tested for FIRST, because
    // CSSStyleRule now inherits from CSSGroupingRule: every plain rule carries
    // an empty `cssRules` list, so a grouping check that ran first would
    // silently reclassify the entire stylesheet as empty blocks — which is
    // exactly what it did before this was written down.
    const style = rule as CSSStyleRule;
    if (typeof style.selectorText === 'string' && style.style) {
      const selector = resolveNestedSelector(style.selectorText, parentSelector);
      const out: SnapshotRule[] = [];

      // Note the custom properties declared at document level on the way past.
      // Those are the ones the frame re-resolves and pins inline, so the capture
      // comes out in the reader's theme and palette rather than the default one.
      if (!parentSelector && /(^|,)\s*(:root|html|body)\b/.test(style.selectorText)) {
        for (const property of Array.from(style.style)) {
          if (property.startsWith('--')) rootCustomProperties.add(property);
        }
      }

      // `style.cssText`, not a property-by-property rebuild. A shorthand whose
      // value contains var() — `gap: calc(var(--spacing) * 2.5)`, which is most
      // of a Tailwind v4 utility — is stored as a pending substitution: the
      // longhands enumerate but resolve to the empty string until the variable
      // is known. Rebuilding from them emits `row-gap:;column-gap:;` and the
      // declaration silently does nothing. cssText serializes the shorthand as
      // authored, var() and all.
      const declarations = style.style.cssText;
      if (declarations) out.push({ kind: 'style', selectorText: selector, declarations });

      // Nested children resolve against this rule's selector. Empty in the
      // build the app ships today, but nesting is what a framework emits when
      // it stops pre-flattening variants, and that is a silent change.
      for (const child of Array.from(style.cssRules ?? [])) out.push(...adapt(child, selector));
      return out;
    }

    const grouping = rule as CSSGroupingRule;
    if (grouping.cssRules) {
      const media = (rule as CSSMediaRule).media?.mediaText;
      const conditionKind: 'media' | 'supports' | 'none' = text.startsWith('@media')
        ? 'media'
        : text.startsWith('@supports')
          ? 'supports'
          : 'none';
      const conditionText =
        conditionKind === 'media'
          ? (media ?? (rule as CSSMediaRule).conditionText ?? '')
          : conditionKind === 'supports'
            ? ((rule as CSSSupportsRule).conditionText ?? '')
            : '';
      const rules: SnapshotRule[] = [];
      for (const child of Array.from(grouping.cssRules)) {
        rules.push(...adapt(child, parentSelector));
      }
      return [{ kind: 'group', conditionKind, conditionText, rules }];
    }
    return [];
  };

  const out: SnapshotRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin stylesheet throws on access; the app serves its own, so
      // in practice this is a third-party widget's sheet and not ours to ship.
      continue;
    }
    for (const rule of Array.from(rules)) out.push(...adapt(rule, ''));
  }
  return out;
}

/** Families named anywhere in the capture's CSS, for @font-face embedding. */
function familiesIn(css: string, extra: string[]): Set<string> {
  const families = new Set<string>();
  for (const value of extra) for (const name of splitFontStack(value)) families.add(name);
  for (const match of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
    for (const name of splitFontStack(match[1])) {
      // `var(--font-body)` cannot be resolved from the text, and the variables
      // it would resolve to are already in `extra`.
      if (!name.startsWith('var(')) families.add(name);
    }
  }
  return families;
}

interface FrameColors {
  page: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  bodyFont: string;
  monoFont: string;
}

function frameColors(): FrameColors {
  return {
    page: resolvedBackground(document.body, token('--bg-main', '#04141E')),
    card: token('--bg-card', '#04141E'),
    border: token('--border-default', 'rgba(255,211,128,0.16)'),
    text: token('--text-primary', '#FFF1E6'),
    muted: token('--text-secondary', '#D1B8A6'),
    bodyFont: token('--font-body', 'system-ui, sans-serif'),
    monoFont: token('--font-mono', 'ui-monospace, monospace'),
  };
}

function el(tag: string, style: string, text?: string): HTMLElement {
  const node = document.createElementNS(XHTML_NS, tag) as HTMLElement;
  node.setAttribute('style', style);
  if (text != null) node.textContent = text;
  return node;
}

/** The lockup, rasterized so it survives the foreignObject. Null if unavailable. */
async function brandMark(src: string, height: number): Promise<HTMLElement | null> {
  try {
    const img = await loadImage(src);
    const ratio = img.naturalWidth > 0 ? img.naturalWidth / img.naturalHeight : 1280 / 390;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(height * ratio * 2);
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const node = document.createElementNS(XHTML_NS, 'img') as HTMLImageElement;
    node.setAttribute('src', canvas.toDataURL('image/png'));
    node.setAttribute(
      'style',
      `height:${height}px;width:${Math.round(height * ratio)}px;display:block;`,
    );
    return node;
  } catch {
    return null;
  }
}

/**
 * Capture a page as a framed PNG.
 *
 * The clone is mounted off-screen at the source's own content width before it
 * is measured. Mounting is what makes the rest honest: the browser does a real
 * layout, `querySelector` can be asked which rules actually apply, and the
 * frame's height comes from the content rather than a guess. The width is the
 * source's own and is never re-chosen — charts render their SVG at whatever
 * width they were laid out at, so reflowing the clone narrower would crop them
 * rather than re-fit them.
 */
export async function capturePageSnapshot({
  node,
  title,
  symbol,
  permalink,
  scale = 2,
}: PageSnapshotOptions): Promise<Blob> {
  const source = node ?? document.querySelector('main');
  if (!(source instanceof HTMLElement)) throw new Error('Nothing to capture on this page');

  const colors = frameColors();
  const style = getComputedStyle(source);
  const contentWidth = Math.max(
    320,
    Math.round(
      source.clientWidth -
        Number.parseFloat(style.paddingLeft || '0') -
        Number.parseFloat(style.paddingRight || '0'),
    ),
  );
  const FRAME_PAD = 16;
  const width = contentWidth + FRAME_PAD * 2;

  const clone = source.cloneNode(true) as HTMLElement;
  repairClone(source, clone);
  // <main> carries the sidebar gutter and the header offset. Both are chrome
  // the capture has already excluded, so keeping them would frame the content
  // with 272px of nothing.
  clone.style.padding = '0';
  clone.style.margin = '0';
  clone.style.width = `${contentWidth}px`;

  const wrapper = document.createElementNS(XHTML_NS, 'div') as HTMLElement;
  // The frame answers to the same selectors <html> does, so `:root.dark` and
  // `:root.palette-*` — rewritten onto this class — still decide the palette.
  wrapper.setAttribute(
    'class',
    `${ROOT_CLASS} ${document.documentElement.className} ${document.body.className}`.trim(),
  );
  wrapper.setAttribute(
    'style',
    `width:${width}px;box-sizing:border-box;background:${colors.page};color:${colors.text};` +
      `font-family:${colors.bodyFont};display:block;`,
  );

  const header = el(
    'div',
    `display:flex;align-items:flex-end;justify-content:space-between;gap:24px;` +
      `padding:14px ${FRAME_PAD}px 12px;border-bottom:1px solid ${colors.border};`,
  );
  // The lockup file comes from core/brand.ts rather than a literal here: that
  // module exists to be the one place that knows which artwork is served, and
  // `make logo` re-exports against it.
  const mark = await brandMark(
    brandTitle(document.documentElement.classList.contains('dark')).src,
    22,
  );
  header.appendChild(
    mark ??
      el(
        'div',
        `font-size:17px;font-weight:800;letter-spacing:-0.4px;color:${colors.text};`,
        'zerogex.io',
      ),
  );
  const heading = el('div', 'text-align:right;');
  heading.appendChild(
    el(
      'div',
      `font-size:13px;font-weight:700;letter-spacing:0.01em;color:${colors.text};`,
      [symbol?.toUpperCase(), title].filter(Boolean).join(' · '),
    ),
  );
  heading.appendChild(
    el(
      'div',
      `margin-top:3px;font-family:${colors.monoFont};font-size:10.5px;color:${colors.muted};`,
      stamp(),
    ),
  );
  header.appendChild(heading);

  const body = el('div', `padding:${FRAME_PAD}px;`);
  body.appendChild(clone);

  const footer = el(
    'div',
    `display:flex;align-items:center;justify-content:space-between;gap:16px;` +
      `padding:9px ${FRAME_PAD}px 11px;border-top:1px solid ${colors.border};` +
      `font-family:${colors.monoFont};font-size:10px;color:${colors.muted};`,
  );
  footer.appendChild(el('div', '', permalink));
  footer.appendChild(
    el('div', 'text-align:right;', 'Educational analytics · not investment advice'),
  );

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  wrapper.appendChild(footer);

  // Mount off-screen so the browser lays the frame out for real. Left alone it
  // would still be painted, so it is pushed far enough out that no scrollbar or
  // flash of it can reach the reader.
  const stage = document.createElement('div');
  stage.setAttribute(
    'style',
    'position:fixed;left:-200000px;top:0;width:0;height:0;overflow:hidden;z-index:-1;' +
      'pointer-events:none;',
  );
  stage.appendChild(wrapper);
  document.body.appendChild(stage);

  let serialized = '';
  let height = 0;
  try {
    await inlineImages(clone);

    const rootCustomProperties = new Set<string>();
    const rules = collectStyleRules(rootCustomProperties);
    const css = flattenSnapshotCss(rules, {
      rootSelector: `.${ROOT_CLASS}`,
      matchesCapture: (selector) => {
        try {
          return wrapper.matches(selector) || wrapper.querySelector(selector) != null;
        } catch {
          // An unsupported or malformed selector is kept rather than dropped:
          // the cost of carrying one dead rule is a few bytes, the cost of
          // dropping a live one is a visibly wrong export.
          return true;
        }
      },
      conditionHolds: (kind, condition) => {
        try {
          if (!condition) return true;
          return kind === 'supports'
            ? CSS.supports(condition)
            : window.matchMedia(condition).matches;
        } catch {
          return true;
        }
      },
    });

    // Pin the resolved palette inline. The rewritten `:root` rules above would
    // mostly do this on their own, but only inline values are immune to a
    // cascade the flattening reordered — and getting these wrong costs the
    // capture every colour on it.
    const fontTokens: string[] = [];
    const rootStyle = getComputedStyle(document.documentElement);
    for (const property of rootCustomProperties) {
      const value = rootStyle.getPropertyValue(property);
      if (!value) continue;
      wrapper.style.setProperty(property, value.trim());
      if (property.startsWith('--font-')) fontTokens.push(value);
    }

    const fontCss = await embeddedFontCss(
      familiesIn(css, [...fontTokens, colors.bodyFont, colors.monoFont]),
    );
    height = Math.ceil(wrapper.getBoundingClientRect().height) || 600;

    // The <style> goes in only now. Mounted, it would have applied to the live
    // document — every rewritten `:root` rule landing on the real page.
    document.body.removeChild(stage);
    const styleEl = document.createElementNS(XHTML_NS, 'style');
    styleEl.textContent = fontCss + css;
    wrapper.insertBefore(styleEl, wrapper.firstChild);
    wrapper.setAttribute('xmlns', XHTML_NS);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const foreign = document.createElementNS(SVG_NS, 'foreignObject');
    foreign.setAttribute('x', '0');
    foreign.setAttribute('y', '0');
    foreign.setAttribute('width', String(width));
    foreign.setAttribute('height', String(height));
    foreign.appendChild(wrapper);
    svg.appendChild(foreign);
    serialized = new XMLSerializer().serializeToString(svg);
  } finally {
    if (stage.isConnected) document.body.removeChild(stage);
  }

  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`);

  // Both a per-edge cap and a total-area one: a tall dashboard clears the edge
  // limit comfortably and still lands on a canvas the browser refuses to
  // allocate, which surfaces as a blank PNG rather than an error.
  const effectiveScale = Math.min(
    scale,
    MAX_CANVAS_EDGE / Math.max(width, 1),
    MAX_CANVAS_EDGE / Math.max(height, 1),
    Math.sqrt(MAX_CANVAS_AREA / Math.max(width * height, 1)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * effectiveScale);
  canvas.height = Math.round(height * effectiveScale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = colors.page;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced an empty blob'))),
      'image/png',
    );
  });
}

/** Put a PNG on the clipboard. Returns false where the browser has no image write. */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
