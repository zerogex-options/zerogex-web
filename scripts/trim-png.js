#!/usr/bin/env node
/**
 * trim-png.js — crop the fully transparent border off a PNG.
 *
 * `make logo` uses this when deploying the branding PNGs to frontend/public.
 * The exported brand assets in assets/branding/ carry different amounts of
 * empty canvas around the artwork (Dark_Title.png is 1672x941 around 1591x480
 * of ink, Light_Title.png is 1448x1086 around 1368x410), so dropping them into
 * a fixed-height header straight from the exporter would render the same logo
 * at two visibly different sizes depending on the theme. Trimming on the way
 * into public/ makes every variant tightly cropped, so the layout can size the
 * artwork itself and stay stable when the theme flips — and it keeps the source
 * files in assets/branding/ untouched, so re-exporting from the design tool
 * needs no manual cleanup.
 *
 * Deliberately dependency-free (node's built-in zlib only): it runs on the
 * deploy box before `npm install` has necessarily put anything usable in
 * frontend/node_modules.
 *
 * Usage: node scripts/trim-png.js <src.png> <dest.png> [--max-width N] [--alpha N]
 *
 *   --max-width N  box-downscale the trimmed artwork to at most N pixels wide
 *                  (the exports are ~1600px wide; nothing on the site draws
 *                  the logo above ~400 CSS px, so this keeps the file the
 *                  browser downloads sane without touching the source asset)
 *   --alpha N      treat alpha <= N as empty canvas (default 2). The exports
 *                  carry a near-invisible haze of alpha-1 pixels across the
 *                  whole canvas; trimming at exactly 0 would keep all of it.
 *
 * Anything it cannot decode (interlaced, 16-bit, palette, no alpha channel) is
 * copied through verbatim with a warning rather than failing the deploy.
 */

