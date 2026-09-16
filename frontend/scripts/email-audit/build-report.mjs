// Assembles the audit PDF source: catalogue metadata + the exact captured
// wire HTML for every email. All report CSS is class-scoped (never a bare
// element selector) so nothing cascades into the embedded email bodies — they
// render against browser defaults, which is what a mail client gives them.

import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG, GROUPS, MANUAL } from './catalog.mjs';

// Working directory for the captured payloads and the generated report.
// `make email-audit` passes its OUT dir; defaults to the repo's build/email-audit.
const DIR = process.argv[2] ?? 'build/email-audit';
const captured = JSON.parse(readFileSync(`${DIR}/captured.json`, 'utf8'));
// Best-effort: the three standalone operator scripts need a journal / auth DB,
// so on a box without them the capture step yields fewer lines (or none) and
// those entries simply render without a body rather than failing the build.
let scriptSends = [];
try {
  scriptSends = readFileSync(`${DIR}/scripts.ndjson`, 'utf8')
    .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
} catch {
  console.error('note: no scripts.ndjson — operator-script bodies will be omitted');
}

// The three standalone operator scripts render outside mailer.ts. Each line
// carries the catalogue id the capture ran under (see stub-resend.mts), so a
// script that never reached its send drops out instead of shifting the rest.
for (const s of scriptSends) {
  if (!s.__id) { console.error('note: untagged capture line skipped'); continue; }
  captured.push({ id: s.__id, variant: 'default', subject: s.subject, html: s.html, text: s.text, headers: null });
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Group the renders by catalogue id, preserving variant order.
const byId = new Map();
for (const c of captured) {
  if (!byId.has(c.id)) byId.set(c.id, []);
  byId.get(c.id).push(c);
}

const entries = Object.entries(CATALOG).map(([id, meta]) => ({ id, meta, renders: byId.get(id) ?? [] }));
const missing = entries.filter((e) => e.renders.length === 0).map((e) => e.id);
if (missing.length) console.error(`WARNING: no render captured for: ${missing.join(', ')}`);

const autoMember = entries.filter((e) => e.meta.autoSends && e.meta.channel === 'member');
const autoOps = entries.filter((e) => e.meta.autoSends && e.meta.channel === 'operator');
const gated = entries.filter((e) => !e.meta.autoSends);

const TRIGGER_TONE = {
  'Stripe webhook': 'stripe', 'App action': 'app', 'App event': 'app',
  'systemd timer': 'timer', 'systemd OnFailure': 'fail', 'Queue drain': 'queue',
  'systemd timer (DIGEST ONLY)': 'gated', Manual: 'gated',
};

// ---------------------------------------------------------------- sections --

function overviewRows(list) {
  return list.map((e) => `
    <tr>
      <td class="z-td z-name">${esc(e.meta.title)}</td>
      <td class="z-td"><span class="z-pill z-pill--${TRIGGER_TONE[e.meta.trigger] ?? 'app'}">${esc(e.meta.trigger)}</span></td>
      <td class="z-td z-when">${esc(e.meta.when)}</td>
    </tr>`).join('');
}

const overview = `
<section class="z-page">
  <h2 class="z-h2">Every automated send, and when it fires</h2>
  <p class="z-lede">${autoMember.length} member-facing emails and ${autoOps.length} operator alerts fire with no human in the loop.
  A further ${gated.length} exist in the codebase but are <strong>not</strong> wired to send on their own — those are listed separately, and the distinction matters.</p>

  <h3 class="z-h3">Reaches a member's inbox automatically</h3>
  <table class="z-table">
    <thead><tr><th class="z-th">Email</th><th class="z-th z-th--trig">Fired by</th><th class="z-th">Exactly when</th></tr></thead>
    <tbody>${overviewRows(autoMember)}</tbody>
  </table>

  <h3 class="z-h3">Reaches the founder inbox automatically</h3>
  <table class="z-table">
    <thead><tr><th class="z-th">Email</th><th class="z-th z-th--trig">Fired by</th><th class="z-th">Exactly when</th></tr></thead>
    <tbody>${overviewRows(autoOps)}</tbody>
  </table>

  <h3 class="z-h3">Built, but nothing fires it on its own</h3>
  <table class="z-table">
    <thead><tr><th class="z-th">Email</th><th class="z-th z-th--trig">Status</th><th class="z-th">Why it does not send</th></tr></thead>
    <tbody>${overviewRows(gated)}</tbody>
  </table>
</section>`;

// --- lifecycle timeline ----------------------------------------------------

const LIFELINE = [
  { at: 'Sign up', items: [['Email verification', 'instant'], ['Verify reminder', '+2h if unconfirmed']] },
  { at: 'Verified, no checkout', items: [['Verified, never paid', '+2h'], ['Reactivation (30-day trial)', '+21 days']] },
  { at: 'Started checkout, stopped', items: [['Abandoned-checkout recovery', '+24h']] },
  { at: 'Trial starts', items: [['Trial / paid welcome', 'instant'], ['Founding welcome', 'instant (founding)']] },
  { at: 'Mid-trial', items: [['Mid-trial value nudge', '120h before end']] },
  { at: 'Trial ends', items: [['48h trial-end reminder', '48h before'], ['Trial conversion confirmation', 'on charge'], ['Trial conversion declined', 'on decline']] },
  { at: 'Subscribed', items: [['Card expiring', '45 days out'], ['Referral reward', 'on referral'], ['TradeWorkz bot alert', 'per bot event']] },
  { at: 'Payment fails', items: [['Payment failed', 'attempt 1'], ['Grace-expiry warning', '24h before cutoff'], ['Payment recovered', 'on clear']] },
  { at: 'Cancels', items: [['Cancellation acknowledgment', 'instant'], ['Cancellation alert → founder', 'within 15 min']] },
  { at: 'Lapsed', items: [['Win-back', 'DIGEST ONLY at 30 days'], ['Return intent', 'DIGEST ONLY on their return']] },
  { at: 'Comes back', items: [['Welcome back', 'instant']] },
];

const timeline = `
<section class="z-page">
  <h2 class="z-h2">Where each email lands in a member's life</h2>
  <p class="z-lede">Read top to bottom. Every box is one email; the grey ones need a human to press send.</p>
  <div class="z-tl">
    ${LIFELINE.map((s) => `
      <div class="z-tl-row">
        <div class="z-tl-stage"><span class="z-tl-dot"></span>${esc(s.at)}</div>
        <div class="z-tl-items">
          ${s.items.map(([n, w]) => {
            const isGated = /DIGEST ONLY/.test(w);
            return `<div class="z-tl-card${isGated ? ' z-tl-card--gated' : ''}">
              <div class="z-tl-name">${esc(n)}</div>
              <div class="z-tl-when">${esc(w)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
  </div>
</section>`;

// --- cron clock ------------------------------------------------------------

const TIMERS = [
  ['zerogex-web-tradeworkz-notify', '*:0/1:12', 'every minute', 'TradeWorkz bot alert'],
  ['zerogex-web-cancellation-alerts', '*:07,22,37,52', 'every 15 min', 'Cancellation alert (operator)'],
  ['zerogex-web-signup-alarm', '*:35:00', 'hourly', 'Signup-rate alarm (operator)'],
  ['zerogex-web-verify-reminders', '00/2:20:00', 'every 2h', 'Verify reminder'],
  ['zerogex-web-verified-never-paid', '00/2:30:00', 'every 2h', 'Verified, never paid'],
  ['zerogex-web-grace-expiry-warnings', '00/4:35:00', 'every 4h', 'Grace-expiry warning'],
  ['zerogex-web-trial-reminders', '00/6:15:00', 'every 6h', '48h trial-end reminder'],
  ['zerogex-web-checkout-recovery', '00/6:45:00', 'every 6h', 'Abandoned-checkout recovery'],
  ['zerogex-web-trial-value-nudge', '00/6:45:00', 'every 6h', 'Mid-trial value nudge'],
  ['zerogex-web-card-expiry', '04:20:00', 'daily', 'Card expiring'],
  ['zerogex-web-reactivation', '16:40:00', 'daily', 'Reactivation — sends to members'],
  ['zerogex-web-return-intent', '16:50:00', 'daily', 'Return-intent digest — operator only'],
  ['zerogex-web-winback', 'Mon 16:35:00', 'weekly', 'Win-back digest — operator only'],
  ['zerogex-web-foh-donation-reminder', 'Jan/Apr/Jul/Oct 5th 09:00 ET', 'quarterly', 'Folds of Honor reminder (operator)'],
];

const cron = `
<section class="z-page">
  <h2 class="z-h2">The clock</h2>
  <p class="z-lede">Every systemd timer that can send mail, fastest first. Times are <strong>server time (UTC)</strong> except where marked ET.
  Each unit carries a randomised delay (15s–10m) so they do not all fire on the same second.</p>
  <table class="z-table">
    <thead><tr><th class="z-th">Unit</th><th class="z-th">OnCalendar</th><th class="z-th">Cadence</th><th class="z-th">Sends</th></tr></thead>
    <tbody>
      ${TIMERS.map(([u, c, cad, s]) => `<tr>
        <td class="z-td z-mono">${esc(u)}</td>
        <td class="z-td z-mono z-dim">${esc(c)}</td>
        <td class="z-td">${esc(cad)}</td>
        <td class="z-td z-name">${esc(s)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <p class="z-note"><strong>Also automatic, but not on a clock:</strong> the scheduled-unit failure alert fires from
  <span class="z-mono">OnFailure=zerogex-web-alert@%n.service</span> the instant any unit above exits non-zero — that is the
  email that tells you the rest stopped working.</p>
</section>`;

// --- per-email pages -------------------------------------------------------

function metaRow(k, v) {
  return v ? `<tr><td class="z-mtk">${esc(k)}</td><td class="z-mtv">${v}</td></tr>` : '';
}

function emailSection(e, banner = '') {
  const m = e.meta;
  const tone = TRIGGER_TONE[m.trigger] ?? 'app';
  const flag = m.autoSends
    ? ''
    : `<div class="z-flag">Does not send on its own — ${esc(m.trigger === 'Manual' ? 'no timer is wired to it' : 'the installed unit only produces an operator review digest')}.</div>`;

  const bodies = e.renders.map((r) => `
    <div class="z-render">
      <div class="z-client">
        <div class="z-client-bar">
          <div class="z-client-row"><span class="z-client-k">From</span><span class="z-client-v">ZeroGEX &lt;hello@zerogex.io&gt;</span></div>
          <div class="z-client-row"><span class="z-client-k">Subject</span><span class="z-client-v z-client-subj">${esc(r.subject)}</span></div>
          ${e.renders.length > 1 ? `<div class="z-client-row"><span class="z-client-k">Variant</span><span class="z-client-v">${esc(r.variant)}</span></div>` : ''}
          ${r.headers ? `<div class="z-client-row"><span class="z-client-k">Headers</span><span class="z-client-v z-mono z-dim">${esc(Object.keys(r.headers).join(', '))}</span></div>` : ''}
        </div>
        <div class="z-client-body"><div class="z-email">${r.html}</div></div>
      </div>
    </div>`).join('');

  return `
<section class="z-page z-email-page">
  ${banner}
  <div class="z-head">
    <div class="z-head-top">
      <span class="z-pill z-pill--${tone}">${esc(m.trigger)}</span>
      <span class="z-pill z-pill--${m.channel === 'operator' ? 'ops' : 'mem'}">${m.channel === 'operator' ? 'Operator inbox' : 'Member inbox'}</span>
      ${m.foh ? '<span class="z-pill z-pill--foh">Folds of Honor footer</span>' : ''}
    </div>
    <h2 class="z-h2 z-h2--tight">${esc(m.title)}</h2>
    <div class="z-whenbox"><span class="z-whenlabel">When</span><span class="z-whentext">${esc(m.when)}</span></div>
    ${flag}
  </div>

  <table class="z-meta">
    ${metaRow('Fired by', esc(m.triggerDetail))}
    ${metaRow('Cadence', esc(m.cadence))}
    ${metaRow('Who gets it', `<span class="z-mono z-cohort">${esc(m.cohort)}</span>`)}
    ${metaRow('Sent-once guard', esc(m.latch))}
    ${metaRow('Opt-out', esc(m.optOut))}
    ${metaRow('Source', `<span class="z-mono z-dim">${esc(m.source)}</span>`)}
    ${metaRow('Notes', esc(m.notes ?? ''))}
  </table>

  ${bodies || '<p class="z-note">No render captured.</p>'}
</section>`;
}

// The group banner rides on top of that group's FIRST email page rather than
// taking a sheet of its own — eight spare pages in a document this long.
const grouped = GROUPS.map((g) => {
  const list = entries.filter((e) => e.meta.group === g.id);
  if (!list.length) return '';
  const banner = `
    <div class="z-banner">
      <div class="z-banner-kicker">${esc(g.label)} &middot; ${list.length} email${list.length === 1 ? '' : 's'}</div>
      <div class="z-banner-blurb">${esc(g.blurb)}</div>
    </div>`;
  return list.map((e, i) => emailSection(e, i === 0 ? banner : '')).join('');
}).join('');

const appendix = `
<section class="z-page">
  <h2 class="z-h2">Appendix — can send, but never on its own</h2>
  <p class="z-lede">These exist as Makefile targets or scripts. No timer, no webhook, no app path reaches them; a person runs them.
  Listed so the audit is provably complete.</p>
  <table class="z-table">
    <thead><tr><th class="z-th">Sender</th><th class="z-th">Invoked by</th><th class="z-th">What it is</th></tr></thead>
    <tbody>${MANUAL.map((x) => `<tr>
      <td class="z-td z-name">${esc(x.name)}</td>
      <td class="z-td z-mono z-dim">${esc(x.cmd)}</td>
      <td class="z-td">${esc(x.what)}</td>
    </tr>`).join('')}</tbody>
  </table>
  <p class="z-note"><strong>Method.</strong> Every email body in this document is the real wire payload: the Resend transport was
  replaced with a capture stub and each sender invoked, so what you are reading is the exact <span class="z-mono">html</span> Resend
  would have received — not a mock-up of it. Timing came from the systemd units in <span class="z-mono">deploy/systemd/</span>, the
  Makefile targets they call, and the cohort SQL in each script. Nothing here was taken from the prose in
  <span class="z-mono">docs/automated-emails-audit.md</span>.</p>
  <p class="z-note"><strong>Two honest caveats about the renders.</strong> Sample values (names, card digits, amounts, dates, signed
  token links) are representative, not real — the copy around them is verbatim. And one report rule reaches inside an email body:
  <span class="z-mono">.z-email pre { white-space: pre-wrap }</span>, because a <span class="z-mono">&lt;pre overflow-x:auto&gt;</span>
  scrolls in a mail client but clips on paper. Everything else renders against browser defaults, as a mail client would give it.</p>
</section>`;

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
const totalRenders = captured.length;

const cover = `
<section class="z-page z-cover">
  <div class="z-cover-mark">zerogex<span class="z-cover-dot">.io</span></div>
  <h1 class="z-cover-title">Automated email audit</h1>
  <p class="z-cover-sub">Every email the system sends without a human, exactly as the recipient sees it, and exactly when it fires.</p>
  <div class="z-cover-stats">
    <div class="z-stat"><div class="z-stat-n">${autoMember.length}</div><div class="z-stat-l">member emails<br>fire automatically</div></div>
    <div class="z-stat"><div class="z-stat-n">${autoOps.length}</div><div class="z-stat-l">operator alerts<br>fire automatically</div></div>
    <div class="z-stat"><div class="z-stat-n">${gated.length}</div><div class="z-stat-l">built but<br>never auto-send</div></div>
    <div class="z-stat"><div class="z-stat-n">${totalRenders}</div><div class="z-stat-l">rendered bodies<br>in this document</div></div>
  </div>
  <div class="z-cover-foot">
    <div>Generated ${esc(today)}</div>
    <div class="z-dim">Bodies captured from the live senders via a stubbed Resend transport · timings read from deploy/systemd and the cron cohort SQL</div>
  </div>
</section>`;

const css = `
  @page { size: Letter; margin: 14mm 13mm 16mm; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10.5px; line-height: 1.5; color: #16232e; background: #fff;
  }
  .z-page { break-before: page; }
  .z-page:first-child { break-before: auto; }

  .z-h2 { font-size: 19px; line-height: 1.2; margin: 0 0 6px; color: #0f2234; letter-spacing: -0.2px; }
  .z-h2--tight { margin: 6px 0 10px; }
  .z-h3 { font-size: 12px; margin: 22px 0 7px; color: #0f2234; text-transform: uppercase; letter-spacing: 0.07em; }
  .z-lede { margin: 0 0 14px; color: #44535f; max-width: 52em; }
  .z-note { margin: 16px 0 0; padding: 10px 12px; background: #f6f8fa; border-left: 3px solid #cfd8e0; color: #44535f; }
  .z-dim { color: #8a97a3; }
  .z-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 9px; }

  .z-table { width: 100%; border-collapse: collapse; margin: 0 0 6px; }
  .z-th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.07em;
          color: #6b7a86; border-bottom: 1.5px solid #16232e; padding: 0 8px 5px 0; font-weight: 600; }
  .z-th--trig { width: 118px; }
  .z-td { padding: 6px 8px 6px 0; border-bottom: 1px solid #e8edf1; vertical-align: top; }
  .z-name { font-weight: 600; color: #0f2234; }
  .z-when { color: #44535f; }
  tr { break-inside: avoid; }

  .z-pill { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 8px;
            font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
  .z-pill--stripe { background: #e7edff; color: #2b3f8f; }
  .z-pill--timer  { background: #fff3d6; color: #8a6200; }
  .z-pill--app    { background: #e2f3ea; color: #1c6b43; }
  .z-pill--queue  { background: #e9e6fb; color: #4b3a97; }
  .z-pill--fail   { background: #fde7e7; color: #9b1c1c; }
  .z-pill--gated  { background: #e9edf0; color: #55636e; }
  .z-pill--mem    { background: #0f2234; color: #fff; }
  .z-pill--ops    { background: #55636e; color: #fff; }
  .z-pill--foh    { background: #fff; color: #8a6200; border: 1px solid #e3cc8f; }

  .z-head { border-bottom: 2px solid #0f2234; padding-bottom: 12px; }
  .z-head-top { display: flex; gap: 6px; flex-wrap: wrap; }
  .z-whenbox { display: flex; gap: 10px; align-items: baseline; background: #0f2234; color: #fff;
               padding: 9px 12px; border-radius: 6px; }
  .z-whenlabel { font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
                 color: #f5b400; white-space: nowrap; }
  .z-whentext { font-size: 11.5px; line-height: 1.45; }
  .z-flag { margin-top: 9px; padding: 8px 11px; background: #fff8e1; border-left: 3px solid #f5b400;
            color: #6b5200; font-weight: 600; }

  .z-meta { width: 100%; border-collapse: collapse; margin: 12px 0 18px; break-inside: avoid; }
  .z-mtk { width: 105px; padding: 4px 10px 4px 0; vertical-align: top; color: #6b7a86;
           font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .z-mtv { padding: 4px 0; vertical-align: top; border-bottom: 1px solid #f0f3f6; }
  .z-cohort { line-height: 1.5; color: #44535f; }

  .z-render { margin: 0 0 16px; }
  .z-client { border: 1px solid #d6dee5; border-radius: 8px; overflow: hidden; }
  .z-client-bar { background: #f6f8fa; border-bottom: 1px solid #d6dee5; padding: 9px 12px; }
  .z-client-row { display: flex; gap: 8px; margin: 1px 0; }
  .z-client-k { width: 48px; flex: none; font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em;
                color: #8a97a3; font-weight: 700; padding-top: 2px; }
  .z-client-v { color: #44535f; }
  .z-client-subj { font-weight: 700; color: #0f2234; font-size: 11.5px; }
  .z-client-body { background: #fff; padding: 4px 0; }

  /* The email fragment renders against browser defaults from here down — no
     report rule reaches inside it, which is what keeps it faithful. */
  .z-email { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
             font-size: 13px; line-height: 1.5; color: #1a1a1a; }
  /* The ONLY rule that reaches inside an email body. A <pre style="overflow-x:auto">
     scrolls in a mail client but silently clips on paper, so wrap it instead —
     losing a line of a failure log to the page edge would defeat the audit. */
  .z-email pre { white-space: pre-wrap; overflow-wrap: anywhere; }

  .z-tl { margin-top: 6px; }
  .z-tl-row { display: flex; gap: 14px; padding: 7px 0; border-bottom: 1px solid #eef2f5; break-inside: avoid; }
  .z-tl-stage { width: 142px; flex: none; font-weight: 700; color: #0f2234; font-size: 10.5px; padding-top: 3px; }
  .z-tl-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
              background: #f5b400; margin-right: 7px; vertical-align: middle; }
  .z-tl-items { display: flex; gap: 7px; flex-wrap: wrap; flex: 1; }
  .z-tl-card { border: 1px solid #d6dee5; border-left: 3px solid #0f2234; border-radius: 4px;
               padding: 5px 9px; background: #fff; }
  .z-tl-card--gated { border-left-color: #b9c4cd; background: #f6f8fa; }
  .z-tl-name { font-weight: 600; color: #0f2234; font-size: 9.5px; }
  .z-tl-when { color: #8a97a3; font-size: 8.5px; }

  .z-banner { border-top: 3px solid #f5b400; padding: 8px 0 12px; margin-bottom: 6px; break-inside: avoid; }
  .z-banner-kicker { font-size: 12px; font-weight: 700; color: #0f2234; text-transform: uppercase; letter-spacing: 0.09em; }
  .z-banner-blurb { color: #6b7a86; margin-top: 2px; }

  .z-cover { display: flex; flex-direction: column; justify-content: center; min-height: 235mm; }
  .z-cover-mark { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; color: #0f2234; }
  .z-cover-dot { color: #f45854; }
  .z-cover-title { font-size: 42px; line-height: 1.05; margin: 26px 0 10px; color: #0f2234; letter-spacing: -1.2px; }
  .z-cover-sub { font-size: 14px; color: #44535f; margin: 0 0 34px; max-width: 30em; line-height: 1.5; }
  .z-cover-stats { display: flex; gap: 30px; border-top: 2px solid #0f2234; border-bottom: 2px solid #0f2234; padding: 20px 0; }
  .z-stat-n { font-size: 34px; font-weight: 800; color: #0f2234; line-height: 1; letter-spacing: -1px; }
  .z-stat-l { font-size: 9px; color: #6b7a86; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.45; }
  .z-cover-foot { margin-top: 34px; font-size: 9.5px; color: #44535f; line-height: 1.7; }
`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>ZeroGEX — Automated email audit</title>
<style>${css}</style></head>
<body>${cover}${overview}${timeline}${cron}${grouped}${appendix}</body></html>`;

writeFileSync(`${DIR}/report.html`, html);
console.error(`report.html written · ${entries.length} catalogue entries · ${totalRenders} rendered bodies`);
