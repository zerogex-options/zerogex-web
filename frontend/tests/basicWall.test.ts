import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NAV_GROUPS, navItemLabel, navItemLabelKey } from '../core/navigation.ts';
import { BLOG_IMAGE_DIMENSIONS } from '../core/blogImageManifest.ts';
import { LOCALES, type Locale } from '../core/i18n/locales.ts';
import { de } from '../core/i18n/dictionaries/de.ts';
import { es } from '../core/i18n/dictionaries/es.ts';
import { fr } from '../core/i18n/dictionaries/fr.ts';
import { it } from '../core/i18n/dictionaries/it.ts';
import { LIST_PRICE_USD, MONEY_BACK_GUARANTEE_DAYS, formatUsd } from '../core/billingPlans.ts';
import { OFFER_TRIAL_DAYS } from '../core/promoCodeOffer.ts';
import { PRO_PAGE_PITCHES, proFeatures, proPagePitch } from '../core/proWall.ts';
import {
  BASIC_FEATURES,
  BASIC_PAGE_PITCHES,
  basicPagePitch,
  newcomerWall,
  type NewcomerWallInput,
} from '../core/basicWall.ts';
import { BASIC_WALL_TRANSLATIONS } from '../core/basicWall.i18n.ts';

// The screen a free member gets on a paid page (app/unauthorized, audience
// 'newcomer'). Login lands on /dashboard, a Basic page, so for most free
// members this is the first screen after signing in. It has to say what the
// page does, what the plan costs and how starting works for them, and it must
// never promise a trial (or a trial without a card) that checkout won't grant.

const TRANSLATED = LOCALES.filter((l): l is Exclude<Locale, 'en'> => l !== 'en');
const MENU: Record<Exclude<Locale, 'en'>, Record<string, string>> = { it, de, es, fr };

// A free member who can take the trial, with Basic's monthly trial on and no
// card asked for: the screen as it will run once BILLING_NO_CARD_TRIAL is set.
function input(over: Partial<NewcomerWallInput> = {}): NewcomerWallInput {
  return {
    path: '/dashboard',
    pageLabel: 'Main Dashboard',
    required: 'basic',
    promiseTrial: true,
    basicTrial: true,
    proTrial: false,
    noCard: true,
    basicHref: '/pricing?trial=1&plan=basic',
    proHref: '/pricing?trial=1&plan=pro',
    compareHref: '/pricing?trial=1',
    ...over,
  };
}

// Every state the screen can be in, for every page it can be about.
function everyInput(): NewcomerWallInput[] {
  const pages: Array<Pick<NewcomerWallInput, 'path' | 'required'>> = [
    ...Object.keys(BASIC_PAGE_PITCHES).map((p) => ({ path: p, required: 'basic' as const })),
    { path: null, required: 'basic' },
    { path: '/trade-bias', required: 'pro' },
    { path: null, required: 'pro' },
  ];
  const out: NewcomerWallInput[] = [];
  for (const page of pages) {
    for (const promiseTrial of [true, false]) {
      for (const basicTrial of [true, false]) {
        for (const proTrial of [true, false]) {
          for (const noCard of [true, false]) {
            out.push(input({ ...page, pageLabel: navItemLabel(page.path), promiseTrial, basicTrial, proTrial, noCard }));
          }
        }
      }
    }
  }
  return out;
}

// The page's name the way the member's own menu shows it (app/unauthorized).
function menuLabel(p: string | null, locale: Locale): string | undefined {
  const key = navItemLabelKey(p);
  return locale !== 'en' && key ? MENU[locale][key] : navItemLabel(p);
}

// Every line of text the screen can show, in one language.
function everyLine(locale: Locale): string[] {
  const lines: string[] = [];
  for (const i of everyInput()) {
    const s = newcomerWall({ ...i, pageLabel: menuLabel(i.path, locale) }, locale);
    lines.push(s.heading, s.pitch.pitch, s.imageCaption, s.priceLine, s.termsLine, s.cta.label, s.secondary.label);
    if (s.pitch.image) lines.push(s.pitch.image.alt);
    if (s.annual) lines.push(s.annual.line, s.annual.label);
    if (s.howItWorks) lines.push(s.howItWorks);
    lines.push(s.featuresHeading, ...s.features, s.comparePlans, s.freeLevels);
    // The same screen for a path the menu does not know.
    const anon = newcomerWall({ ...i, pageLabel: undefined }, locale);
    lines.push(anon.heading, anon.imageCaption);
    if (anon.howItWorks) lines.push(anon.howItWorks);
  }
  return lines;
}

