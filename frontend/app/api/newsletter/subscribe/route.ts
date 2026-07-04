import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/core/serverAuth';
import { captureServer } from '@/core/telemetry/posthog-server';
import { TelemetryEvent } from '@/core/telemetry/events';

// Per-IP throttle: at most 5 signups per hour. The Beehiiv API happily
// takes duplicates (their reactivate_existing:true just no-ops if the
// email is already on the list), so we're not protecting Beehiiv from
// abuse — we're protecting our own outbound rate from a scraper turning
// the endpoint into a submission-storm relay.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 5;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// Beehiiv accepts free-form UTM parameters. We validate loosely (length
// only) — anything the client sends flows through to Beehiiv verbatim so
// their built-in dashboards can bucket by source. Never emit PII to
// PostHog (email is deliberately not in the event payload).
const MAX_STRING_LEN = 256;

const CONFIRMATION_REDIRECT = '/newsletter/confirmed';

const BEEHIIV_BASE_URL = 'https://api.beehiiv.com/v2';

type SubscribeBody = {
  email?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  referring_site?: unknown;
  source?: unknown;
};

function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_STRING_LEN) return false;
  // Deliberately permissive: matches "one@one.one" shape without
  // trying to be RFC-compliant. Beehiiv rejects genuine garbage on its
  // side; our job is to drop obvious junk before the network call.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function boundedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_STRING_LEN) return undefined;
  return trimmed;
}

function enforceRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true };
  }
  if (bucket.count >= RATE_MAX_PER_WINDOW) {
    return { allowed: false };
  }
  bucket.count += 1;
  return { allowed: true };
}

// ----------------------------------------------------------------------
// POST /api/newsletter/subscribe
// ----------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as SubscribeBody;

  const email = body.email;
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rate = enforceRateLimit(ip);
  if (!rate.allowed) {
    // Silently accept-and-drop above the ceiling — spec says the caller
    // should see success semantics, not a 429. The user experience of an
    // over-eager form submit shouldn't be a rejection.
    return NextResponse.json({ ok: true, redirect: CONFIRMATION_REDIRECT });
  }

  const utmSource = boundedString(body.utm_source);
  const utmMedium = boundedString(body.utm_medium);
  const utmCampaign = boundedString(body.utm_campaign);
  const referringSite = boundedString(body.referring_site);
  const source = boundedString(body.source);

  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();

  if (!apiKey || !publicationId) {
    // Dev / staging without Beehiiv wired up: log and pretend success
    // so we don't block operators verifying the frontend UI in an
    // environment that has no Beehiiv access. Production has a hard
    // requirement in the deploy checklist; this is only reachable when
    // an env var is missing.
    console.warn(
      '[newsletter/subscribe] BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID unset — no-op.',
    );
    await captureNewsletterSignup({ ip, source, utmSource, utmMedium });
    return NextResponse.json({ ok: true, redirect: CONFIRMATION_REDIRECT });
  }

  const payload: Record<string, unknown> = {
    email: email.trim(),
    reactivate_existing: true,
    send_welcome_email: true,
  };
  if (utmSource) payload.utm_source = utmSource;
  if (utmMedium) payload.utm_medium = utmMedium;
  if (utmCampaign) payload.utm_campaign = utmCampaign;
  if (referringSite) payload.referring_site = referringSite;

  try {
    const response = await fetch(
      `${BEEHIIV_BASE_URL}/publications/${publicationId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(
        `[newsletter/subscribe] Beehiiv responded ${response.status} ${text.slice(0, 500)} request_id=${response.headers.get('x-request-id') ?? '?'}`,
      );
      // A 400 from Beehiiv usually means an unparseable email that
      // slipped past our regex (Unicode edge cases, disposable-domain
      // blocks). Surface that to the user as a validation error; a 5xx
      // is our fault to swallow so the visitor still lands on the
      // confirmation page rather than a red toast.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return NextResponse.json({ error: 'Could not add that address — please try again.' }, { status: 400 });
      }
    }
  } catch (err) {
    // Never leak the exception to the client — a timeout / DNS failure
    // is our infrastructure problem, not the visitor's. Log for ops,
    // pretend success, and let Beehiiv or a follow-up cron collect the
    // signup later if their side recovers.
    console.warn(`[newsletter/subscribe] Beehiiv fetch failed: ${err instanceof Error ? err.message : err}`);
  }

  await captureNewsletterSignup({ ip, source, utmSource, utmMedium });

  return NextResponse.json({ ok: true, redirect: CONFIRMATION_REDIRECT });
}

async function captureNewsletterSignup(input: {
  ip: string;
  source: string | undefined;
  utmSource: string | undefined;
  utmMedium: string | undefined;
}) {
  // Distinct id = IP hash-ish (we don't have a session — the newsletter
  // signup is deliberately anonymous). PostHog's server SDK will silent
  // no-op when the key isn't set (dev / preview envs); production has it.
  try {
    await captureServer(
      `anon_ip_${input.ip}`,
      TelemetryEvent.NewsletterSignup,
      {
        source: input.source ?? 'unknown',
        utm_source: input.utmSource ?? null,
        utm_medium: input.utmMedium ?? null,
      },
    );
  } catch {
    // Analytics must never break the request path.
  }
}
