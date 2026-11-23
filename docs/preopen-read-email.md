# Today's Read by email, before the open (members)

Every trading morning, members get the dashboard's Today's Read for SPX in their
inbox: the same paragraph, word for word, with the key levels and a row for each
of the six symbols. It exists because members told us what they leave over: "too
much information, hard to find the core of it", and on Nov 20, 2026 a member who
left after six days ("Wasn't using it") said a competitor is "easier for me to
read". That competitor's daily written note lands in every subscriber's inbox.
This is ours, and it earns its keep on the days a member never opens the charts.

## Rolling it out

It ships **in preview mode**: nothing reaches a member until you switch it on.

1. **Install the timer** (once, on the server, after merging and pulling):

   ```bash
   cd ~/zerogex-web && bash deploy/steps/099.preopen-read
   ```

   Weekdays at 08:42 ET it runs `make preopen-read AUTO=1`.

2. **Read it for a few mornings.** Until `PREOPEN_READ_LIVE=1` is set, `AUTO=1`
   mails ONE copy to `PREOPEN_READ_PREVIEW_TO` (else `CANCELLATION_ALERT_EMAIL`,
   `SIGNUP_ALARM_EMAIL`, `FOH_REMINDER_EMAIL`) with "[Preview]" in the subject,
   and nothing to members. The preview is the first-day version, so you see the
   whole email, including the line that introduces it.

3. **Switch it on** by adding one line to `frontend/.env.local`:

   ```
   PREOPEN_READ_LIVE=1
   ```

   No restart or deploy: the script reads it each morning. The next weekday it
   goes to members. Each member's first one opens with "New for members: … the
   link at the bottom turns it off."

To go back to preview mode, remove the line.

## Commands

From `~/zerogex-web` on the server.

```bash
# What would go out, and to whom. No mail, no writes.
make preopen-read DRY_RUN=1 FORCE=1

# One copy to an address you name. No database writes.
make preopen-read PREVIEW_TO=you@example.com FORCE=1

# The real send, by hand (the timer does this once it is live).
make preopen-read YES=1
```

`FORCE=1` skips only the 08:30-09:25 ET window, never the trading-day or
freshness guards.

**After a partial failure**, run the same send again. Anyone already sent that
morning's read is skipped:

```bash
make preopen-read YES=1 FORCE=1
```

## Who gets it

Members with paid access: `tier` basic or pro, not deleted, and not stopped.
That includes trials, a member whose cancel is scheduled (until their access
ends), and partner or comped members. A paused member (tier `public` for the
pause) gets nothing until the pause ends.

**Stopping it.** Every email has "Stop these morning emails" in the footer and a
one-click unsubscribe header for mail apps. Both go to `/preopen-read/stop`:
opening the link only shows a confirm button (mail scanners open every link), and
the button or the mail app's own Unsubscribe stops it. That stamps
`users.preopen_read_opt_out_at`. It is separate from the marketing opt-out, so
stopping this changes no other email, and unsubscribing from product updates does
not stop this.

**Turning it back on for a member** who asks:

```bash
sudo sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET preopen_read_opt_out_at = NULL WHERE email = 'member@example.com';"
```

## The guards

The same three as the free daily levels email (`docs/daily-levels-email.md`),
each of which aborts the whole run:

1. **Trading day**, against `NEXT_PUBLIC_NYSE_HOLIDAYS`.
2. **08:30-09:25 ET**, against the real clock. The timer also sets
   `Persistent=false`, so a host that was down at 08:42 does not send mid-session.
3. **Freshness**, per symbol. Before the open SPX, NDX, ES and NQ are still the
   prior close while SPY and QQQ have refreshed, so every row carries its own time
   and the email says why they differ. No usable SPX snapshot means no email.

Sends are paced and retried exactly like the free digest's
(`frontend/core/resendRetry.ts`), and each member is stamped
(`users.preopen_read_last_sent_on`) the moment their email is accepted.

## Files

| Piece | File |
| --- | --- |
| The words, the stop link, preview-until-live | `frontend/core/preopenRead.ts` |
| Who gets it, the latch, the stop write | `frontend/core/preopenReadRecipients.ts` |
| Send | `frontend/scripts/send-preopen-read.mts`, `make preopen-read` |
| Email transport (with List-Unsubscribe) | `sendPreopenReadEmail` in `frontend/core/mailer.ts` |
| Stop page | `frontend/app/preopen-read/stop/` |
| Timer | `deploy/systemd/zerogex-web-preopen-read.{service,timer}`, installed by `deploy/steps/099.preopen-read` |
| Tests | `frontend/tests/preopenRead.test.ts` (`npm run test:preopen-read`) |
