import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, navItemLabel, navItemLabelKey } from '../core/navigation.ts';
import { BLOG_IMAGE_DIMENSIONS } from '../core/blogImageManifest.ts';
import { LOCALES, type Locale } from '../core/i18n/locales.ts';
import { de } from '../core/i18n/dictionaries/de.ts';
import {
  PRO_FEATURES,
  PRO_PAGE_PITCHES,
  formatEtDateTime,
  proFeatures,
  proPagePitch,
  proWallCopy,
  proWallLabels,
  proWallTerms,
} from '../core/proWall.ts';
import { PRO_WALL_TRANSLATIONS } from '../core/proWall.i18n.ts';

// The screen a Basic member gets on a Pro page (app/unauthorized, audience
// 'upgrade'). It is the moment they are most curious about Pro, so it has to
// say what the page does and exactly what switching would mean for them today.

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-02T15:00:00Z');
const basicMonthly = { tier: 'basic', cadence: 'monthly' } as const;

function terms(over: Partial<Parameters<typeof proWallTerms>[0]> = {}) {
  return proWallTerms({
    status: 'trialing',
    current: basicMonthly,
    periodEndIso: new Date(NOW + 120 * HOUR).toISOString(),
    guaranteeUsed: false,
    nowMs: NOW,
    ...over,
  });
}

test('every Pro page in the menu has its own pitch', () => {
  const proIds: string[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items ?? []) if (item.requiredTier === 'pro') proIds.push(item.id);
    for (const sg of group.subgroups ?? []) {
      if (sg.id && sg.requiredTier === 'pro') proIds.push(sg.id);
      for (const item of sg.items) if (item.requiredTier === 'pro') proIds.push(item.id);
    }
  }
  assert.ok(proIds.length >= 14, `found ${proIds.length} Pro pages`);
  for (const id of proIds) assert.ok(PRO_PAGE_PITCHES[id], `${id} has no pitch`);
});

test('a screenshot is only named when the site serves it', () => {
  for (const [id, pitch] of Object.entries(PRO_PAGE_PITCHES)) {
    if (pitch.image) assert.ok(BLOG_IMAGE_DIMENSIONS[pitch.image.src], `${id}: ${pitch.image.src} is not in assets/blog`);
  }
});

test('an unknown path gets the general Pro pitch rather than nothing', () => {
  assert.match(proPagePitch('/not-a-page').pitch, /Pro adds Trade Bias/);
  assert.match(proPagePitch(undefined).pitch, /Pro adds Trade Bias/);
});

test("in the trial's last two days, the screen offers to keep the free days", () => {
  const t = terms({ periodEndIso: new Date(NOW + 30 * HOUR).toISOString() });
  assert.equal(t.kind, 'keep_trial');
  const copy = proWallCopy(t);
  assert.equal(copy.priceLine, 'Pro is $59 a month, $20 more than Basic.');
  assert.match(copy.termsLine, /Switch now and the rest of it stays free/);
  assert.match(copy.termsLine, /Pro's \$59 instead of Basic's \$39/);
  assert.match(copy.termsLine, /you can still cancel any time before then/);
  assert.doesNotMatch(copy.termsLine, /guarantee/);
  assert.equal(copy.cta.label, 'Switch to Pro');
  assert.match(copy.cta.href, /^\/pricing\?.*switch=pro.*from=locked_page/);
});

test('earlier in the trial it says switching charges today, and when the free option opens', () => {
  const t = terms();
  assert.equal(t.kind, 'trial_early');
  if (t.kind !== 'trial_early') return;
  assert.equal(Date.parse(t.opensAtIso), NOW + (120 - 51) * HOUR);
  const copy = proWallCopy(t);
  assert.match(copy.termsLine, /Switching now ends your free trial and starts Pro at \$59 today, covered by the 7-day money-back guarantee/);
  assert.match(copy.termsLine, /in the last two days of your trial, you can switch and keep those days free/);
  assert.match(copy.annual?.line ?? '', /Pro annual is \$299, about \$24\.92 a month/);
  // No guarantee promised to someone who has used their one refund.
  assert.doesNotMatch(proWallCopy(terms({ guaranteeUsed: true })).termsLine, /guarantee/);
});

