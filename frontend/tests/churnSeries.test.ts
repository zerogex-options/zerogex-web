import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChurnReport, churnImplications, shiftDay, CHURN_WINDOW_DAYS } from '../core/churnSeries.ts';

// The 90 days the operator pulled from production on 2026-10-01 (paid cancels
// per day from the Subscriber Ledger, Full Subscriber count per day). The Churn
// tab must reproduce the figures that were read off this data by hand.
const PRODUCTION = `2026-07-04,0,21
2026-07-05,0,20
2026-07-06,0,22
2026-07-07,0,23
2026-07-08,0,24
2026-07-09,1,24
2026-07-10,0,24
2026-07-11,0,24
2026-07-12,0,26
2026-07-13,0,27
2026-07-14,1,28
2026-07-15,0,28
2026-07-16,0,30
2026-07-17,0,32
2026-07-18,0,32
2026-07-19,0,32
2026-07-20,0,34
2026-07-21,0,35
2026-07-22,0,34
2026-07-23,1,35
2026-07-24,1,39
2026-07-25,1,40
2026-07-26,0,41
2026-07-27,0,48
2026-07-28,0,50
2026-07-29,0,54
2026-07-30,0,52
2026-07-31,0,53
2026-08-01,0,55
2026-08-02,2,54
2026-08-03,2,62
2026-08-04,0,63
2026-08-05,0,65
2026-08-06,1,61
2026-08-07,0,62
2026-08-08,0,61
2026-08-09,0,62
2026-08-10,0,65
2026-08-11,0,70
2026-08-12,2,73
2026-08-13,0,77
2026-08-14,1,80
2026-08-15,0,85
2026-08-16,0,85
2026-08-17,0,87
2026-08-18,1,89
2026-08-19,3,91
2026-08-20,1,92
2026-08-21,1,92
2026-08-22,0,91
2026-08-23,1,92
2026-08-24,1,99
2026-08-25,1,99
2026-08-26,0,107
2026-08-27,1,104
2026-08-28,1,107
2026-08-29,0,109
2026-08-30,1,109
2026-08-31,0,111
2026-09-01,1,113
2026-09-02,0,114
2026-09-03,2,115
2026-09-04,2,118
2026-09-05,0,118
2026-09-06,0,119
2026-09-07,1,121
2026-09-08,1,121
2026-09-09,0,125
2026-09-10,2,123
2026-09-11,3,125
2026-09-12,0,125
2026-09-13,1,125
2026-09-14,0,126
2026-09-15,1,127
2026-09-16,0,125
2026-09-17,3,126
2026-09-18,0,126
2026-09-19,2,127
2026-09-20,0,127
2026-09-21,3,128
2026-09-22,0,129
2026-09-23,0,132
2026-09-24,0,130
2026-09-25,1,134
2026-09-26,1,132
2026-09-27,2,136
2026-09-28,3,138
2026-09-29,2,142
2026-09-30,2,143
2026-10-01,1,143`;

function fromRows(text: string) {
  const paidCancelDays: string[] = [];
  const payingByDay: Array<{ day: string; paying: number }> = [];
  for (const line of text.trim().split('\n')) {
    const [day, cancels, paying] = line.split(',');
    for (let i = 0; i < Number(cancels); i++) paidCancelDays.push(day);
    payingByDay.push({ day, paying: Number(paying) });
  }
  return { paidCancelDays, payingByDay };
}

const round = (n: number | null | undefined, places = 2) =>
  n === null || n === undefined ? n : Math.round(n * 10 ** places) / 10 ** places;

test('production data: the headline figures', () => {
  const report = buildChurnReport({ today: '2026-10-01', windowDays: 90, ...fromRows(PRODUCTION) });
  const s = report.summary;
  assert.equal(report.days.length, 90);
  assert.equal(s.startDay, '2026-07-04');
  assert.equal(s.endDay, '2026-10-01');
  assert.equal(s.payingAtStart, 21);
  assert.equal(s.payingNow, 143);
  assert.equal(s.paidCancels30d, 33);
  assert.equal(s.paidCancels7d, 12);
  assert.equal(s.previousHigh7d, 9);
  assert.equal(round(s.monthlyChurnNow), 25.65);
  assert.ok(s.monthlyChurnRange);
  assert.equal(round(s.monthlyChurnRange.high), 27.07);
  assert.equal(s.monthlyChurnRange.highDay, '2026-08-21');
  assert.equal(round(s.monthlyChurnRange.low), 19.03);
  assert.equal(s.monthlyChurnRange.lowDay, '2026-09-02');
  assert.equal(round(s.monthlyChurnRange.average), 22.58);
});

test('production data: monthly churn starts once 30 days of headcount exist', () => {
  const report = buildChurnReport({ today: '2026-10-01', windowDays: 90, ...fromRows(PRODUCTION) });
  const first = report.days.find((d) => d.monthlyChurn !== null);
  // Samples begin Jul 4, so Aug 2 is the first day with 30 known days behind it.
  assert.equal(first?.day, '2026-08-02');
  assert.equal(report.days.find((d) => d.day === '2026-08-01')?.monthlyChurn, null);
});

