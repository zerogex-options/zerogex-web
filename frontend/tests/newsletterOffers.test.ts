import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Guards the two ways a newsletter can promise something the app will not
// deliver. Both have already happened once, in the 2026-08 registrants send:
//
//   1. The CTA carried a raw `&` (?trial=1&reactivate=1). In an HTML attribute
//      that is invalid markup, and a mail client that sanitizes or rewrites
//      links can drop the second parameter — landing the reader on a pricing
//      page that shows the standard trial rather than the extended one they
//      were just promised.
//   2. The campaign promised the extended trial and linked to ?reactivate=1,
//      but the sender never stamped users.reactivation_email_sent_at. That
//      column is the ONLY thing app/api/billing/checkout/route.ts consults
//      before granting the longer trial, so /pricing said 30 days (it renders
//      the number straight off the URL param) and Stripe would have charged
//      after 7.
//
// These are file-level invariants on purpose: they hold for every campaign,
// including ones added later, without anyone remembering to add a test.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const NEWSLETTER_DIR = path.join(HERE, '..', '..', 'docs', 'newsletters');
const SENDER = path.join(HERE, '..', 'scripts', 'send-product-update.mts');

function newsletterHtmlFiles(): string[] {
  return fs
    .readdirSync(NEWSLETTER_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort();
}

test('newsletter files exist (the checks below are worthless against an empty dir)', () => {
  assert.ok(newsletterHtmlFiles().length > 0, `no .html templates found in ${NEWSLETTER_DIR}`);
});

test('every newsletter href separates query parameters with &amp;, not a raw &', () => {
  for (const file of newsletterHtmlFiles()) {
    const html = fs.readFileSync(path.join(NEWSLETTER_DIR, file), 'utf8');
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) {
      // A raw & directly followed by a parameter name. `&amp;` is fine: the
      // `amp;` prefix means the next char is not the start of a bare param.
      const raw = href.match(/&(?!amp;)[A-Za-z_][A-Za-z0-9_]*=/);
      assert.equal(
        raw,
        null,
        `${file}: href "${href}" uses a raw "&" before "${raw?.[0]}". ` +
          'Write it as &amp; — a sanitizing mail client can otherwise drop the parameter.',
      );
    }
  }
});

// Parses the CAMPAIGNS registry out of the sender. Reading the source rather
// than importing it because the sender is a CLI that runs its whole pipeline at
// module scope; there is nothing importable to ask.
function campaignFlags(): Map<string, { grantsExtendedTrial: boolean; registrantHtml: string | null }> {
  const src = fs.readFileSync(SENDER, 'utf8');
  const registry = src.slice(
    src.indexOf('const CAMPAIGNS'),
    src.indexOf('const DEFAULT_CAMPAIGN'),
  );
  assert.ok(registry.length > 0, 'could not locate the CAMPAIGNS registry in the sender');

  const found = new Map<string, { grantsExtendedTrial: boolean; registrantHtml: string | null }>();
  // Each campaign is a `'<key>': { ... },` block; split on the key lines.
  const keyRe = /^ {2}'([^']+)': \{$/gm;
  const starts: { key: string; at: number }[] = [];
  for (const m of registry.matchAll(keyRe)) starts.push({ key: m[1], at: m.index! });
  for (let i = 0; i < starts.length; i++) {
    const block = registry.slice(starts[i].at, starts[i + 1]?.at ?? registry.length);
    const grants = /grantsExtendedTrial:\s*true/.test(block);
    const registrantBlock = block.match(/registrants:\s*\{[\s\S]*?\}/);
    const html = registrantBlock?.[0].match(/html:\s*'([^']+)'/)?.[1] ?? null;
    found.set(starts[i].key, { grantsExtendedTrial: grants, registrantHtml: html });
  }
  return found;
}

test('CAMPAIGNS registry is parseable and non-empty', () => {
  const flags = campaignFlags();
  assert.ok(flags.size > 0, 'parsed no campaigns — the registry shape changed, update this test');
  assert.ok(flags.has('2026-08'), 'expected the 2026-08 campaign to still be registered');
});

test('a registrants email offering ?reactivate=1 belongs to a grantsExtendedTrial campaign', () => {
  for (const [key, spec] of campaignFlags()) {
    if (!spec.registrantHtml) continue;
    const htmlPath = path.join(NEWSLETTER_DIR, spec.registrantHtml);
    assert.ok(fs.existsSync(htmlPath), `${key}: registrants template ${spec.registrantHtml} missing`);
    const linksReactivate = /reactivate=1/.test(fs.readFileSync(htmlPath, 'utf8'));

    assert.equal(
      linksReactivate,
      spec.grantsExtendedTrial,
      linksReactivate
        ? `${key}: ${spec.registrantHtml} links to ?reactivate=1 but the campaign is not ` +
            'flagged grantsExtendedTrial — recipients would be shown the extended trial and ' +
            'charged after the standard one, because the send never stamps ' +
            'users.reactivation_email_sent_at.'
        : `${key}: campaign is flagged grantsExtendedTrial but ${spec.registrantHtml} never ` +
            'links to ?reactivate=1, so the stamp spends a one-shot offer nobody was made.',
    );
  }
});

test('the 2026-08 registrants CTA carries both trial=1 and reactivate=1', () => {
  // The two params do different jobs and the copy depends on both: trial=1
  // shows the trial hero, reactivate=1 is what /pricing and the checkout route
  // read for the extended-trial length.
  for (const file of [
    '2026-08-product-update-registrants.html',
    '2026-08-product-update-registrants.txt',
  ]) {
    const body = fs.readFileSync(path.join(NEWSLETTER_DIR, file), 'utf8');
    assert.match(body, /\/pricing\?trial=1(&|&amp;)reactivate=1/, `${file}: CTA link changed`);
  }
});

test('the sender claims the reactivation latch for a grantsExtendedTrial registrants send', () => {
  // The whole point of the flag. If this UPDATE is ever dropped, the campaign
  // silently goes back to promising a trial checkout will not grant.
  const src = fs.readFileSync(SENDER, 'utf8');
  assert.match(
    src,
    /audience === 'registrants' && campaignSpec\.grantsExtendedTrial[\s\S]{0,200}UPDATE users SET reactivation_email_sent_at/,
    'send-product-update.mts no longer stamps reactivation_email_sent_at for these sends',
  );
});
