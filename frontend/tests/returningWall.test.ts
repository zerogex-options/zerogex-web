import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LOCALES, type Locale } from '../core/i18n/locales.ts';
import { returningWall, type ReturningWallInput } from '../core/returningWall.ts';
import { RETURNING_WALL_TRANSLATIONS } from '../core/returningWall.i18n.ts';
import { parseHighlightsJson, selectHighlightsSince, type DatedHighlight } from '../core/winbackHighlights.ts';

// The screen a returning member gets on a paid page (app/unauthorized, audience
// 'returning'): their account is still there, the plan the page needs, the
// founding rate when it is theirs, and what shipped since they left. In the
// member's language, every line of it, the "what's new" bullets included.

const TRANSLATED = LOCALES.filter((l): l is Exclude<Locale, 'en'> => l !== 'en');

const SHIPPED = parseHighlightsJson(
  JSON.parse(fs.readFileSync(new URL('../content/winback-highlights.json', import.meta.url), 'utf8')),
) as DatedHighlight[];

function input(over: Partial<ReturningWallInput> = {}): ReturningWallInput {
  return {
    pageLabel: 'Trade Bias',
    required: 'pro',
    showFoundingRestore: false,
    // Left before everything in the file shipped: every bullet is new to them.
    highlights: selectHighlightsSince(SHIPPED, '2026-08-01', { minItems: 3 }),
    planHref: '/pricing?plan=pro&reactivate=1',
    compareHref: '/pricing?reactivate=1',
    ...over,
  };
}

// Every line the screen can render in one language, in a fixed order. A
// bullet's title may be a product name that reads the same in every language
// ("Gamma Terminal"); nothing else may.
function everyLine(locale: Locale): Array<{ text: string; productName?: boolean }> {
  const lines: Array<{ text: string; productName?: boolean }> = [];
  for (const over of [
    {},
    { pageLabel: undefined, required: 'basic' as const, showFoundingRestore: true },
    { highlights: selectHighlightsSince(SHIPPED, '2026-12-01', { minItems: 3 }) },
  ]) {
    const s = returningWall(input(over), locale);
    for (const text of [s.badge, s.heading, s.body, s.cta.label, s.compare.label, s.freeLevels]) lines.push({ text });
    if (s.foundingRestore) lines.push({ text: s.foundingRestore });
    if (s.highlights) {
      lines.push({ text: s.highlights.heading });
      for (const h of s.highlights.items) lines.push({ text: h.title, productName: true }, { text: h.body });
    }
  }
  return lines;
}

test('in English the screen reads word for word as before', () => {
  const s = returningWall(input({ showFoundingRestore: true }));
  assert.equal(s.badge, 'Welcome back');
  assert.equal(s.heading, 'Your account is still here');
  assert.equal(
    s.body,
    'You were reaching for Trade Bias, which is included with Pro. Everything you had is exactly where you left it - your layouts, symbols and settings are all still on your account.',
  );
  assert.equal(
    s.foundingRestore,
    'You’re a Founding Member. That rate is still yours and applies automatically when you resubscribe - founding pricing closed to new members, but never to you.',
  );
  assert.deepEqual(s.cta, { label: 'Resubscribe to Pro', href: '/pricing?plan=pro&reactivate=1' });
  assert.deepEqual(s.compare, { label: 'Compare plans', href: '/pricing?reactivate=1' });
  assert.equal(s.freeLevels, 'Or keep using the free delayed levels');
  assert.equal(s.highlights?.heading, 'Shipped since you left');
  // The bullets are the file's own English, newest first.
  assert.deepEqual(
    s.highlights?.items,
    selectHighlightsSince(SHIPPED, '2026-08-01', { minItems: 3 }).items.map(({ title, body }) => ({ title, body })),
  );

  const basic = returningWall(input({ pageLabel: undefined, required: 'basic' }));
  assert.equal(basic.body.split('. ')[0], 'That page is included with Basic');
  assert.equal(basic.cta.label, 'Resubscribe to Basic');
  assert.equal(basic.foundingRestore, null);
  assert.equal(returningWall(input(), 'en').body, returningWall(input()).body);
});

