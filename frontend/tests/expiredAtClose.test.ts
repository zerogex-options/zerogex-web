import assert from "node:assert/strict";
import test from "node:test";
import { expiredAtCloseNote, expiredExcludedDates, rolledExpiryNote } from "../core/expiredAtClose.ts";
import { latestBookBucket } from "../core/strikeHistory.ts";

// After the 4:00 PM ET close the API serves the session's last snapshot with
// the contracts that expired at the bell taken out, and names the dates it
// removed in `expired_excluded`. These pin how the site reads that field: the
// note it shows, and which bucket the strike panel, ladders and public chart
// treat as the current book.

test("the removed dates are read defensively: ISO dates only, unique, ascending", () => {
  assert.deepEqual(expiredExcludedDates({ expired_excluded: ["2026-10-30"] }), ["2026-10-30"]);
  assert.deepEqual(
    expiredExcludedDates({ expired_excluded: ["2026-10-30", "2026-10-29", "2026-10-30", 7, null, "Oct 30"] }),
    ["2026-10-29", "2026-10-30"],
  );
  assert.deepEqual(expiredExcludedDates({ expired_excluded: [] }), []);
  assert.deepEqual(expiredExcludedDates({}), []);
  assert.deepEqual(expiredExcludedDates(null), []);
  assert.deepEqual(expiredExcludedDates({ expired_excluded: "2026-10-30" }), []);
});

test("no note while the session is open or on history", () => {
  assert.equal(expiredAtCloseNote([]), null);
});

test("the note names the day whose options expired, in New York's calendar", () => {
  const note = expiredAtCloseNote(["2026-10-30"]);
  assert.ok(note);
  assert.equal(note.label, "Expired options removed");
  assert.match(note.detail, /expired at the close \(Fri, Oct 30\)/);
  assert.match(note.detail, /positioning that carries into the next session/);
  const two = expiredAtCloseNote(["2026-10-29", "2026-10-30"]);
  assert.match(two?.detail ?? "", /\(Thu, Oct 29 and Fri, Oct 30\)/);
});

const bucket = (minute: number, net: number | null, expired?: string[]) => ({
  timestamp: new Date(Date.parse("2026-10-30T19:30:00Z") + minute * 60_000).toISOString(),
  strikes: net == null ? [] : [{ net_gamma: net }],
  ...(expired ? { expired_excluded: expired } : {}),
});

test("the current book is the newest positioned bucket", () => {
  const buckets = [bucket(0, 1), bucket(5, 2), bucket(10, 3)];
  assert.equal(latestBookBucket(buckets), buckets[2]);
  assert.equal(latestBookBucket([]), null);
  assert.equal(latestBookBucket(null), null);
});

test("an empty tip without the field is walked back over, as before", () => {
  // An ETF's extended-hours tip with no book: the ladder reaches back.
  const buckets = [bucket(0, 1), bucket(5, 2), bucket(10, null)];
  assert.equal(latestBookBucket(buckets), buckets[1]);
});

test("the after-close book stops the walk even when nothing in it survived", () => {
  // A view filtered to the day's own expiration, read that evening: the API's
  // answer is an empty book, and every bucket behind it still counts the
  // contracts that just expired.
  const buckets = [bucket(0, -5), bucket(5, -8), bucket(10, null, ["2026-10-30"])];
  assert.equal(latestBookBucket(buckets), buckets[2]);
  // With survivors it is simply the newest positioned bucket.
  const survived = [bucket(0, -5), bucket(5, -1, ["2026-10-30"])];
  assert.equal(latestBookBucket(survived), survived[1]);
});

test("Max Pain and the Pin name the expiry they rolled to after the close", () => {
  assert.equal(rolledExpiryNote("2026-11-02"), "For the Mon, Nov 2 expiry");
  // Nothing rolled during the session, and nothing guessed from junk.
  assert.equal(rolledExpiryNote(null), null);
  assert.equal(rolledExpiryNote(undefined), null);
  assert.equal(rolledExpiryNote("Nov 2"), null);
});