test('every Basic page in the menu has its own pitch, and every pitch is a Basic page', () => {
  const basicIds: string[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items ?? []) if (item.requiredTier === 'basic') basicIds.push(item.id);
    for (const sg of group.subgroups ?? []) {
      if (sg.id && sg.requiredTier === 'basic') basicIds.push(sg.id);
      for (const item of sg.items) if (item.requiredTier === 'basic') basicIds.push(item.id);
    }
  }
  assert.ok(basicIds.length >= 25, `found ${basicIds.length} Basic pages`);
  for (const id of basicIds) assert.ok(BASIC_PAGE_PITCHES[id], `${id} has no pitch`);
  // A pitch for a page that left the menu (or moved to Pro) would sell the
  // wrong plan.
  for (const id of Object.keys(BASIC_PAGE_PITCHES)) assert.ok(basicIds.includes(id), `${id} is not a Basic menu page`);
});

test('a screenshot is only named when the site serves it, and a help link only when the page exists', () => {
  for (const [id, pitch] of Object.entries(BASIC_PAGE_PITCHES)) {
    if (pitch.image) assert.ok(BLOG_IMAGE_DIMENSIONS[pitch.image.src], `${id}: ${pitch.image.src} is not in assets/blog`);
    if (pitch.helpHref) {
      const slug = pitch.helpHref.replace(/^\/help\/platform\//, '');
      assert.notEqual(slug, pitch.helpHref, `${id}: ${pitch.helpHref} is not a platform help page`);
      const file = path.join(process.cwd(), 'content', 'help', 'platform', `${slug}.md`);
      assert.ok(fs.existsSync(file), `${id}: no help page at ${file}`);
    }
  }
  // The login landing page is the one most free members see: it shows the product.
  assert.ok(BASIC_PAGE_PITCHES['/dashboard'].image);
});

test('an unknown path gets the general Basic pitch rather than nothing', () => {
  assert.match(basicPagePitch('/not-a-page').pitch, /^Basic is the live ZeroGEX/);
  assert.match(basicPagePitch(undefined).pitch, /^Basic is the live ZeroGEX/);
  assert.match(newcomerWall(input({ path: null, pageLabel: undefined })).heading, /^This page is part of Basic$/);
});

test('without a locale the screen is English, word for word', () => {
  const s = newcomerWall(input());
  assert.deepEqual(newcomerWall(input(), 'en'), s);
  assert.equal(s.plan, 'Basic');
  assert.equal(s.heading, 'Main Dashboard is part of Basic');
  assert.equal(s.pitch, BASIC_PAGE_PITCHES['/dashboard']);
  assert.equal(s.imageCaption, 'Main Dashboard on a past session: an example reading, not today’s.');
  assert.equal(s.priceLine, 'Basic is $39 a month.');
  assert.equal(
    s.termsLine,
    'Start with a 7-day free trial, no card needed. Nothing is charged unless you add a card to keep it.',
  );
  assert.deepEqual(s.cta, { label: 'Start your free trial', href: '/pricing?trial=1&plan=basic' });
  assert.deepEqual(s.secondary, { label: 'Compare plans', href: '/pricing?trial=1' });
  assert.deepEqual(s.annual, {
    line: 'Or pay for a year: Basic annual is $199, about $16.58 a month.',
    label: 'See Basic annual',
    href: '/pricing?plan=basic&cadence=annual',
  });
  assert.equal(s.featuresHeading, 'What Basic includes');
  assert.deepEqual(s.features, BASIC_FEATURES);
  assert.equal(s.howItWorks, 'How Main Dashboard works');
  assert.equal(s.comparePlans, 'Compare plans');
  assert.equal(s.freeLevels, 'Or keep using the free delayed levels');
});

test('the trial line is the one checkout will honor: with a card, without one, or none at all', () => {
  // Card-first trial (BILLING_NO_CARD_TRIAL off): says nothing about cards.
  const card = newcomerWall(input({ noCard: false }));
  assert.equal(
    card.termsLine,
    'Start with a 7-day free trial. Nothing is charged until it ends, and you can cancel any time before then.',
  );
  assert.doesNotMatch(card.termsLine, /card/i);
  assert.equal(card.cta.label, 'Start your free trial');

  // Basic trial turned off in BILLING_TRIAL_PLANS: paid up front, no trial word.
  const paid = newcomerWall(input({ basicTrial: false }));
  assert.equal(paid.termsLine, 'Paid up front, with a 7-day money-back guarantee.');
  assert.doesNotMatch(paid.termsLine, /trial/i);
  assert.equal(paid.cta.label, 'Get Basic');
  assert.equal(paid.secondary.label, 'Compare plans');

  // A session that could not be read: no trial, no guarantee, no promise.
  for (const noCard of [true, false]) {
    const unknown = newcomerWall(input({ promiseTrial: false, noCard, basicHref: '/pricing?plan=basic', compareHref: '/pricing' }));
    assert.equal(unknown.termsLine, 'Pick a plan on the pricing page to unlock it.');
    assert.deepEqual(unknown.cta, { label: 'Get Basic', href: '/pricing?plan=basic' });
    assert.deepEqual(unknown.secondary, { label: 'Compare plans', href: '/pricing' });
  }

  // The day counts are the ones checkout and the refund flow use.
  assert.equal(OFFER_TRIAL_DAYS, 7);
  assert.equal(MONEY_BACK_GUARANTEE_DAYS, 7);
  assert.ok(newcomerWall(input()).priceLine.includes(formatUsd(LIST_PRICE_USD.basic.monthly)));
});

test('a free member on a Pro page gets the Pro pitch, Pro price, and Basic trial as the way in', () => {
  const pro = (over: Partial<NewcomerWallInput>) =>
    newcomerWall(input({ path: '/trade-bias', pageLabel: 'Trade Bias', required: 'pro', ...over }));

  // Default policy: Pro is paid up front, Basic trials.
  const s = pro({});
  assert.equal(s.plan, 'Pro');
  assert.equal(s.heading, 'Trade Bias is part of Pro');
  assert.equal(s.pitch, PRO_PAGE_PITCHES['/trade-bias']);
  assert.equal(s.priceLine, 'Pro is $59 a month.');
  assert.equal(
    s.termsLine,
    'Paid up front, with a 7-day money-back guarantee. Or start with Basic’s 7-day free trial, no card needed, and switch to Pro from there.',
  );
  assert.deepEqual(s.cta, { label: 'Get Pro', href: '/pricing?trial=1&plan=pro' });
  assert.deepEqual(s.secondary, { label: 'Start with the Basic trial', href: '/pricing?trial=1&plan=basic' });
  assert.equal(s.annual?.line, 'Or pay for a year: Pro annual is $299, about $24.92 a month.');
  assert.equal(s.annual?.href, '/pricing?plan=pro&cadence=annual');
  assert.equal(s.featuresHeading, 'Everything in Basic, plus');
  assert.deepEqual(s.features, proFeatures());
  assert.equal(
    pro({ noCard: false }).termsLine,
    'Paid up front, with a 7-day money-back guarantee. Or start with Basic’s 7-day free trial and switch to Pro from there.',
  );

  // Pro added to BILLING_TRIAL_PLANS: Pro's own trial.
  const proTrial = pro({ proTrial: true });
  assert.match(proTrial.termsLine, /^Start with a 7-day free trial, no card needed\./);
  assert.deepEqual(proTrial.cta, { label: 'Start your free trial', href: '/pricing?trial=1&plan=pro' });
  assert.equal(proTrial.secondary.label, 'Compare plans');

  // No trial anywhere: no trial offered, not even Basic's.
  const none = pro({ basicTrial: false });
  assert.equal(none.termsLine, 'Paid up front, with a 7-day money-back guarantee.');
  assert.equal(none.secondary.label, 'Compare plans');

  // Unresolved session: nothing promised, Basic's trial included.
  const unknown = pro({ promiseTrial: false });
  assert.equal(unknown.termsLine, 'Pick a plan on the pricing page to unlock it.');
  assert.equal(unknown.secondary.label, 'Compare plans');
});

test('no state promises a trial without a card unless no-card trials are on', () => {
  for (const i of everyInput()) {
    for (const locale of LOCALES) {
      const s = newcomerWall({ ...i, pageLabel: menuLabel(i.path, locale) }, locale);
      const NO_CARD: Record<Locale, RegExp> = {
        en: /no card/i,
        it: /senza carta/i,
        de: /ohne karte|keine karte/i,
        es: /sin tarjeta/i,
        fr: /sans carte/i,
      };
      const says = NO_CARD[locale].test(s.termsLine);
      const trialOffered = i.promiseTrial && (i.basicTrial || (i.required === 'pro' && i.proTrial));
      assert.equal(says, i.noCard && trialOffered, `${locale} ${JSON.stringify(i)}: ${s.termsLine}`);
      if (!i.promiseTrial) assert.equal(s.termsLine, newcomerWall({ ...i, noCard: !i.noCard }, locale).termsLine);
    }
  }
});

test('every other language covers every Basic page, screenshot and feature', () => {
  assert.deepEqual(TRANSLATED, ['it', 'de', 'es', 'fr']);
  for (const locale of TRANSLATED) {
    const text = BASIC_WALL_TRANSLATIONS[locale];
    assert.deepEqual(Object.keys(text.pitches).sort(), Object.keys(BASIC_PAGE_PITCHES).sort(), `${locale}: pitches`);
    for (const [route, english] of Object.entries(BASIC_PAGE_PITCHES)) {
      assert.equal(Boolean(text.pitches[route].alt), Boolean(english.image), `${locale} ${route}: screenshot alt text`);
    }
    assert.equal(text.features.length, BASIC_FEATURES.length, `${locale}: features`);
  }
});

test('in Italian, German, Spanish and French no line of the screen is left in English', () => {
  const english = everyLine('en');
  for (const locale of TRANSLATED) {
    const lines = everyLine(locale);
    assert.equal(lines.length, english.length, locale);
    lines.forEach((line, i) => {
      assert.notEqual(line, english[i], `${locale}: still English: ${line}`);
      assert.doesNotMatch(line, /\b(the|and|your|you|with|switch|today|trial|card)\b/i, `${locale}: English left in: ${line}`);
      assert.doesNotMatch(line, /\bundefined\b|\bnull\b|[{}]|\s{2}|\s[,.]/, `${locale}: malformed: ${line}`);
    });
    // The screenshot, help link and every button's link are the English screen's.
    for (const route of Object.keys(BASIC_PAGE_PITCHES)) {
      const pitch = basicPagePitch(route, locale);
      assert.equal(pitch.image?.src, BASIC_PAGE_PITCHES[route].image?.src, `${locale} ${route}`);
      assert.equal(pitch.helpHref, BASIC_PAGE_PITCHES[route].helpHref, `${locale} ${route}`);
    }
    for (const i of everyInput()) {
      const ours = newcomerWall(i, locale);
      const theirs = newcomerWall(i);
      assert.equal(ours.cta.href, theirs.cta.href, locale);
      assert.equal(ours.secondary.href, theirs.secondary.href, locale);
      assert.equal(ours.annual?.href, theirs.annual?.href, locale);
      assert.equal(ours.plan, theirs.plan, locale);
    }
  }
});

test('the German screen says "du", like the rest of the German site', () => {
  for (const line of everyLine('de')) assert.doesNotMatch(line, /\b(Sie|Ihnen|Ihre?[mnrs]?)\b/, line);
  for (const noCard of [true, false]) {
    assert.match(newcomerWall(input({ noCard }), 'de').termsLine, /\b(du|dir|deine?[mnrs]?)\b/i);
  }
  assert.match(newcomerWall(input({ basicTrial: false }), 'de').termsLine, /\bDu\b/);
});

test('each language says how the trial works, in the pricing page’s words', () => {
  const expected: Record<Exclude<Locale, 'en'>, { heading: string; price: string; noCard: string; card: string; cta: string }> = {
    it: {
      heading: 'Dashboard principale fa parte di Basic',
      price: 'Basic costa $39 al mese.',
      noCard:
        'Inizia con una prova gratuita di 7 giorni, senza carta. Non ti viene addebitato nulla, a meno che tu non aggiunga una carta per mantenere il piano.',
      card: 'Inizia con una prova gratuita di 7 giorni. Non ti viene addebitato nulla finché non termina, e puoi annullare in qualsiasi momento prima di allora.',
      cta: 'Inizia la prova gratuita',
    },
    de: {
      heading: 'Haupt-Dashboard ist Teil von Basic',
      price: 'Basic kostet $39 im Monat.',
      noCard:
        'Starte mit einer 7-tägigen kostenlosen Testphase, keine Karte nötig. Abgebucht wird nur, wenn du eine Karte hinterlegst, um deinen Plan zu behalten.',
      card: 'Starte mit einer 7-tägigen kostenlosen Testphase. Abgebucht wird erst nach ihrem Ende, und du kannst bis dahin jederzeit kündigen.',
      cta: 'Kostenlose Testphase starten',
    },
    es: {
      heading: 'Panel principal forma parte de Basic',
      price: 'Basic cuesta $39 al mes.',
      noCard:
        'Empieza con una prueba gratuita de 7 días, sin tarjeta. No se cobra nada a menos que añadas una tarjeta para mantener tu plan.',
      card: 'Empieza con una prueba gratuita de 7 días. No se cobra nada hasta que termine, y puedes cancelar en cualquier momento antes de esa fecha.',
      cta: 'Empieza tu prueba gratuita',
    },
    fr: {
      heading: 'Tableau de bord principal fait partie de Basic',
      price: 'Basic coûte $39 par mois.',
      noCard:
        "Commencez par un essai gratuit de 7 jours, sans carte. Rien n'est prélevé, sauf si vous ajoutez une carte pour garder votre abonnement.",
      card: "Commencez par un essai gratuit de 7 jours. Rien n'est prélevé avant la fin de l'essai, et vous pouvez annuler à tout moment d'ici là.",
      cta: "Démarrer l'essai gratuit",
    },
  };
  for (const locale of TRANSLATED) {
    const pageLabel = menuLabel('/dashboard', locale);
    const s = newcomerWall(input({ pageLabel }), locale);
    assert.equal(s.heading, expected[locale].heading, locale);
    assert.equal(s.priceLine, expected[locale].price, locale);
    assert.equal(s.termsLine, expected[locale].noCard, locale);
    assert.equal(newcomerWall(input({ pageLabel, noCard: false }), locale).termsLine, expected[locale].card, locale);
    assert.equal(s.cta.label, expected[locale].cta, locale);
    // The guarantee is promised only where the member pays up front.
    assert.doesNotMatch(s.termsLine, /garanzia|Garantie|garantía|garantie/, locale);
    assert.match(
      newcomerWall(input({ pageLabel, basicTrial: false }), locale).termsLine,
      /garanzia|Garantie|garantía|garantie/,
      locale,
    );
  }
});

test("the heading names the page the way the member's own menu does", () => {
  assert.equal(navItemLabelKey('/dashboard'), 'nav.dashboard');
  assert.equal(navItemLabelKey('/basic-signals'), 'nav.basicSignalDashboard');
  assert.equal(navItemLabelKey('/gamma-exposure'), undefined);
  assert.equal(
    newcomerWall(input({ path: '/basic-signals', pageLabel: menuLabel('/basic-signals', 'de') }), 'de').heading,
    'Basis-Signal-Dashboard ist Teil von Basic',
  );
  assert.equal(
    newcomerWall(input({ path: '/gamma-exposure', pageLabel: menuLabel('/gamma-exposure', 'fr') }), 'fr').heading,
    'Dealer Positioning fait partie de Basic',
  );
});

test('a made-up ?path= gets the general pitch, in every language', () => {
  for (const locale of LOCALES) {
    const general = basicPagePitch(undefined, locale).pitch;
    for (const p of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '/not-a-page']) {
      assert.equal(basicPagePitch(p, locale).pitch, general, `${locale} ${p}`);
    }
    // A Pro page reached for by a free member is Pro's pitch, not Basic's.
    assert.equal(
      newcomerWall(input({ path: '/trade-bias', required: 'pro' }), locale).pitch.pitch,
      proPagePitch('/trade-bias', locale).pitch,
    );
  }
});
