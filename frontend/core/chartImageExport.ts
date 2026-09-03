// Dependency-free SVG→PNG export for the hand-rolled chart SVGs.
//
// The sibling exporter in app/live-bulletin/imageExport.ts rasterizes an HTML
// node through a <foreignObject>; this one rasterizes a native <svg> directly,
// which is both simpler and sharper — but it cannot reuse that module, because
// the charts are styled almost entirely with CSS custom properties
// (fill="var(--color-bull)", color-mix(...), fontFamily "var(--font-mono)").
//
// A serialized clone leaves the document behind, and with it every stylesheet
// that gave those variables a value. `var(--color-bull)` resolves to nothing in
// a standalone data: URL, so the naive "serialize and rasterize" export comes
// back as a black rectangle with invisible text. core/pinStrike.ts already
// documents this trap for the bulletin card (PIN_STRIKE_COLOR_HEX exists for
// exactly that reason); the charts declare far too many colors to hand-maintain
// hex twins for, so instead we ask the browser what each one actually resolved
// to and bake the literal value onto the clone.
//
// Fonts need the same treatment for the same reason, and it is worth doing
// properly. An <img> rasterizing a data: URL cannot reach the @font-face files
// the page loaded, so the export falls back down the stack to whatever generic
// the OS supplies — which on a chart of tabular numbers means a proportional
// serif where the UI shows JetBrains Mono. So the used faces are fetched
// (same-origin, from Next's own hashed asset paths) and inlined as base64
// @font-face rules, and only the faces the chart actually references: the theme
// ships ten families, and embedding the nine it isn't using would cost far more
// than the export is worth. Every step is fail-soft — a font that can't be read
// just isn't embedded, and that glyph run lands on the generic fallback the
// theme already declares behind it.

// The subset of computed properties that actually carry a chart SVG's
// appearance. Copying every property getComputedStyle exposes would work too,
// but it is ~340 declarations per element across a few thousand elements — big
// enough to slow the export noticeably and to blow past the data: URL sizes
// some browsers will parse.
const PAINTED_PROPERTIES = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'color',
  'stop-color',
  'stop-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant-numeric',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
  'mix-blend-mode',
  'display',
  'visibility',
] as const;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize chart SVG'));
    img.src = url;
  });
}

// Copy resolved paint/text styles from each live element onto its clone.
//
// querySelectorAll returns document order, and `clone` is a deep copy of
// `source`, so the two lists are the same length and index-aligned — the
// standard way to walk an original and its clone in lockstep without tagging
// every node first.
function inlineComputedStyles(source: SVGSVGElement, clone: SVGSVGElement): Set<string> {
  const sourceNodes: Element[] = [source, ...Array.from(source.querySelectorAll('*'))];
  const cloneNodes: Element[] = [clone, ...Array.from(clone.querySelectorAll('*'))];
  const families = new Set<string>();

  for (let i = 0; i < sourceNodes.length; i += 1) {
    const target = cloneNodes[i] as SVGElement | undefined;
    if (!target) break;
    const computed = window.getComputedStyle(sourceNodes[i]);
    let declarations = '';
    for (const property of PAINTED_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      // An empty value means the property does not apply to this element (most
      // of them don't, for most elements). `none`/`normal` are real answers and
      // are kept: an element whose fill is genuinely none must not inherit one
      // from a parent that we just made explicit.
      if (!value) continue;
      if (property === 'font-family') for (const name of splitFontStack(value)) families.add(name);
      declarations += `${property}:${value};`;
    }
    if (declarations) target.setAttribute('style', declarations);
  }
  return families;
}

/** "A, 'B C', monospace" → ['A', 'B C', 'monospace'] (quotes stripped). */
function splitFontStack(stack: string): string[] {
  return stack
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// Total base64 font payload we are willing to put in one data: URL. Two woff2
// faces land far under this; the cap exists so a theme change that pulls a
// dozen families into the chart degrades to the generic fallback instead of
// silently producing a data: URL too large for the rasterizer to parse.
const MAX_EMBEDDED_FONT_BYTES = 900_000;

async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return `data:font/woff2;base64,${btoa(binary)}`;
  } catch {
    // Cross-origin, offline, or blocked — the caller falls back to the stack.
    return null;
  }
}