test('production data: each day matches the CSV the operator ran', () => {
  const report = buildChurnReport({ today: '2026-10-01', windowDays: 90, ...fromRows(PRODUCTION) });
  const sep30 = report.days.find((d) => d.day === '2026-09-30');
  assert.deepEqual(
    { ...sep30, shareOfPaying: round(sep30?.shareOfPaying), monthlyChurn: round(sep30?.monthlyChurn, 1) },
    { day: '2026-09-30', paidCancels: 2, paying: 143, shareOfPaying: 1.4, monthlyChurn: 25.8, paidCancels30d: 33 },
  );
});

test('headcount carries forward over days with no sample, and is unknown before the first', () => {
  const report = buildChurnReport({
    today: '2026-03-10',
    windowDays: 10,
    paidCancelDays: ['2026-03-05'],
    payingByDay: [
      { day: '2026-03-03', paying: 50 },
      { day: '2026-03-06', paying: 40 },
    ],
  });
  const byDay = new Map(report.days.map((d) => [d.day, d]));
  assert.equal(byDay.get('2026-03-01')?.paying, null);
  assert.equal(byDay.get('2026-03-02')?.shareOfPaying, null);
  assert.equal(byDay.get('2026-03-05')?.paying, 50);
  assert.equal(byDay.get('2026-03-05')?.shareOfPaying, 2);
  assert.equal(byDay.get('2026-03-10')?.paying, 40);
  // Never 30 known days in a row, so no monthly figure anywhere.
  assert.ok(report.days.every((d) => d.monthlyChurn === null));
  assert.equal(report.summary.monthlyChurnRange, null);
});

test('a sample of 0 paying members gives no share rather than dividing by zero', () => {
  const report = buildChurnReport({
    today: '2026-03-02',
    windowDays: 2,
    paidCancelDays: ['2026-03-02'],
    payingByDay: [{ day: '2026-03-01', paying: 0 }],
  });
  assert.equal(report.days[1].paying, null);
  assert.equal(report.days[1].shareOfPaying, null);
  assert.equal(report.days[1].paidCancels, 1);
});

test('monthly churn adds up each day\'s share over exactly 30 days', () => {
  // 100 paying members every day; one cancel a day for 31 days ending today.
  const today = '2026-05-31';
  const paidCancelDays = Array.from({ length: 31 }, (_, i) => shiftDay(today, -i));
  const payingByDay = [{ day: shiftDay(today, -200), paying: 100 }];
  const report = buildChurnReport({ today, windowDays: 1, paidCancelDays, payingByDay });
  assert.equal(round(report.summary.monthlyChurnNow), CHURN_WINDOW_DAYS);
  assert.equal(report.summary.paidCancels30d, 30);
});

test('the 30-day count reaches back before the range', () => {
  const report = buildChurnReport({
    today: '2026-06-30',
    windowDays: 7,
    paidCancelDays: ['2026-06-05', '2026-06-01'],
    payingByDay: [],
  });
  // Jun 24 is the range's first day; its 30 days run May 26 to Jun 24.
  assert.equal(report.days[0].day, '2026-06-24');
  assert.equal(report.days[0].paidCancels30d, 2);
  // Jun 30's 30 days run Jun 1 to Jun 30, so both still count.
  assert.equal(report.days[6].paidCancels30d, 2);
});

test('the previous 7-day high needs a full 7 days before the last 7', () => {
  const cancels = { paidCancelDays: ['2026-04-01', '2026-04-02', '2026-04-10'], payingByDay: [] };
  assert.equal(buildChurnReport({ today: '2026-04-10', windowDays: 7, ...cancels }).summary.previousHigh7d, null);
  const two = buildChurnReport({ today: '2026-04-14', windowDays: 14, ...cancels });
  // Range Apr 1–14: only Apr 1–7 ends before the last 7 days (Apr 8–14) begin.
  assert.equal(two.summary.previousHigh7d, 2);
  assert.equal(two.summary.paidCancels7d, 1);
});

test('shiftDay walks calendar days straight through a DST change', () => {
  assert.equal(shiftDay('2026-11-02', -1), '2026-11-01');
  assert.equal(shiftDay('2026-03-08', 1), '2026-03-09');
  const report = buildChurnReport({ today: '2026-11-15', windowDays: 30, paidCancelDays: [], payingByDay: [] });
  const days = report.days.map((d) => d.day);
  assert.equal(new Set(days).size, 30);
  assert.equal(days[0], '2026-10-17');
});

test('churnImplications: how long a member stays and how many leave a month', () => {
  assert.deepEqual(churnImplications(25, 140), { staysMonths: 4, lossesPerMonth: 35 });
  assert.deepEqual(churnImplications(20, null), { staysMonths: 5, lossesPerMonth: null });
  assert.equal(churnImplications(null, 140), null);
  assert.equal(churnImplications(0, 140), null);
});
