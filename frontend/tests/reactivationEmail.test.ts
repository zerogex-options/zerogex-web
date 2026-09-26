import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReactivationEmail } from '../core/mailer.ts';

// Every recipient is a verified signup who never started a trial and never
// entered a card. The email used to say "I've set your trial to a full 30 days"
// and "your card is on file", which read as already done: a recipient signed
// in, found no trial on the account, and wrote in asking where it was. The copy
// must say the trial is waiting to be activated and that the card is added then.
//
// The extended trial attaches to whichever plan the recipient picks, so the
// feature list may only name what Basic includes. It used to promise the
// backtester and the TradeWorkz bots, both Pro-only.

const OPTS = { trialDays: 30, unsubUrl: 'https://zerogex.test/unsubscribe?u=user_x&t=token' };

test('says the trial has not started and runs only once activated', () => {
  const { text, html } = renderReactivationEmail(OPTS);
  for (const body of [text, html]) {
    assert.match(body, /hasn't started yet/);
    assert.match(body, /the clock starts only when you activate it below/);
    assert.doesNotMatch(body, /set your trial/i);
  }
});

test('never claims a card is already on file', () => {
  const { text, html } = renderReactivationEmail(OPTS);
  for (const body of [text, html]) {
    assert.doesNotMatch(body, /on file/i);
    assert.match(body, /You add a card when you activate/);
  }
});

test('promises only features Basic includes', () => {
  const { text, html } = renderReactivationEmail(OPTS);
  for (const body of [text, html]) {
    assert.doesNotMatch(body, /backtest/i);
    assert.doesNotMatch(body, /TradeWorkz/i);
    assert.match(body, /gamma flip, pin strike, and call and put walls/);
    assert.match(body, /the Gamma Chart/);
    assert.match(body, /Today's Read/);
  }
});

test('the first charge lands the day after the trial ends', () => {
  assert.match(renderReactivationEmail(OPTS).text, /NOT charged until day 31\./);
  assert.match(renderReactivationEmail({ ...OPTS, trialDays: 14 }).text, /NOT charged until day 15\./);
});
