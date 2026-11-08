// What a returning member sees on a paid page: app/unauthorized's 'returning'
// screen. They have paid before, so checkout gives them no trial. The screen
// says their account and settings are still there, names the plan the page
// they reached for needs, offers a founding member their rate back, and lists
// what shipped since they left (content/winback-highlights.json, filtered by
// core/winbackHighlights.ts).
//
// Every line is in the member's language (the `lang` cookie, passed in), like
// the newcomer and Pro screens (core/basicWall.ts, core/proWall.ts). English is
// written here; the other languages are in core/returningWall.i18n.ts, and each
// "what's new" bullet carries its own translations in the highlights file.
//
// Pure (no env, no DB, no fs): the page reads the member and the highlights and
// passes them in, and tests/returningWall.test.ts pins the copy.

import type { Plan } from './basicWall.ts';
import type { Locale } from './i18n/locales.ts';
import { DEFAULT_LOCALE } from './i18n/locales.ts';
import { RETURNING_WALL_TRANSLATIONS } from './returningWall.i18n.ts';
import { localizeHighlight, type HighlightSelection, type HighlightText } from './winbackHighlights.ts';

// ---------------------------------------------------------------------------
// The words, in one language
// ---------------------------------------------------------------------------

export type ReturningWallText = {
  welcomeBack: string;
  heading: string;
  // "You were reaching for Trade Bias, which is included with Pro.", or the
  // same without the page's name for a path that is not in the menu.
  reaching: (page: string | undefined, plan: Plan) => string;
  // Follows `reaching` in the same paragraph.
  stillThere: string;
  // Only for a founding member whose rate comes back with them.
  foundingRestore: string;
  resubscribe: (plan: Plan) => string;
  comparePlans: string;
  freeLevels: string;
  // Above the bullets: when some are new to them, and when none are.
  shippedSince: string;
  recentlyShipped: string;
};

const ENGLISH: ReturningWallText = {
  welcomeBack: 'Welcome back',
  heading: 'Your account is still here',
  reaching: (page, plan) =>
    page ? `You were reaching for ${page}, which is included with ${plan}.` : `That page is included with ${plan}.`,
  stillThere:
    'Everything you had is exactly where you left it - your layouts, symbols and settings are all still on your account.',
  foundingRestore:
    'You’re a Founding Member. That rate is still yours and applies automatically when you resubscribe - founding pricing closed to new members, but never to you.',
  resubscribe: (plan) => `Resubscribe to ${plan}`,
  comparePlans: 'Compare plans',
  freeLevels: 'Or keep using the free delayed levels',
  shippedSince: 'Shipped since you left',
  recentlyShipped: 'Recently shipped',
};

function returningWallText(locale: Locale): ReturningWallText {
  return locale === 'en' ? ENGLISH : (RETURNING_WALL_TRANSLATIONS[locale] ?? ENGLISH);
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export type ReturningWallInput = {
  // The page they reached for, the way their menu names it, or undefined for
  // a path that is not in the menu.
  pageLabel: string | undefined;
  // The plan that page needs.
  required: 'basic' | 'pro';
  // A founding member whose rate applies when they come back
  // (core/returningMember.ts resolveWall).
  showFoundingRestore: boolean;
  // The bullets picked for this member (core/winbackHighlights.ts
  // selectHighlightsSince), or null when the highlights file is unusable.
  highlights: HighlightSelection | null;
  // Where the resubscribe button and the plan comparison go
  // (core/returningMember.ts pricingHrefFor).
  planHref: string;
  compareHref: string;
};

export type ReturningWall = {
  badge: string;
  heading: string;
  body: string;
  foundingRestore: string | null;
  cta: { label: string; href: string };
  compare: { label: string; href: string };
  freeLevels: string;
  // Null when there is nothing to list.
  highlights: { heading: string; items: HighlightText[] } | null;
};

export function returningWall(input: ReturningWallInput, locale: Locale = DEFAULT_LOCALE): ReturningWall {
  const text = returningWallText(locale);
  const plan: Plan = input.required === 'pro' ? 'Pro' : 'Basic';
  const selection = input.highlights;
  return {
    badge: text.welcomeBack,
    heading: text.heading,
    body: `${text.reaching(input.pageLabel, plan)} ${text.stillThere}`,
    foundingRestore: input.showFoundingRestore ? text.foundingRestore : null,
    cta: { label: text.resubscribe(plan), href: input.planHref },
    compare: { label: text.comparePlans, href: input.compareHref },
    freeLevels: text.freeLevels,
    highlights:
      selection && selection.items.length > 0
        ? {
            // Only claim "since you left" when something on the list is new to them.
            heading: selection.freshCount > 0 ? text.shippedSince : text.recentlyShipped,
            items: selection.items.map((item) => localizeHighlight(item, locale)),
          }
        : null,
  };
}