test('paying, past-due and plan-less members each get terms that are true for them', () => {
  const paid = proWallCopy(terms({ status: 'active' }));
  assert.match(paid.termsLine, /Stripe shows you the exact amount before anything changes/);
  assert.doesNotMatch(paid.termsLine, /guarantee|trial/);

  const pastDue = proWallCopy(terms({ status: 'past_due' }));
  assert.equal(pastDue.cta.href, '/account');
  assert.equal(pastDue.annual, null);

  assert.equal(terms({ status: null }).kind, 'none');
  // A reactivation trial on Basic annual starts paying today when it moves.
  assert.equal(terms({ current: { tier: 'basic', cadence: 'annual' } }).kind, 'trial_other');
});

// ---------------------------------------------------------------------------
// The same screen in the member's language (the `lang` cookie)
// ---------------------------------------------------------------------------

const TRANSLATED = LOCALES.filter((l): l is Exclude<Locale, 'en'> => l !== 'en');

// Every set of terms the screen can show, with and without the guarantee.
function everyTerms() {
  return [
    terms({ periodEndIso: new Date(NOW + 30 * HOUR).toISOString() }),
    terms(),
    terms({ guaranteeUsed: true }),
    terms({ current: { tier: 'basic', cadence: 'annual' } }),
    terms({ current: { tier: 'basic', cadence: 'annual' }, guaranteeUsed: true }),
    terms({ status: 'active' }),
    terms({ status: 'past_due' }),
    terms({ status: null }),
  ];
}

// Every line the screen can render in one language, in a fixed order.
function everyLine(locale: Locale): string[] {
  const labels = proWallLabels(locale);
  const lines: string[] = [];
  for (const page of ['Trade Bias', undefined]) {
    lines.push(labels.heading(page), labels.imageCaption(page), labels.howItWorks(page));
  }
  lines.push(labels.comparePlans, labels.backToDashboard, labels.seeAnnual, labels.featuresHeading);
  for (const t of everyTerms()) {
    const copy = proWallCopy(t, locale);
    lines.push(copy.priceLine, copy.termsLine, copy.cta.label);
    if (copy.annual) lines.push(copy.annual.line);
  }
  lines.push(...proFeatures(locale));
  for (const path of [...Object.keys(PRO_PAGE_PITCHES), undefined]) {
    const pitch = proPagePitch(path, locale);
    lines.push(pitch.pitch);
    if (pitch.image) lines.push(pitch.image.alt);
  }
  return lines;
}

test('without a locale the screen is English, word for word as before', () => {
  const labels = proWallLabels();
  assert.equal(labels.heading('Trade Bias'), 'Trade Bias is part of Pro');
  assert.equal(labels.heading(undefined), 'This page is part of Pro');
  assert.equal(labels.imageCaption('Trade Bias'), 'Trade Bias on a past session: an example reading, not today’s.');
  assert.equal(labels.imageCaption(undefined), 'Pro on a past session: an example reading, not today’s.');
  assert.equal(labels.comparePlans, 'Compare plans');
  assert.equal(labels.backToDashboard, 'Back to the dashboard');
  assert.equal(labels.seeAnnual, 'See Pro annual');
  assert.equal(labels.featuresHeading, 'Everything in Basic, plus');
  assert.equal(labels.howItWorks('Backtesting'), 'How Backtesting works');
  assert.equal(labels.howItWorks(undefined), 'How it works');
  assert.deepEqual(proFeatures(), PRO_FEATURES);
  assert.equal(proPagePitch('/trade-bias', 'en'), PRO_PAGE_PITCHES['/trade-bias']);
  for (const t of everyTerms()) assert.deepEqual(proWallCopy(t, 'en'), proWallCopy(t));

  const t = terms();
  if (t.kind !== 'trial_early') throw new Error(t.kind);
  assert.equal(
    proWallCopy(t).termsLine,
    `Switching now ends your free trial and starts Pro at $59 today, covered by the 7-day money-back guarantee. Or wait: from ${formatEtDateTime(t.opensAtIso)}, in the last two days of your trial, you can switch and keep those days free.`,
  );
});

test('every other language covers every Pro page, screenshot and feature', () => {
  assert.deepEqual(TRANSLATED, ['it', 'de', 'es', 'fr']);
  for (const locale of TRANSLATED) {
    const text = PRO_WALL_TRANSLATIONS[locale];
    assert.deepEqual(Object.keys(text.pitches).sort(), Object.keys(PRO_PAGE_PITCHES).sort(), `${locale}: pitches`);
    for (const [route, english] of Object.entries(PRO_PAGE_PITCHES)) {
      assert.equal(Boolean(text.pitches[route].alt), Boolean(english.image), `${locale} ${route}: screenshot alt text`);
    }
    assert.equal(text.features.length, PRO_FEATURES.length, `${locale}: features`);
  }
});

