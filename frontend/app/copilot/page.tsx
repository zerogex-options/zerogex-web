'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Send, Sparkles, User } from 'lucide-react';

import { getCsrfToken } from '@/core/csrfClient';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

const C = {
  surface: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  brand: 'var(--color-brand-primary)',
  border: 'var(--color-border)',
};

const EXAMPLE_PROMPTS = [
  "What's the SPX setup right now?",
  'Where are the SPY gamma walls today?',
  'Explain the gamma flip in plain English',
  "What's the current QQQ Market State Index?",
];

const DISCLAIMER =
  'ZeroGEX Copilot provides options-market analytics for informational purposes ' +
  'only. This is not financial advice. Trading options involves substantial risk.';

export default function CopilotPage() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, loading]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput('');
    const history = turns;
    setTurns((prev) => [...prev, { role: 'user', content: trimmed }]);
    setLoading(true);
    capture(TelemetryEvent.CopilotMessage);

    try {
      const token = await getCsrfToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-csrf-token': token } : {}),
        },
        body: JSON.stringify({ message: trimmed, history }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        upgrade?: boolean;
      };

      if (!res.ok) {
        setError({
          message: payload.error || 'Something went wrong. Please try again.',
          upgrade: payload.upgrade,
        });
        return;
      }

      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: payload.reply || 'No response.' },
      ]);
    } catch {
      setError({ message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px 16px', color: C.light }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <h1
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
            }}
          >
            <Sparkles size={26} color={C.brand} />
            ZeroGEX Copilot
          </h1>
          <p style={{ color: C.muted, marginTop: 8, fontSize: 15 }}>
            Ask about live gamma exposure, dealer positioning, flow, and trade setups for
            SPY, SPX, and QQQ — grounded in real-time ZeroGEX data.
          </p>
        </header>

        <div
          ref={scrollRef}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 16,
            height: '52vh',
            minHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {turns.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
              <Bot size={36} color={C.brand} style={{ opacity: 0.9 }} />
              <p style={{ color: C.muted, marginTop: 12, marginBottom: 16 }}>
                Try one of these to get started:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      color: C.light,
                      cursor: 'pointer',
                      fontSize: 14,
                      textAlign: 'left',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                flexDirection: turn.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  background: turn.role === 'user' ? 'transparent' : C.brand,
                  border: turn.role === 'user' ? `1px solid ${C.border}` : 'none',
                }}
              >
                {turn.role === 'user' ? (
                  <User size={16} color={C.muted} />
                ) : (
                  <Bot size={16} color="#fff" />
                )}
              </div>
              <div
                style={{
                  maxWidth: '80%',
                  background: turn.role === 'user' ? 'transparent' : C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '10px 13px',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  fontSize: 15,
                }}
              >
                {turn.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: C.muted }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  background: C.brand,
                }}
              >
                <Bot size={16} color="#fff" />
              </div>
              <span style={{ fontSize: 14 }}>Analyzing live market structure…</span>
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 13px',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.muted,
              fontSize: 14,
            }}
          >
            {error.message}
            {error.upgrade && (
              <>
                {' '}
                <Link href="/pricing" style={{ color: C.brand, fontWeight: 600 }}>
                  View plans →
                </Link>
              </>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about SPY, SPX, or QQQ market structure…"
            disabled={loading}
            style={{
              flex: 1,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '12px 14px',
              color: C.light,
              fontSize: 15,
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: C.brand,
              border: 'none',
              borderRadius: 10,
              padding: '0 18px',
              color: '#fff',
              fontWeight: 600,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Send size={16} />
            Send
          </button>
        </form>

        <p style={{ color: C.muted, fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
          {DISCLAIMER}
        </p>
      </div>
    </main>
  );
}
