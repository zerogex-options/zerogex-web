# Mario Gonzalez and 차상재 (Sang-jae Cha): the site was down (2026-11-20)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Two emails to support@, both sent while the site was down, before
the Fri Nov 20 fix:

- **Mario Gonzalez** `<marianogr8888@gmail.com>`, subject "Sistema caido":

  > Hola buenos dias esta mañana se cortado la conexion ¿ que ha pasado ?
  > espero que sea temporal y se resuelva el problema . gracias

  In English: "Good morning, this morning the connection went down. What
  happened? I hope it's temporary and the problem gets fixed. Thanks."

- **차상재** `<chacha0475@naver.com>`, subject "GEX Heatmap Page Not Working":

  > I have been unable to access the GEX Heatmap page for quite some time. The
  > page at https://zerogex.io/gamma-exposure is not working properly. Could
  > you please let me know: 1. Is there currently an issue with the GEX
  > Heatmap? 2. Is the page temporarily unavailable, or has access been
  > changed? 3. When can I expect the service to work normally again? I
  > primarily use ZeroGEX for NQ futures trading, so this issue is affecting
  > my daily trading workflow.

> **Status:** drafts, not sent. Run the account check under "Verify first"
> before sending the second one.

## What happened

- **A failed deploy left the site with no build.** `67516de` (committed Thu
  Nov 19, 9:42 AM ET) added a test with a type error. `next build`
  type-checks every `.ts` file, so every production build from then on stopped
  at "Failed to type check". `make deploy` deletes the running site's build
  before it builds, so the deploy that hit this left the app with nothing to
  run, and Cloudflare showed 502 Bad Gateway.
- **Fixed Fri Nov 20 at about 7:30 AM ET.** The fix (`c880580`, on
  `claude/fix-reinstate-test-typecheck`) went into `release` at 7:26 AM ET,
  then `make rebuild`.
- **The deploy is fixed on `claude/deploy-keep-site-up`.** A failed build
  now leaves the running site up, and a new build that doesn't start is
  swapped back for the previous one by itself. Both drafts promise this, so
  merge that branch on the host before your next deploy.

## The read

- **Both are this outage.** Mario wrote "this morning", most likely from
  Spain, where morning is the US night. Sang-jae trades NQ futures, which trade
  through the US night, daytime in Korea, so the outage covered Sang-jae's
  trading day.
- **Sang-jae's second question deserves a checked answer.** The page in the
  email is Dealer Positioning (`/gamma-exposure`), which needs Basic or above
  (`core/auth.ts`). The outage hit every page, but confirm Sang-jae's plan
  didn't also change before saying it didn't.
- **Keep the cause plain and owned.** "An update failed partway through and
  took the site offline" is true and enough, as in the Glimind note.
- **Spanish for Mario, with "tú"**, which is what the Spanish pages on the site
  use.
- **No credit in these replies.** An apology and the fix answer what both
  asked. If either writes back unhappy, `make gift-month` is the tool.

## Verify first

1. **Their accounts.** Expect `basic` or `pro`, and `active` or `trialing`,
   with no `paused_until` in the future. If Sang-jae's row shows anything else,
   that access did change: don't send that draft as written.

   ```bash
   sudo sqlite3 -readonly -header /var/lib/zerogex/auth.db "SELECT email, tier, subscription_status, current_period_end, paused_until, last_seen_at FROM users WHERE email IN ('chacha0475@naver.com', 'marianogr8888@gmail.com');"
   ```

   No row for an address means that person's account is under a different
   email. Mario's draft doesn't depend on the account, so it can go anyway.

2. **Optional, can wait: when the outage started.** This counts 502s per hour
   in the nginx access logs (box time, ET). The first hour with a big count is
   when the site went down. If that's during Thursday's session, more
   customers were hit than these two.

   ```bash
   sudo zcat -f /var/log/nginx/access.log* | awk '$9 == 502 {print substr($4, 2, 14)}' | sort | uniq -c
   ```

## Draft: Mario (Spanish)

Reply in the same thread.

Hola Mario,

Gracias por avisarnos, y perdona las molestias. La web estuvo caída, y fue culpa nuestra: una actualización del sitio falló a medio camino y lo dejó fuera de servicio.

Ya está resuelto. Todo funciona con normalidad desde las 7:30 de la mañana, hora de Nueva York (12:30 UTC). Si todavía ves algún error, recarga la página, y si sigue fallando, responde a este correo y lo reviso.

También estoy cambiando la forma en que publicamos las actualizaciones para que, si alguna falla, la web siga funcionando.

Un saludo,
Michael
Fundador de ZeroGEX

**In English, for you (don't send):** "Thanks for letting us know, and sorry
for the trouble. The site was down, and it was our fault: an update to the site
failed partway through and took it offline. It's fixed. Everything has worked
normally since 7:30 AM New York time (12:30 UTC). If you still see an error,
reload the page, and if it keeps failing, reply to this email and I'll look
into it. I'm also changing how we release updates so that, if one fails, the
site keeps working."

## Draft: Sang-jae (English)

Reply in the same thread. 차상재 is written family name first: Cha (차), then
the given name, 상재, which is Sang-jae in standard romanization. The email
doesn't show how Sang-jae spells it in English (Sangjae and Sang Jae are also
common), so "Hello," is the safe opening if you'd rather not guess.

Hi Sang-jae,

Thank you for writing, and I'm sorry. The problem was on our side, and it affected the whole site, not only the GEX Heatmap.

To answer your questions:

1. Yes, there was an issue. An update we released failed partway through and took the site offline.
2. The page was temporarily unavailable. Nothing about your access has changed.
3. It is working normally again. Everything has been back since about 7:30 AM US Eastern time (12:30 UTC, 9:30 PM in Korea).

I know you rely on ZeroGEX for your NQ trading, and I'm sorry it let you down. I'm changing how we release updates so that a failed update can't take the site offline again.

If the page still doesn't work for you, please reload it, and if it still fails, reply to this email. I'll look into it right away.

Best,
Michael
Founder, ZeroGEX