test('in Italian, German, Spanish and French no line of the screen is left in English', () => {
  const english = everyLine('en');
  for (const locale of TRANSLATED) {
    const lines = everyLine(locale);
    assert.equal(lines.length, english.length, locale);
    lines.forEach((line, i) => {
      assert.notEqual(line, english[i], `${locale}: still English: ${line}`);
      assert.doesNotMatch(line, /\b(the|and|your|you|with|switch|today)\b/i, `${locale}: English left in: ${line}`);
      assert.doesNotMatch(line, /undefined|[{}]|\s{2}|\s[,.]/, `${locale}: malformed: ${line}`);
    });
    // The screenshot and help link are the English page's.
    for (const route of Object.keys(PRO_PAGE_PITCHES)) {
      const pitch = proPagePitch(route, locale);
      assert.equal(pitch.image?.src, PRO_PAGE_PITCHES[route].image?.src, `${locale} ${route}`);
      assert.equal(pitch.helpHref, PRO_PAGE_PITCHES[route].helpHref, `${locale} ${route}`);
    }
  }
});

test('the German screen says "du", like the rest of the German site', () => {
  for (const line of everyLine('de')) assert.doesNotMatch(line, /\b(Sie|Ihnen|Ihre?[mnrs]?)\b/, line);
  for (const t of everyTerms()) assert.match(proWallCopy(t, 'de').termsLine, /\b(du|dir|deine?[mnrs]?)\b/i);
});

test('early in the trial, each language says the switch can happen today, under the guarantee', () => {
  const t = terms();
  if (t.kind !== 'trial_early') throw new Error(t.kind);
  const expected: Record<Exclude<Locale, 'en'>, { price: string; terms: (opensAt: string) => string; cta: string }> = {
    de: {
      price: 'Pro kostet $59 im Monat, $20 mehr als Basic.',
      terms: (d) =>
        `Wenn du jetzt wechselst, endet deine kostenlose Testphase und Pro beginnt heute zum Preis von $59, abgesichert durch die 7-Tage-Geld-zurück-Garantie. Oder warte: Ab dem ${d}, in den letzten zwei Tagen deiner Testphase, kannst du wechseln und diese Tage kostenlos behalten.`,
      cta: 'Zu Pro wechseln',
    },
    it: {
      price: 'Pro costa $59 al mese, $20 in più di Basic.',
      terms: (d) =>
        `Se passi a Pro ora, la tua prova gratuita termina e Pro inizia oggi a $59, coperto dalla garanzia soddisfatti o rimborsati di 7 giorni. Oppure aspetta: dal ${d}, negli ultimi due giorni della prova, potrai passare a Pro e quei giorni resteranno gratuiti.`,
      cta: 'Passa a Pro',
    },
    es: {
      price: 'Pro cuesta $59 al mes, $20 más que Basic.',
      terms: (d) =>
        `Si cambias ahora, tu prueba gratuita termina y Pro empieza hoy por $59, cubierto por la garantía de devolución de 7 días. O espera: a partir del ${d}, en los dos últimos días de tu prueba, podrás cambiar y conservar gratis esos días.`,
      cta: 'Cambiar a Pro',
    },
    fr: {
      price: 'Pro coûte $59 par mois, soit $20 de plus que Basic.',
      terms: (d) =>
        `Passer à Pro maintenant met fin à votre essai gratuit et démarre Pro dès aujourd'hui à $59, couvert par la garantie satisfait ou remboursé de 7 jours. Ou attendez : à partir du ${d}, pendant les deux derniers jours de votre essai, vous pourrez passer à Pro et garder ces jours gratuits.`,
      cta: 'Passer à Pro',
    },
  };
  for (const locale of TRANSLATED) {
    const copy = proWallCopy(t, locale);
    assert.equal(copy.priceLine, expected[locale].price, locale);
    assert.equal(copy.termsLine, expected[locale].terms(formatEtDateTime(t.opensAtIso, locale)), locale);
    assert.equal(copy.cta.label, expected[locale].cta, locale);
    // Same switch, same links: only the words change.
    assert.equal(copy.cta.href, proWallCopy(t).cta.href, locale);
    assert.equal(copy.annual?.href, proWallCopy(t).annual?.href, locale);
    // No guarantee promised to someone who has used their one refund.
    assert.doesNotMatch(proWallCopy(terms({ guaranteeUsed: true }), locale).termsLine, /Garantie|garanzia|garantía|garantie/);
  }
});

