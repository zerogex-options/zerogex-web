#!/usr/bin/env node
/*
 * ZeroGEX business-card generator (single-sided)
 * ----------------------------------------------
 * Renders a print-ready card + presentation mockup from the brand assets
 * in ../branding and the QR in ./qr-zerogex.svg.
 *
 * Requirements:  npm i playwright   (Chromium)
 * Run:           node build-card.js
 * Output:        zerogex-card.png, zerogex-card-mockup.png
 *
 * Card size:     3.5" x 2" (US standard) rendered at 600 DPI (2100 x 1200 px).
 *
 * ---- EDIT ME ----
 */
const CARD = {
  url:      'zerogex.io',
  offer:    '50% OFF YOUR FIRST YEAR',
  code:     'TARGET',
  // The QR carries the promo link so the rate is captured automatically on scan.
  // If you change it, regenerate qr-zerogex.svg:
  //   pip install segno && python -c "import segno;segno.make('https://zerogex.io/register?ref=TARGET',error='h').save('qr-zerogex.svg',scale=10,border=2,dark='#0E1B2A',light=None)"
  qrUrl: 'https://zerogex.io/register?ref=TARGET',
};
/* --------------------------------------------------------------- */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const branding = f => path.join(HERE, '..', 'branding', f);
const b64 = p => fs.readFileSync(p).toString('base64');
const A = {
  darkFull: `data:image/svg+xml;base64,${b64(branding('Dark_Full.svg'))}`,
  target:   `data:image/svg+xml;base64,${b64(branding('Target.svg'))}`,
  qr:       `data:image/svg+xml;base64,${b64(path.join(HERE, 'qr-zerogex.svg'))}`,
  sg:       `data:font/woff2;base64,${b64(path.join(HERE, 'fonts', 'spacegrotesk.woff2'))}`,
  jb:       `data:font/woff2;base64,${b64(path.join(HERE, 'fonts', 'jbmono.woff2'))}`,
};

const HEAD = `<style>
  @font-face{font-family:'Space Grotesk';font-weight:300 700;font-display:block;src:url('${A.sg}') format('woff2');}
  @font-face{font-family:'JetBrains Mono';font-weight:400 700;font-display:block;src:url('${A.jb}') format('woff2');}
  :root{--coral:#F4645F;--cream:#F4F1EC;--muted:#8CA3B8;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{background:transparent;}
  .card{position:relative;width:1050px;height:600px;overflow:hidden;
    font-family:'Space Grotesk',sans-serif;color:var(--cream);-webkit-font-smoothing:antialiased;}
  .mono{font-family:'JetBrains Mono',monospace;}
</style>`;

