// Dependency-free DOM→PNG export.
//
// The communiqué card is rendered with 100% inline styles, which lets us avoid
// a heavyweight capture library (html-to-image et al.) entirely: we serialize
// the node, drop it into an SVG <foreignObject>, rasterize that through an
// <img>, and paint it onto a 2x canvas. Because the SVG references no
// cross-origin resources the canvas stays untainted, so toDataURL / toBlob
// both succeed.
//
// An SVG drawn as an image sees none of the page's CSS and may not fetch
// anything, so two things are carried into it: custom properties (the card's
// font stack is var(--font-body), …, and one unresolved var() voids the whole
// declaration, which set the export in the browser's default serif) are
// resolved on the clone, and the web fonts the card is set in are inlined as
// data: URLs, as the chart and page exports do (core/chartImageExport.ts).

import { embeddedFontCss, splitFontStack } from '@/core/chartImageExport';

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize report SVG'));
    img.src = url;
  });
}

// Inline style values that read custom properties, replaced with what they
// compute to on the live node.
function resolveCustomProperties(src: Element, dst: Element): void {
  if (src instanceof HTMLElement && dst instanceof HTMLElement && src.style.cssText.includes('var(')) {
    const computed = getComputedStyle(src);
    for (let i = 0; i < src.style.length; i++) {
      const prop = src.style.item(i);
      if (src.style.getPropertyValue(prop).includes('var(')) {
        dst.style.setProperty(prop, computed.getPropertyValue(prop));
      }
    }
  }
  for (let i = 0; i < src.children.length && i < dst.children.length; i++) {
    resolveCustomProperties(src.children[i], dst.children[i]);
  }
}

// Every family the node's text is set in. The shared helper embeds the ones
// the page loaded as web fonts and skips the rest (system and generic names).
function fontFamiliesIn(node: HTMLElement): Set<string> {
  const families = new Set<string>();
  for (const el of [node, ...Array.from(node.querySelectorAll('*'))]) {
    for (const name of splitFontStack(getComputedStyle(el).fontFamily)) families.add(name);
  }
  return families;
}

async function renderToCanvas(
  node: HTMLElement,
  scale: number,
  background: string,
): Promise<HTMLCanvasElement> {
  // Layout size, not on-screen size: the preview may be scaled down with a CSS
  // transform to fit a narrow column, which getBoundingClientRect would report
  // (cropping the clone, which renders at its full layout size).
  const width = Math.ceil(node.offsetWidth);
  const height = Math.ceil(node.offsetHeight);

  // Clone so the live node is untouched, and tag the clone with the XHTML
  // namespace foreignObject requires to parse arbitrary HTML.
  const clone = node.cloneNode(true) as HTMLElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  resolveCustomProperties(node, clone);
  // Pinned to the measured size, so should the text still set a little
  // differently in the image, the card's own background fills the canvas
  // rather than leaving a strip of canvas color under it.
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  const fontCss = await embeddedFontCss(fontFamiliesIn(node));
  if (fontCss) {
    const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
  }

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">${serialized}</foreignObject>` +
    `</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export async function nodeToPngDataUrl(
  node: HTMLElement,
  scale = 2,
  background = '#04141E',
): Promise<string> {
  const canvas = await renderToCanvas(node, scale, background);
  return canvas.toDataURL('image/png');
}

export async function nodeToPngBlob(
  node: HTMLElement,
  scale = 2,
  background = '#04141E',
): Promise<Blob> {
  const canvas = await renderToCanvas(node, scale, background);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas produced an empty blob'))),
      'image/png',
    );
  });
}

// Rasterize a same-origin image (the brand lockup served from /public) into a
// PNG data URL. We do this once on the client so the logo can be embedded
// directly in the card: a data URL renders inside the export's <foreignObject>
// rasterization, whereas a plain `/title-dark.png` <img> ref would be dropped.
// Same-origin content keeps the canvas untainted, so toDataURL succeeds.
export async function rasterizeImage(url: string, targetWidth: number): Promise<string> {
  const img = await loadImage(url);
  const ratio =
    img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 388 / 1280;
  const width = targetWidth;
  const height = Math.max(1, Math.round(targetWidth * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}