test('the bullets claim "since you left" only when one is new to them, and vanish when there are none', () => {
  assert.equal(returningWall(input()).highlights?.heading, 'Shipped since you left');
  // Left after everything shipped: the newest are shown as context, not as news.
  const afterEverything = selectHighlightsSince(SHIPPED, '2026-12-01', { minItems: 3 });
  const later = returningWall(input({ highlights: afterEverything }));
  assert.equal(later.highlights?.heading, 'Recently shipped');
  assert.equal(later.highlights?.items.length, 3);
  assert.equal(returningWall(input({ highlights: null })).highlights, null);
  assert.equal(returningWall(input({ highlights: { items: [], freshCount: 0 } })).highlights, null);
  for (const locale of TRANSLATED) {
    const t = RETURNING_WALL_TRANSLATIONS[locale];
    assert.equal(returningWall(input(), locale).highlights?.heading, t.shippedSince, locale);
    assert.equal(returningWall(input({ highlights: afterEverything }), locale).highlights?.heading, t.recentlyShipped, locale);
  }
});

test('in Italian, German, Spanish and French no line of the screen is left in English', () => {
  const english = everyLine('en');
  for (const locale of TRANSLATED) {
    const lines = everyLine(locale);
    assert.equal(lines.length, english.length, locale);
    lines.forEach(({ text: line, productName }, i) => {
      if (!productName) assert.notEqual(line, english[i].text, `${locale}: still English: ${line}`);
      assert.doesNotMatch(line, /\b(the|and|your|you|with|which)\b/i, `${locale}: English left in: ${line}`);
      assert.doesNotMatch(line, /undefined|[{}]|\s{2}|\s[,.]/, `${locale}: malformed: ${line}`);
    });
  }
});

test('the German screen says "du", like the rest of the German site', () => {
  for (const { text } of everyLine('de')) assert.doesNotMatch(text, /\b(Sie|Ihnen|Ihre?[mnrs]?)\b/, text);
  const s = returningWall(input({ showFoundingRestore: true }), 'de');
  for (const line of [s.body, s.foundingRestore ?? '']) assert.match(line, /\b(du|dir|dich|deine?[mnrs]?)\b/i, line);
});

test("each language's sentences, pinned", () => {
  const expected: Record<Exclude<Locale, 'en'>, { body: string; cta: string }> = {
    de: {
      body: 'Du wolltest die Seite Gesamtscore öffnen; sie ist in Pro enthalten. Alles ist genau so, wie du es verlassen hast - deine Layouts, Symbole und Einstellungen sind alle noch in deinem Konto.',
      cta: 'Pro wieder abonnieren',
    },
    it: {
      body: "Stavi cercando di aprire Punteggio composito: questa pagina è inclusa in Pro. Tutto ciò che avevi è esattamente dove l'avevi lasciato: layout, simboli e impostazioni sono ancora tutti nel tuo account.",
      cta: 'Abbonati di nuovo a Pro',
    },
    es: {
      body: 'Intentabas abrir Puntuación compuesta: esta página está incluida en Pro. Todo lo que tenías está exactamente donde lo dejaste: tus diseños, símbolos y ajustes siguen en tu cuenta.',
      cta: 'Vuelve a suscribirte a Pro',
    },
    fr: {
      body: "Vous vouliez ouvrir Score composite : cette page est incluse dans Pro. Tout ce que vous aviez est exactement là où vous l'avez laissé : vos mises en page, symboles et réglages sont toujours sur votre compte.",
      cta: 'Se réabonner à Pro',
    },
  };
  const menuName = { de: 'Gesamtscore', it: 'Punteggio composito', es: 'Puntuación compuesta', fr: 'Score composite' };
  for (const locale of TRANSLATED) {
    const s = returningWall(input({ pageLabel: menuName[locale] }), locale);
    assert.equal(s.body, expected[locale].body, locale);
    assert.equal(s.cta.label, expected[locale].cta, locale);
    // Same buttons, same places: only the words change.
    assert.equal(s.cta.href, returningWall(input()).cta.href, locale);
    assert.equal(s.compare.href, returningWall(input()).compare.href, locale);
  }
});

test("the bullets are the file's own translations, and a bullet without one stays English", () => {
  const selection = selectHighlightsSince(SHIPPED, '2026-08-01', { minItems: 3 });
  for (const locale of TRANSLATED) {
    const shown = returningWall(input(), locale).highlights?.items ?? [];
    assert.deepEqual(
      shown,
      selection.items.map((item) => item.translations?.[locale]),
      `${locale}: every shipped bullet has a translation`,
    );
  }
  const untranslated: DatedHighlight = { title: 'Just shipped', body: 'not translated yet', since: '2026-11-07' };
  const mixed = returningWall(input({ highlights: { items: [untranslated, ...selection.items], freshCount: 1 } }), 'de');
  assert.deepEqual(mixed.highlights?.items[0], { title: 'Just shipped', body: 'not translated yet' });
  assert.deepEqual(mixed.highlights?.items[1], selection.items[0].translations?.de);
});
