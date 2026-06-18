// Dependency-free DOM→PNG export.
//
// The communiqué card is rendered with 100% inline styles and contains no
// images or web-fonts, which lets us avoid a heavyweight capture library
// (html-to-image et al.) entirely: we serialize the node, drop it into an
// SVG <foreignObject>, rasterize that through an <img>, and paint it onto a
// 2x canvas. Because the SVG references no cross-origin resources the canvas
// stays untainted, so toDataURL / toBlob both succeed.

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize report SVG'));
    img.src = url;
  });
}

async function renderToCanvas(
  node: HTMLElement,
  scale: number,
  background: string,
): Promise<HTMLCanvasElement> {
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  // Clone so the live node is untouched, and tag the clone with the XHTML
  // namespace foreignObject requires to parse arbitrary HTML.
  const clone = node.cloneNode(true) as HTMLElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

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