test("dates keep New York's time, written the member's way", () => {
  // 12:00 UTC on November 5 is 7:00 in New York (EST) and 13:00 in Berlin.
  const iso = '2026-11-05T12:00:00Z';
  assert.match(formatEtDateTime(iso), /^November 5\b.*\b7:00 AM EST$/);
  assert.match(formatEtDateTime(iso, 'de'), /^5\. November\b.*\b0?7:00\b/);
  assert.match(formatEtDateTime(iso, 'it'), /^5 novembre\b.*\b0?7:00\b/);
  assert.match(formatEtDateTime(iso, 'es'), /^5 de noviembre\b.*\b0?7:00\b/);
  assert.match(formatEtDateTime(iso, 'fr'), /^5 novembre\b.*\b0?7:00\b/);
  for (const locale of TRANSLATED) {
    const date = formatEtDateTime(iso, locale);
    assert.match(date, /(GMT|UTC)[-−]5\b/, `${locale}: ${date} should name New York's offset`);
    assert.doesNotMatch(date, /AM|PM|EST|13:00/, `${locale}: ${date}`);
  }
  // In summer New York is four hours behind, and the date says so.
  assert.match(formatEtDateTime('2026-07-11T15:00:00Z', 'de'), /^11\. Juli\b.*\b11:00\b.*(GMT|UTC)[-−]4\b/);
});

test("Italian elides the article before the 8th and the 11th", () => {
  const italian = (periodEndIso: string, nowIso: string) =>
    proWallCopy(
      proWallTerms({ status: 'trialing', current: basicMonthly, periodEndIso, guaranteeUsed: false, nowMs: Date.parse(nowIso) }),
      'it',
    ).termsLine;
  // In the last two days: "termina l'8 novembre", not "il 8".
  assert.match(italian('2026-11-08T17:00:00Z', '2026-11-07T17:00:00Z'), /termina l'8 novembre/);
  assert.match(italian('2026-11-11T17:00:00Z', '2026-11-10T17:00:00Z'), /termina l'11 novembre/);
  assert.match(italian('2026-11-07T17:00:00Z', '2026-11-06T17:00:00Z'), /termina il 7 novembre/);
  // Earlier: the two-day switch opens 51 hours before the end ("dall'8").
  assert.match(italian('2026-11-10T18:00:00Z', '2026-11-06T15:00:00Z'), /aspetta: dall'8 novembre/);
  assert.match(italian('2026-11-13T18:00:00Z', '2026-11-09T15:00:00Z'), /aspetta: dall'11 novembre/);
  assert.match(italian('2026-11-12T18:00:00Z', '2026-11-08T15:00:00Z'), /aspetta: dal 10 novembre/);
});

test("the heading names the page the way the member's own menu does", () => {
  // Pages whose menu label is translated...
  assert.equal(navItemLabelKey('/signal-score'), 'nav.compositeScore');
  assert.equal(navItemLabelKey('/advanced-signals'), 'nav.advancedSignalDashboard');
  assert.equal(navItemLabelKey('/backtesting/insights'), 'nav.patternInsights');
  assert.equal(proWallLabels('de').heading(de[navItemLabelKey('/signal-score')!]), 'Gesamtscore ist Teil von Pro');
  // ...and signal names the menu keeps in English in every language.
  assert.equal(navItemLabelKey('/trade-bias'), undefined);
  assert.equal(navItemLabelKey('/eod-pressure'), undefined);
  assert.equal(navItemLabelKey('/not-a-page'), undefined);
  assert.equal(navItemLabelKey(undefined), undefined);
  // The English label every other screen prints is unchanged.
  assert.equal(navItemLabel('/signal-score'), 'Composite Score');
  assert.equal(navItemLabel('/advanced-signals'), 'Advanced Signal Dashboard');
  assert.equal(navItemLabel('/trade-bias'), 'Trade Bias');
  assert.equal(navItemLabel('/not-a-page'), undefined);
});

test('a made-up ?path= gets the general pitch, in every language', () => {
  for (const locale of LOCALES) {
    const general = proPagePitch(undefined, locale).pitch;
    for (const path of ['constructor', '__proto__', 'toString', '/not-a-page']) {
      assert.equal(proPagePitch(path, locale).pitch, general, `${locale} ${path}`);
    }
  }
});
