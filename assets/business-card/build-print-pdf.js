#!/usr/bin/env node
/*
 * ZeroGEX business-card -> print PDF
 * ----------------------------------
 * Wraps zerogex-card.png in a 0.125" full-bleed (edge-replicated) and lays it
 * out on a sheet with crop marks at the 3.5"x2" trim. Run build-card.js first.
 *
 * Requirements:  npm i playwright
 * Run:           node build-print-pdf.js
 * Output:        zerogex-card-print.pdf   (send this to the printer)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const OUT = path.join(HERE, 'zerogex-card-print.pdf');
const cardPng = `data:image/png;base64,${fs.readFileSync(path.join(HERE,'zerogex-card.png')).toString('base64')}`;

// Geometry, inches (page top-left origin)
const PW = 4.1, PH = 2.6;                        // sheet
const trim = { l:0.3, t:0.3, r:3.8, b:2.3 };     // 3.5 x 2, centered
const BL = 0.175;                                // bleed-box origin (trim - 0.125")
const BW = 3.75, BH = 2.25;                       // bleed box size
const GAP = 0.125, LEN = 0.11, TH = 0.008;        // crop-mark gap(=bleed), length, thickness

const bar = (x,y,w,h) => `<div style="position:absolute;left:${x}in;top:${y}in;width:${w}in;height:${h}in;background:#000;"></div>`;
const marks = [
  bar(trim.l-TH/2, trim.t-GAP-LEN, TH, LEN), bar(trim.l-GAP-LEN, trim.t-TH/2, LEN, TH), // TL
  bar(trim.r-TH/2, trim.t-GAP-LEN, TH, LEN), bar(trim.r+GAP,      trim.t-TH/2, LEN, TH), // TR
  bar(trim.l-TH/2, trim.b+GAP,     TH, LEN), bar(trim.l-GAP-LEN, trim.b-TH/2, LEN, TH), // BL
  bar(trim.r-TH/2, trim.b+GAP,     TH, LEN), bar(trim.r+GAP,      trim.b-TH/2, LEN, TH), // BR
].join('');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  // Build the full-bleed image: card centered on a canvas, edges replicated 0.125" (75px @600dpi).
  const bleed = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight, b = Math.round(w/28);   // 2100/28 = 75px = 0.125"
    const c = document.createElement('canvas'); c.width = w+2*b; c.height = h+2*b;
    const g = c.getContext('2d');
    g.drawImage(img, b, b);
    g.drawImage(img, 0,0,1,h, 0,b,b,h);            g.drawImage(img, w-1,0,1,h, b+w,b,b,h);   // L / R
    g.drawImage(img, 0,0,w,1, b,0,w,b);            g.drawImage(img, 0,h-1,w,1, b,b+h,w,b);   // T / B
    g.drawImage(img, 0,0,1,1, 0,0,b,b);            g.drawImage(img, w-1,0,1,1, b+w,0,b,b);   // TL / TR
    g.drawImage(img, 0,h-1,1,1, 0,b+h,b,b);        g.drawImage(img, w-1,h-1,1,1, b+w,b+h,b,b);// BL / BR
    return c.toDataURL('image/png');
  }, cardPng);

  const html = `<!doctype html><html><head><style>
    @page{ margin:0; }
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:${PW}in;height:${PH}in;background:#fff;}
    .sheet{position:relative;width:${PW}in;height:${PH}in;overflow:hidden;}
  </style></head><body><div class="sheet">
    <img src="${bleed}" style="position:absolute;left:${BL}in;top:${BL}in;width:${BW}in;height:${BH}in;"/>
    ${marks}
  </div></body></html>`;

  await page.setContent(html, { waitUntil:'networkidle' });
  // Chromium's page.pdf overshoots the requested size by ~0.01in; compensate.
  await page.pdf({ path: OUT, width: `${PW-0.01}in`, height: `${PH-0.01}in`,
    printBackground: true, margin:{top:0,right:0,bottom:0,left:0}, scale:1, pageRanges:'1' });
  await browser.close();
  console.log('wrote', path.basename(OUT));
})();