const fs = require('fs');
const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Parse a PNG into {width, height, channels, pixels} with 8-bit samples. */
function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('not a PNG');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  for (let off = 8; off + 8 <= buf.length; ) {
    const length = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType}`);
  if (colorType !== 4 && colorType !== 6) throw new Error('no alpha channel to trim on');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);

  // Undo the per-scanline filters (PNG spec §9.2).
  for (let y = 0, pos = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`unknown scanline filter ${filter}`);
      }
      cur[x] = v & 0xff;
    }
  }

  return { width, height, channels, colorType, pixels };
}

/** Bounding box of every pixel carrying more than `alphaFloor` of opacity. */
function inkBounds({ width, height, channels, pixels }, alphaFloor) {
  const alphaOffset = channels - 1;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (pixels[(row + x) * channels + alphaOffset] <= alphaFloor) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null; // fully transparent image
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function crop(image, box) {
  const { channels, width, pixels } = image;
  const out = Buffer.alloc(box.width * box.height * channels);
  for (let y = 0; y < box.height; y++) {
    const from = ((box.y + y) * width + box.x) * channels;
    pixels.copy(out, y * box.width * channels, from, from + box.width * channels);
  }
  return { ...image, width: box.width, height: box.height, pixels: out };
}

/**
 * Box-filter downscale to `targetWidth`, averaging in premultiplied alpha so
 * the transparent pixels around the artwork can't bleed their color into the
 * edges. Returns the image untouched when it is already narrow enough.
 */
function downscale(image, targetWidth) {
  const { width, height, channels, pixels } = image;
  if (!targetWidth || width <= targetWidth) return image;

  const outWidth = targetWidth;
  const outHeight = Math.max(1, Math.round((height * targetWidth) / width));
  const out = Buffer.alloc(outWidth * outHeight * channels);
  const alphaOffset = channels - 1;
  const xScale = width / outWidth;
  const yScale = height / outHeight;
  const sums = new Float64Array(channels);

  for (let y = 0; y < outHeight; y++) {
    const y0 = Math.floor(y * yScale);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil((y + 1) * yScale)));
    for (let x = 0; x < outWidth; x++) {
      const x0 = Math.floor(x * xScale);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil((x + 1) * xScale)));
      sums.fill(0);
      let count = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const at = (sy * width + sx) * channels;
          const alpha = pixels[at + alphaOffset];
          for (let c = 0; c < alphaOffset; c++) sums[c] += (pixels[at + c] * alpha) / 255;
          sums[alphaOffset] += alpha;
          count++;
        }
      }
      const at = (y * outWidth + x) * channels;
      const alpha = sums[alphaOffset] / count;
      out[at + alphaOffset] = Math.round(alpha);
      for (let c = 0; c < alphaOffset; c++) {
        out[at + c] = alpha > 0 ? Math.min(255, Math.round((sums[c] / count) * (255 / alpha))) : 0;
      }
    }
  }

  return { ...image, width: outWidth, height: outHeight, pixels: out };
}

/**
 * Re-encode, picking the filter that minimizes the sum of absolute
 * differences per scanline — the heuristic from the PNG spec, and what keeps
 * the cropped file from ballooning past the original.
 */
function encodePng({ width, height, channels, colorType, pixels }) {
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  const candidate = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const cur = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    let bestFilter = 0;
    let bestScore = Infinity;
    let best = null;

    for (let filter = 0; filter <= 4; filter++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? cur[x - channels] : 0;
        const b = prev ? prev[x] : 0;
        const c = prev && x >= channels ? prev[x - channels] : 0;
        let v;
        switch (filter) {
          case 0: v = cur[x]; break;
          case 1: v = cur[x] - a; break;
          case 2: v = cur[x] - b; break;
          case 3: v = cur[x] - ((a + b) >> 1); break;
          default: {
            const p = a + b - c;
            const pa = Math.abs(p - a);
            const pb = Math.abs(p - b);
            const pc = Math.abs(p - c);
            v = cur[x] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          }
        }
        candidate[x] = v & 0xff;
        score += Math.min(candidate[x], 256 - candidate[x]);
      }
      if (score < bestScore) {
        bestScore = score;
        bestFilter = filter;
        best = Buffer.from(candidate);
      }
    }

    raw[y * (stride + 1)] = bestFilter;
    best.copy(raw, y * (stride + 1) + 1);
  }

  const chunks = [PNG_SIGNATURE];
  const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
    return out;
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function parseArgs(argv) {
  const positional = [];
  const options = { maxWidth: 0, alpha: 2 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--max-width') options.maxWidth = Number(argv[++i]);
    else if (argv[i] === '--alpha') options.alpha = Number(argv[++i]);
    else positional.push(argv[i]);
  }
  const [src, dest] = positional;
  if (!src || !dest || !Number.isFinite(options.maxWidth) || !Number.isFinite(options.alpha)) {
    console.error('usage: node scripts/trim-png.js <src.png> <dest.png> [--max-width N] [--alpha N]');
    process.exit(2);
  }
  return { src, dest, ...options };
}

function main() {
  const { src, dest, maxWidth, alpha } = parseArgs(process.argv.slice(2));

  const input = fs.readFileSync(src);
  let image;
  try {
    image = decodePng(input);
  } catch (err) {
    console.warn(`  ⚠ ${src}: ${err.message} — copied without trimming`);
    fs.writeFileSync(dest, input);
    return;
  }

  const source = `${image.width}x${image.height}`;
  const box = inkBounds(image, alpha);
  if (!box) {
    console.warn(`  ⚠ ${src}: fully transparent — copied without trimming`);
    fs.writeFileSync(dest, input);
    return;
  }

  const trimmed = downscale(crop(image, box), maxWidth);
  const output = encodePng(trimmed);
  fs.writeFileSync(dest, output);
  console.log(
    `  ✓ ${dest} (${source} → ${trimmed.width}x${trimmed.height}, ` +
      `${Math.round(input.length / 1024)}KB → ${Math.round(output.length / 1024)}KB)`,
  );
}

main();
