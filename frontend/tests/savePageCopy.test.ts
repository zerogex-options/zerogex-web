import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_PAGE_TITLE, saveDonePageCopy, saveOfferPageCopy } from '../app/save/copy.ts';

// The page the cancellation email's yellow button opens (app/save/route.ts).
// On a yearly plan it reads as the renewal, like the email; everything else
// keeps the wording it had, pinned here word for word.

const DATE = 'October 20, 2027';

test('yearly: the confirmation page is the renewal, with nothing charged today', () => {
  const copy = saveOfferPageCopy({ pct: 25, offer: 'save', cadence: 'annual', endsOn: DATE });
  assert.equal(copy.title, 'ZeroGEX - Your renewal');
  assert.equal(copy.heading, 'Keep ZeroGEX going at 25% off');
  assert.equal(
    copy.intro,
    'Your access lasts until October 20, 2027 either way. Renew now and your next year is <strong>25% off</strong>: ' +
      'on October 20, 2027 you&rsquo;ll be charged the discounted rate instead of your plan ending. ' +
      'Renewing charges nothing today, and there&rsquo;s no card to re-enter.',
  );
  // The email's yearly button says the same thing, so the click lands on it.
  assert.equal(copy.button, 'Renew at 25% off');
  assert.equal(copy.footer, 'Prefer to let it end? Just ignore this. Nothing changes, and your access lasts until October 20, 2027.');
  const all = Object.values(copy).join(' ');
  assert.doesNotMatch(all, /Keep my access|Before you go|stays on|for a full year/);
});

test('yearly "too expensive" offer reads the same at 50%', () => {
  const copy = saveOfferPageCopy({ pct: 50, offer: 'price', cadence: 'annual', endsOn: DATE });
  assert.equal(copy.heading, 'Keep ZeroGEX going at 50% off');
  assert.match(copy.intro, /your next year is <strong>50% off<\/strong>/);
  assert.equal(copy.button, 'Renew at 50% off');
  assert.doesNotMatch(copy.intro, /12 months/);
});

test('monthly: the confirmation page keeps its wording', () => {
  const copy = saveOfferPageCopy({ pct: 25, offer: 'save', cadence: 'monthly', endsOn: 'December 1, 2026' });
  assert.equal(copy.title, SAVE_PAGE_TITLE);
  assert.equal(copy.title, 'ZeroGEX - Keep your access');
  assert.equal(copy.heading, 'Wait - here&rsquo;s 25% off to stay');
  assert.equal(
    copy.intro,
    'Before you go - I&rsquo;d rather keep you than lose you. Claim <strong>25% off for a full year</strong> ' +
      'and your access stays on, no re-subscribe and no re-entering a card. You&rsquo;ll simply be charged the ' +
      'discounted rate at December 1, 2026 instead of canceling.',
  );
  assert.equal(copy.button, 'Keep my access &amp; apply 25% off');
  assert.equal(copy.footer, 'Prefer to still cancel? Just ignore this - nothing changes and your cancellation stands.');
});

test('monthly "too expensive" offer keeps "for the next 12 months"', () => {
  const copy = saveOfferPageCopy({ pct: 50, offer: 'price', cadence: 'monthly', endsOn: 'December 1, 2026' });
  assert.match(copy.intro, /Claim <strong>50% off for the next 12 months<\/strong>/);
  assert.equal(copy.button, 'Keep my access &amp; apply 50% off');
});

test('quarterly and an unmapped plan read like monthly', () => {
  const monthly = saveOfferPageCopy({ pct: 25, offer: 'save', cadence: 'monthly', endsOn: DATE });
  assert.deepEqual(saveOfferPageCopy({ pct: 25, offer: 'save', cadence: 'quarterly', endsOn: DATE }), monthly);
  assert.deepEqual(saveOfferPageCopy({ pct: 25, offer: 'save', cadence: null, endsOn: DATE }), monthly);
  const monthlyDone = saveDonePageCopy({ pct: 25, offer: 'save', cadence: 'monthly', endsOn: DATE });
  assert.deepEqual(saveDonePageCopy({ pct: 25, offer: 'save', cadence: 'quarterly', endsOn: DATE }), monthlyDone);
  assert.deepEqual(saveDonePageCopy({ pct: 25, offer: 'save', cadence: null, endsOn: DATE }), monthlyDone);
});

test('yearly: the page after claiming says when the renewal is charged', () => {
  const done = saveDonePageCopy({ pct: 25, offer: 'save', cadence: 'annual', endsOn: DATE });
  assert.equal(done.title, 'ZeroGEX - Your renewal');
  assert.equal(done.heading, 'You&rsquo;re set to renew - thank you');
  assert.equal(
    done.body,
    'Done. Your plan now renews on October 20, 2027 at <strong>25% off your next year</strong>, and that&rsquo;s when ' +
      'the discounted rate is charged. Your access carries on as before - nothing else to do. ' +
      'Thanks for sticking with ZeroGEX.',
  );
  assert.doesNotMatch(done.body, /welcome back|another shot/);
});

test('monthly: the page after claiming keeps its wording', () => {
  const done = saveDonePageCopy({ pct: 25, offer: 'save', cadence: 'monthly', endsOn: 'December 1, 2026' });
  assert.equal(done.title, SAVE_PAGE_TITLE);
  assert.equal(done.heading, 'You&rsquo;re staying - welcome back');
  assert.equal(
    done.body,
    'Done. Your access continues and <strong>25% off for a year</strong> is on your account. ' +
      'You&rsquo;ll be charged the discounted rate at December 1, 2026 - nothing else to do. ' +
      'Thanks for giving ZeroGEX another shot.',
  );
});

test('with no period end on the row, both versions still read as sentences', () => {
  const yearly = saveOfferPageCopy({ pct: 25, offer: 'save', cadence: 'annual', endsOn: null });
  assert.match(yearly.intro, /^Your access lasts until the end of your current period either way\./);
  assert.match(yearly.intro, /: at the end of your current period you&rsquo;ll be charged/);
  assert.match(yearly.footer, /your access lasts until the end of your current period\.$/);
  const yearlyDone = saveDonePageCopy({ pct: 25, offer: 'save', cadence: 'annual', endsOn: null });
  assert.match(yearlyDone.body, /^Done\. Your plan now renews at the end of your current period at <strong>/);

  const monthly = saveOfferPageCopy({ pct: 25, offer: 'save', cadence: 'monthly', endsOn: null });
  assert.match(monthly.intro, /discounted rate at the end of your current period instead of canceling\.$/);
  const monthlyDone = saveDonePageCopy({ pct: 25, offer: 'save', cadence: 'monthly', endsOn: null });
  assert.match(monthlyDone.body, /discounted rate at the end of your current period - nothing else to do/);
});

test('the date is escaped before it goes into the HTML', () => {
  const copy = saveOfferPageCopy({ pct: 25, offer: 'save', cadence: 'annual', endsOn: '<b>&"' });
  assert.match(copy.intro, /lasts until &lt;b&gt;&amp;&quot; either way/);
  assert.doesNotMatch(copy.intro, /<b>/);
  const done = saveDonePageCopy({ pct: 25, offer: 'save', cadence: 'monthly', endsOn: '<b>' });
  assert.match(done.body, /at &lt;b&gt; - nothing else/);
});
