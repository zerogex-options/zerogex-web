# Maintenance page: a Cloudflare Worker in front of zerogex.io

While the EC2 box reboots (the weekly Sunday restart, or at any other time),
visitors to zerogex.io get Cloudflare's generic **"Error 521: Web server is
down"** or **"Error 522: Connection timed out"** page. This Worker swaps that for
a branded "Down for maintenance" page ([`maintenance.html`](maintenance.html)),
which reloads itself as soon as the site is back.

## Why it lives at Cloudflare, not on the box

nginx, the Next.js app (PM2) and the FastAPI backend all run on the one box, so
a reboot takes them all down together. An nginx `error_page` or a Next.js
maintenance mode can't help, because nothing on the box is running to serve
them. Cloudflare's edge is the one piece still answering for zerogex.io during
the reboot, so the page has to come from there.

## How it works

- **Every request still goes to the origin**, exactly as it does today. There's
  no schedule, so it doesn't matter when the reboot starts or how long it takes.
- A **page load** (a `GET`/`HEAD` that accepts `text/html`) whose origin answer
  means "the site isn't answering" gets `maintenance.html` instead:
  - `502`/`504`: nginx answered but the app behind it didn't, for example at
    the end of a reboot while PM2 is still starting Next.js.
  - `520`–`526`, `530`, or no response at all: Cloudflare couldn't get a
    response from the box.

  The origin's own `500`s and `503`s pass through unchanged, because those come
  from the app itself.
- The page goes out as `503` with `Retry-After: 300` and `Cache-Control:
  no-store`. A `503` tells search engines the outage is temporary, so a crawl
  during the reboot doesn't count against the page. An `X-Origin-Status` header
  records what the origin actually said (see [Diagnosing an
  outage](#diagnosing-an-outage)).
- **Nothing that isn't a page load is ever touched.** API polls, RSC fetches,
  `/_next` assets, webhooks and the WebSocket get the origin's answer as-is, so
  nothing that expects JSON is handed HTML. If an already-open tab navigates
  while the site is down, the Next.js router falls back to a full page load,
  and that lands on the maintenance page.
- The Worker calls `passThroughOnException()`. If it ever throws, Cloudflare
  sends the request on as though the Worker weren't deployed, so it can never
  do worse than the site without it.
- The page checks the URL it replaced with a backing-off `HEAD` request (5 s,
  growing to at most 60 s). The first answer below 500 means the site is back,
  and the page reloads into it. Without JavaScript it falls back to a
  `<meta refresh>` every 60 s.

## Files

| File | What it is |
|---|---|
| `maintenance.html` | The page. Fully self-contained, with no CSS, JS, fonts or images loaded from the site, because the site is down whenever it's shown. Open it in a browser to preview it. |
| `worker.mjs` | The Worker. |
| `wrangler.toml` | Deploy config, including the `zerogex.io/*` and `www.zerogex.io/*` routes. |
| `worker.test.mjs`, `html-loader.mjs` | Tests: `node --test deploy/cloudflare/maintenance-page/worker.test.mjs` (Node 22). |

## Deploy (one-time, from a laptop)

**1. Publish the Worker and its routes.**
```bash
cd deploy/cloudflare/maintenance-page
npx wrangler login        # browser OAuth; or export CLOUDFLARE_API_TOKEN instead
npx wrangler deploy
```
An API token needs *Account → Workers Scripts: Edit* and *Zone → Workers Routes:
Edit* on zerogex.io. This step only adds the Worker in front of the site; while
the origin is up, visitors see no difference.

**2. Exclude the high-volume paths (required on the Free plan).** In the
dashboard, open the zerogex.io zone, then *Workers Routes → Add route*. Add each
of these with *Worker: None*:

| Route | Why |
|---|---|
| `zerogex.io/api/*` | The app polls live data about once a second per chart in every open tab. |
| `zerogex.io/_next/*` | Build chunks, fonts and optimized images, dozens per page view. |

The Free plan includes 100,000 Worker requests a day per account, and the
`/api/*` polling alone would use that up. Neither path needs the Worker, which
passes both through untouched anyway, since they're never page loads. A more
specific route wins, so these override `zerogex.io/*`.

**3. Fail open (Free plan).** On the `zerogex.io/*` and `www.zerogex.io/*`
routes, set *Request limit failure mode* to **Fail open**. If the daily quota
ever runs out, requests then skip the Worker and the site behaves as it does
today, instead of showing Cloudflare error 1027.

On Workers Paid (10M requests a month included), steps 2 and 3 are optional.

## Verify

Right after deploying, a page load should still come back `200`:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: text/html' https://zerogex.io/    # 200
```
Every request now reaches the origin through the Worker's own `fetch()`. If the
origin enforces Authenticated Origin Pulls ([`CLOUDFLARE_MTLS.md`](../../CLOUDFLARE_MTLS.md)),
this is also the check that those requests still carry Cloudflare's client
certificate. They should, since Cloudflare attaches it to every request it
makes to the origin. A `400` here means they don't, so roll back (below)
straight away. The Worker's *Metrics* tab in the dashboard should show requests
arriving.

**End to end (off-hours; about 30 seconds of real downtime).** On the box, stop
nginx. To Cloudflare this looks just like the box mid-reboot:
```bash
sudo systemctl stop nginx
```
Load https://zerogex.io in a browser and you should get the maintenance page.
From anywhere:
```bash
curl -s -o /dev/null -D - -H 'Accept: text/html' https://zerogex.io/ | grep -iE '^HTTP|x-origin-status'
# HTTP/2 503
# x-origin-status: 521
```
Then bring nginx back:
```bash
sudo systemctl start nginx
```
The open tab reloads into the live site within a minute. To check the `502`
path (nginx up, app still starting), run the same test with `make stop` /
`make start`, which stop and start the app under PM2.

## Editing the page

Edit `maintenance.html`, open it in a browser to check it, run the tests, then
`npx wrangler deploy` from this directory. Keep it self-contained: anything it
loaded from zerogex.io would fail at exactly the moment the page is shown.

## Diagnosing an outage

The maintenance page hides Cloudflare's error screen, so check the
`X-Origin-Status` header (the `curl` above) for what the origin actually
returned:

| `X-Origin-Status` | Meaning |
|---|---|
| `521` | Connection refused: nginx not running, or the box is booting. |
| `522`, `523` | No answer at all: the box is off or unreachable. |
| `502` | nginx is up and the app isn't. Check `pm2 status`. |
| `504`, `524` | The app is up but hung past nginx's or Cloudflare's timeout. |
| `525`, `526` | TLS between Cloudflare and nginx failed. Check the Let's Encrypt cert (step 070). |
| `unreachable` | The origin fetch failed outright. |

## Rollback

Delete the `zerogex.io/*` and `www.zerogex.io/*` routes (dashboard → *Workers
Routes*) and traffic goes straight to the origin again, with no change on the
box. To remove the Worker entirely, run `npx wrangler delete` from this
directory.