/**
 * Build a <style> block of @font-face rules, with the font binaries inlined as
 * data URIs, for exactly the families the chart uses.
 *
 * next/font emits two faces per family: a real one with a url() src, and a
 * `…_Fallback` face whose src is local() with size-adjust metrics. Only the
 * former can be embedded; the latter is skipped, which is harmless — it exists
 * to stop layout shift during load, and there is no load in a raster.
 */
async function embeddedFontCss(families: Set<string>): Promise<string> {
  if (families.size === 0) return '';
  const wanted = new Set(Array.from(families, (f) => f.toLowerCase()));
  const rules: string[] = [];
  const seenUrls = new Map<string, string>();
  let budget = MAX_EMBEDDED_FONT_BYTES;

  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      // A cross-origin stylesheet throws on access. Nothing to do but skip it.
      continue;
    }
    for (const rule of Array.from(cssRules)) {
      if (!rule.cssText.trimStart().startsWith('@font-face')) continue;
      const style = (rule as CSSStyleRule).style;
      if (!style) continue;
      const family = splitFontStack(style.getPropertyValue('font-family'))[0];
      if (!family || !wanted.has(family.toLowerCase())) continue;

      const src = style.getPropertyValue('src');
      const url = /url\(["']?([^"')]+)["']?\)/.exec(src)?.[1];
      if (!url) continue; // a local()-only fallback face

      let dataUri = seenUrls.get(url);
      if (dataUri === undefined) {
        const fetched = await fetchAsDataUri(new URL(url, document.baseURI).href);
        if (!fetched) continue;
        if (fetched.length > budget) continue;
        budget -= fetched.length;
        dataUri = fetched;
        seenUrls.set(url, dataUri);
      }

      const descriptor = (name: string) => {
        const value = style.getPropertyValue(name);
        return value ? `${name}:${value};` : '';
      };
      rules.push(
        `@font-face{font-family:'${family}';src:url(${dataUri}) format('woff2');` +
          descriptor('font-weight') +
          descriptor('font-style') +
          descriptor('font-display') +
          descriptor('unicode-range') +
          '}',
      );
    }
  }
  return rules.join('');
}

export interface ChartPngOptions {
  /** Device-pixel multiplier for the raster. 2 matches the bulletin exporter. */
  scale?: number;
  /** Painted under the chart — the SVG itself is transparent. */
  background?: string;
}

/**
 * Rasterize a chart's <svg> to a PNG blob at its intrinsic viewBox size.
 *
 * Exporting from the viewBox rather than the on-screen box makes the output
 * independent of how the chart is currently laid out: the same image comes back
 * from a narrow window, and from a phone where MobileScrollableChart has the
 * chart scrolled halfway across a 1000px-min-width track.
 */
export async function chartSvgToPngBlob(
  svg: SVGSVGElement,
  { scale = 2, background = '#04141E' }: ChartPngOptions = {},
): Promise<Blob> {
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox?.width || svg.getBoundingClientRect().width || 1360;
  const height = viewBox?.height || svg.getBoundingClientRect().height || 636;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const families = inlineComputedStyles(svg, clone);

  const fontCss = await embeddedFontCss(families);
  if (fontCss) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
  }

  // On screen the SVG is width="100%" inside a flexible column. A serialized
  // copy has no column to fill, so it needs its intrinsic size stated outright
  // or the rasterizer falls back to a 300x150 default box.
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  // Cursor/user-select styles are meaningless in a raster and `aspect-ratio`
  // fights the explicit width/height we just set.
  clone.removeAttribute('class');

  const serialized = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  const img = await loadImage(url);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced an empty blob'))),
      'image/png',
    );
  });
}

/** Hand a blob to the browser as a download, then release the object URL. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking synchronously can race the click in Safari; a task boundary is
  // enough for the download to have been handed off.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Read a CSS custom property off an element as a literal color.
 *
 * The chart body's background is `var(--bg-card)`, which the canvas needs as an
 * actual color before it can paint it. Resolving it from the live element (as
 * opposed to hardcoding a hex) keeps the export correct in whichever theme the
 * user is on.
 */
export function resolvedBackground(el: Element | null, fallback = '#04141E'): string {
  if (!el) return fallback;
  const value = window.getComputedStyle(el).backgroundColor;
  // A transparent computed background means the element is showing whatever is
  // behind it, which a standalone PNG has none of — use the fallback.
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return fallback;
  return value;
}