const FRONT = `<div class="card" id="card">
  <div style="position:absolute;inset:0;background:radial-gradient(120% 140% at 80% 50%, #1B3D59 0%, #12283C 42%, #0B1826 72%, #081320 100%);"></div>
  <!-- Large target watermark, bleeding off the right edge (card has overflow:hidden). -->
  <div style="position:absolute;top:300px;left:1080px;transform:translate(-50%,-50%);width:840px;height:840px;border-radius:50%;background:radial-gradient(circle,rgba(244,100,95,.13),transparent 58%);pointer-events:none;"></div>
  <img src="${A.target}" style="position:absolute;top:300px;left:1080px;transform:translate(-50%,-50%);width:780px;opacity:.20;pointer-events:none;"/>

  <!-- QR (enlarged), floating over the target on the right. -->
  <div style="position:absolute;top:50%;right:70px;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:22px;">
    <div style="position:relative;width:270px;height:270px;border-radius:24px;background:var(--cream);box-shadow:0 22px 48px rgba(0,0,0,.5), inset 0 0 0 1px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;">
      <img src="${A.qr}" style="width:222px;height:222px;display:block;"/>
      <div style="position:absolute;width:58px;height:58px;border-radius:50%;background:var(--cream);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px var(--cream);">
        <img src="${A.target}" style="width:50px;height:50px;"/>
      </div>
    </div>
    <div class="mono" style="font-size:17px;letter-spacing:2.5px;color:var(--coral);font-weight:700;">SCAN TO CLAIM</div>
    <div class="mono" style="font-size:13px;letter-spacing:2px;color:var(--muted);margin-top:-16px;">50%&nbsp;OFF&nbsp;&middot;&nbsp;FIRST&nbsp;YEAR</div>
  </div>

  <!-- Left content, enlarged. -->
  <div style="position:absolute;top:64px;left:90px;width:640px;">
    <img src="${A.darkFull}" style="width:560px;display:block;margin-left:-8px;"/>
    <div style="width:84px;height:5px;background:var(--coral);border-radius:3px;margin:32px 0 22px 2px;"></div>
    <div class="mono" style="font-size:16.5px;letter-spacing:3.8px;color:var(--muted);font-weight:500;">GAMMA&nbsp;&middot;&nbsp;DEALER&nbsp;FLOW&nbsp;&middot;&nbsp;KEY&nbsp;LEVELS</div>
    <div style="margin-top:36px;font-size:32px;font-weight:700;color:var(--coral);letter-spacing:.3px;">${CARD.offer}</div>
    <div class="mono" style="font-size:14.5px;letter-spacing:1.4px;color:var(--cream);margin-top:14px;">
      SCAN THE QR CODE TO CLAIM&nbsp;&middot;&nbsp;CODE <span style="color:var(--coral);font-weight:700;">${CARD.code}</span>
    </div>
  </div>

  <!-- URL bottom-left, enlarged. -->
  <div style="position:absolute;left:92px;bottom:50px;display:flex;align-items:center;gap:14px;">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#F4645F" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18"/></svg>
    <span class="mono" style="font-size:36px;font-weight:700;color:var(--cream);letter-spacing:.5px;">${CARD.url.replace(/(\.[a-z]+)$/i,'<span style="color:var(--coral)">$1</span>')}</span>
  </div>
</div>`;

async function renderCard(browser) {
  const page = await browser.newPage({ viewport:{width:1050,height:600}, deviceScaleFactor:2 });
  await page.setContent(`<!doctype html><html><head>${HEAD}</head><body>${FRONT}</body></html>`, { waitUntil:'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(120);
  await (await page.$('#card')).screenshot({ path: path.join(HERE, 'zerogex-card.png') });
  await page.close();
  console.log('  -> zerogex-card.png');
}

async function renderMockup(browser) {
  const card = `data:image/png;base64,${b64(path.join(HERE,'zerogex-card.png'))}`;
  const W = 1600, H = 1000, cardW = 1120, cardH = Math.round(cardW*600/1050);
  const shadow = `box-shadow:0 2px 6px rgba(0,0,0,.35),0 40px 80px -16px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.05) inset;`;
  const html = `<!doctype html><html><head><style>
    @font-face{font-family:'JetBrains Mono';font-weight:400 700;src:url('${A.jb}') format('woff2');}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:radial-gradient(120% 120% at 50% 42%, #12283C 0%, #0C1B2A 55%, #06101B 100%);font-family:'JetBrains Mono',monospace;}
    .card{position:absolute;width:${cardW}px;height:${cardH}px;border-radius:26px;overflow:hidden;${shadow}}
    .card img{width:100%;height:100%;display:block;}
  </style></head><body>
    <img src="${A.target}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:1150px;opacity:.05;"/>
    <div class="card" style="left:${(W-cardW)/2}px;top:${(H-cardH)/2 - 24}px;transform:rotate(-3deg);"><img src="${card}"/></div>
    <div style="position:absolute;left:0;right:0;bottom:40px;text-align:center;font-size:13px;letter-spacing:3px;color:#4A5D71;">ZEROGEX &middot; BUSINESS CARD &middot; 3.5&quot; &times; 2&quot; &middot; QR &rarr; ${CARD.url.toUpperCase()}</div>
  </body></html>`;
  const page = await browser.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:2 });
  await page.setContent(html, { waitUntil:'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(HERE,'zerogex-card-mockup.png') });
  await page.close();
  console.log('  -> zerogex-card-mockup.png');
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium',
  });
  console.log('Rendering ZeroGEX business card:');
  await renderCard(browser);
  await renderMockup(browser);
  await browser.close();
  console.log('Done.');
})();
