import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

import { ARTICLE_REGISTRY, SITE_URL } from '@/core/articleRegistry';
import { serverApiGet } from '@/core/api/serverFetch';
import { requireSession, validateCsrf } from '@/core/serverAuth';

// The copilot calls Claude with tool-use, where every tool is a thin wrapper
// over the ZeroGEX backend (via the server-only BFF key) plus an offline
// concept explainer backed by the education library. This keeps answers
// grounded in live, derived analytics rather than the model's training priors.
//
// Auth model: a session is required (anonymous callers get 401 and the UI
// prompts sign-in) so token spend is never anonymous. Signed-up-but-unpaid
// users (tier "public") get a small daily message allowance — the funnel
// teaser — while paid tiers are unmetered here. Gating mirrors the rest of
// the app: CSRF on the POST, session via requireSession().

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.ZEROGEX_COPILOT_MODEL || 'claude-opus-4-8';
const MAX_TOKENS = 2048;
const MAX_TOOL_ITERATIONS = 6;
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 16;
const SYMBOL_RE = /^[A-Z.]{1,10}$/;

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Free-tier (unpaid) daily message allowance, enforced per user id. In-memory
// like the auth rate limiters in serverAuth.ts — good enough for a single-node
// teaser; move to Redis if the API is horizontally scaled.
const FREE_DAILY_MESSAGES = readPositiveInt('COPILOT_FREE_DAILY_MESSAGES', 5);
const freeUsage = new Map<string, { count: number; resetAt: number }>();

function enforceFreeAllowance(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = freeUsage.get(userId);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + 24 * 60 * 60 * 1000;
    freeUsage.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: FREE_DAILY_MESSAGES - 1 };
  }
  if (entry.count >= FREE_DAILY_MESSAGES) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: FREE_DAILY_MESSAGES - entry.count };
}

const SYSTEM_PROMPT = `You are the ZeroGEX Copilot, an options-market-structure \
assistant for index underlyings (SPY, SPX, QQQ). Answer questions about gamma \
exposure (GEX), the gamma flip, call/put walls, max pain, options flow, the \
composite Market State Index (MSI), and the playbook Action Card.

Grounding rules:
- For anything about the CURRENT state of a symbol, call a tool first and base \
your answer on the numbers it returns. Prefer get_market_context for a full \
read; use the narrower tools when only one figure is needed. Never invent or \
guess live levels.
- Cite the concrete numbers you used (e.g. "gamma flip at 675, net GEX +7.1B").
- Use explain_concept for definitions and to point users to deeper reading.
- If a tool reports data is unavailable, say so plainly rather than fabricating.

Style: concise and direct; lead with the answer. You are NOT a financial \
adviser — never tell the user to buy or sell. Frame everything as analysis of \
market structure, and include a brief reminder that this is not financial \
advice when you describe a potential trade setup.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_market_context',
    description:
      'Full grounded market-structure snapshot for one underlying: GEX levels, ' +
      'the MSI regime, and the latest Action Card. Best single call for ' +
      '"what is going on in <symbol> right now?".',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Underlying, e.g. SPY, SPX, QQQ' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_gex_levels',
    description:
      'Headline gamma-exposure levels for an underlying: spot, net GEX, gamma ' +
      'flip, call wall, put wall, max pain.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Underlying, e.g. SPY, SPX, QQQ' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_signal',
    description:
      'The composite Market State Index (0-100) and its component breakdown for ' +
      'an underlying — the current regime read.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Underlying, e.g. SPY, SPX, QQQ' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_action_card',
    description:
      'The latest playbook Action Card for an underlying: a single decisive ' +
      'trade setup (or STAND_DOWN) with entry, target, stop, and rationale.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Underlying, e.g. SPY, SPX, QQQ' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'explain_concept',
    description:
      'Look up ZeroGEX education articles relevant to an options-structure ' +
      'concept (e.g. "gamma flip", "max pain", "vanna"). Returns titles, links, ' +
      'and summaries to ground a plain-English explanation.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Concept or keyword to explain' },
      },
      required: ['topic'],
    },
  },
];

function normalizeSymbol(raw: unknown): string {
  const sym = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return SYMBOL_RE.test(sym) ? sym : 'SPY';
}

function asResult(data: unknown): string {
  if (data === null || data === undefined) {
    return JSON.stringify({ error: 'Live data is currently unavailable.' });
  }
  return JSON.stringify(data);
}

function explainConcept(topic: string): string {
  const q = topic.toLowerCase().trim();
  const terms = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const scored = Object.values(ARTICLE_REGISTRY)
    .map((a) => {
      const haystack = `${a.title} ${a.blurb} ${a.slug}`.toLowerCase();
      const score = terms.reduce((acc, t) => (haystack.includes(t) ? acc + 1 : acc), 0);
      return { a, score };
    })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map(({ a }) => ({ title: a.title, url: `${SITE_URL}${a.href}`, summary: a.blurb }));

  if (scored.length === 0) {
    return JSON.stringify({
      note: 'No specific article matched; explain from general options-structure knowledge.',
    });
  }
  return JSON.stringify({ articles: scored });
}

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  const symbol = encodeURIComponent(normalizeSymbol(input.symbol));
  switch (name) {
    case 'get_market_context':
      return asResult(await serverApiGet(`/api/ai/context?underlying=${symbol}`, 0));
    case 'get_gex_levels':
      return asResult(await serverApiGet(`/api/gex/summary?symbol=${symbol}`, 0));
    case 'get_signal':
      return asResult(await serverApiGet(`/api/signals/score?underlying=${symbol}`, 0));
    case 'get_action_card':
      return asResult(await serverApiGet(`/api/signals/action?underlying=${symbol}`, 0));
    case 'explain_concept':
      return explainConcept(typeof input.topic === 'string' ? input.topic : '');
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function sanitizeHistory(raw: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw
    .filter(
      (t): t is ChatTurn =>
        !!t &&
        typeof (t as ChatTurn).content === 'string' &&
        ((t as ChatTurn).role === 'user' || (t as ChatTurn).role === 'assistant'),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((t) => ({
      role: t.role,
      content: t.content.slice(0, MAX_MESSAGE_CHARS),
    }));
  // The API requires the first message to be a user turn.
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'The copilot is not configured. Please try again later.' },
      { status: 503 },
    );
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Sign in to use the copilot.' }, { status: 401 });
  }

  if (actor.user.tier === 'public') {
    const { allowed } = enforceFreeAllowance(actor.user.id);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            'You have reached the free daily limit for the copilot. ' +
            'Subscribe for unlimited access.',
          upgrade: true,
        },
        { status: 429 },
      );
    }
  }

  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_CHARS} characters or fewer.` },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [
    ...sanitizeHistory(body.history),
    { role: 'user', content: message },
  ];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'adaptive' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === 'tool_use') {
        // Echo the assistant turn back verbatim (thinking + tool_use blocks),
        // then answer each tool call before the next model turn.
        messages.push({ role: 'assistant', content: response.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await runTool(
              block.name,
              (block.input ?? {}) as Record<string, unknown>,
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return NextResponse.json({
        reply: reply || 'I could not produce a response. Please try rephrasing.',
      });
    }

    return NextResponse.json({
      reply:
        'I gathered a lot of data but could not finish the analysis. ' +
        'Please narrow your question and try again.',
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'The copilot is busy right now. Please try again shortly.' },
        { status: 429 },
      );
    }
    // Avoid leaking internals to the client; the message is intentionally generic.
    console.error('copilot chat failed:', error);
    return NextResponse.json(
      { error: 'The copilot hit an error. Please try again.' },
      { status: 500 },
    );
  }
}
