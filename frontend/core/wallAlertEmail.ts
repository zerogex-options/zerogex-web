// The wall-alert email: one message per member per delivery pass, carrying
// every alert that member has waiting (SPX and SPY walls often fire within the
// same minute; two emails seconds apart is exactly the noise this feature is
// meant to remove).
//
// Pure render — no network, no env — so tests/wallAlerts.test.ts can assert the
// exact copy, and core/mailer.ts sendWallAlertEmail adds only the transport and
// the RFC 8058 one-click unsubscribe headers. Same split as
// core/dailyLevelsDigest.ts.

import {
  fmtEtTime,
  fmtStrike,
  formatWallAlert,
  type FormattedWallAlert,
  type WallAlertPayload,
} from './wallAlerts.ts';

export interface WallAlertEmailItem {
  payload: WallAlertPayload;
  /** When the alert fired (the delivery row's created_at). */
  at: string | null;
}

export interface WallAlertEmailOptions {
  alerts: WallAlertEmailItem[];
  appUrl: string;
  /** Signed one-click link that switches wall-alert email off. */
  unsubUrl: string;
}

const SUBJECT_MAX = 120;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TONE: Record<FormattedWallAlert['tone'], { fg: string; bg: string; bar: string }> = {
  info: { fg: '#0B5A80', bg: '#E0F1FA', bar: '#0B5A80' },
  bull: { fg: '#0F7A3A', bg: '#DBF3E4', bar: '#0F7A3A' },
  bear: { fg: '#A31226', bg: '#FBE1E5', bar: '#A31226' },
  neutral: { fg: '#374151', bg: '#E5E7EB', bar: '#374151' },
};

export function wallAlertEmailSubject(alerts: WallAlertEmailItem[]): string {
  if (alerts.length === 1) {
    const f = formatWallAlert(alerts[0].payload);
    return f.tierLabel ? `${f.headline} (${f.tierLabel})` : f.headline;
  }
  const heads = alerts.map((a) => formatWallAlert(a.payload).headline);
  const prefix = `${alerts.length} wall alerts: `;
  let subject = prefix;
  for (let i = 0; i < heads.length; i++) {
    const next = (i === 0 ? '' : ', ') + heads[i];
    if ((subject + next).length > SUBJECT_MAX - 2) {
      return `${subject}, …`;
    }
    subject += next;
  }
  return subject;
}

function dashboardUrl(appUrl: string, symbol: string): string {
  return `${appUrl.replace(/\/+$/, '')}/dashboard?symbol=${encodeURIComponent(symbol)}`;
}

export function buildWallAlertEmail(opts: WallAlertEmailOptions): {
  subject: string;
  text: string;
  html: string;
} {
  const appUrl = opts.appUrl.replace(/\/+$/, '');
  const manageUrl = `${appUrl}/account/alerts`;
  const formatted = opts.alerts.map((a) => ({ item: a, f: formatWallAlert(a.payload) }));
  const subject = wallAlertEmailSubject(opts.alerts);
  const symbols = Array.from(new Set(opts.alerts.map((a) => a.payload.symbol)));

  // ── text ──
  const text: string[] = [];
  for (const { item, f } of formatted) {
    const when = fmtEtTime(item.at ?? item.payload.bar_ts);
    text.push(`${f.kindChip} · ${f.headline}${when ? ` · ${when}` : ''}`);
    text.push(f.detail);
    for (const line of f.facts) text.push(line);
    for (const line of f.context) text.push(line);
    text.push('');
  }
  for (const symbol of symbols) {
    text.push(`Open ${symbol} levels: ${dashboardUrl(appUrl, symbol)}`);
  }
  text.push('');
  text.push(`Manage your wall alerts: ${manageUrl}`);
  text.push(`Stop wall-alert emails: ${opts.unsubUrl}`);
  text.push('');
  text.push(
    'Alerts are informational market data, not financial advice. Prices are the 1-minute tape; walls are the published ZeroGEX Call/Put Walls.',
  );

  // ── html ──
  const cards = formatted
    .map(({ item, f }) => {
      const tone = TONE[f.tone];
      const when = fmtEtTime(item.at ?? item.payload.bar_ts);
      const facts = f.facts
        .map((line) => `<div style="font-size:13px; color:#374151; margin-top:4px;">${escapeHtml(line)}</div>`)
        .join('');
      const context = f.context
        .map(
          (line) =>
            `<div style="font-size:12px; color:#6b7280; margin-top:6px; line-height:1.5;">${escapeHtml(line)}</div>`,
        )
        .join('');
      return `
        <div style="border:1px solid #e5e7eb; border-left:4px solid ${tone.bar}; border-radius:10px; padding:14px 16px; margin:0 0 12px;">
          <div style="font-size:11px; letter-spacing:0.06em; color:#6b7280; margin-bottom:6px;">
            <span style="display:inline-block; padding:2px 8px; border-radius:9999px; background:${tone.bg}; color:${tone.fg}; font-weight:700;">${escapeHtml(f.kindChip)}</span>
            ${when ? `<span style="margin-left:8px;">${escapeHtml(when)}</span>` : ''}
          </div>
          <div style="font-size:17px; font-weight:700; color:#111827;">${escapeHtml(f.headline)}</div>
          <div style="font-size:14px; color:#111827; margin-top:6px; font-variant-numeric:tabular-nums;">${escapeHtml(f.detail)}</div>
          ${facts}
          ${context}
        </div>`;
    })
    .join('');

  const buttons = symbols
    .map(
      (symbol) =>
        `<a href="${escapeHtml(dashboardUrl(appUrl, symbol))}" style="display:inline-block; margin:0 8px 8px 0; padding:10px 16px; background:#003F5C; color:#ffffff; font-weight:600; text-decoration:none; border-radius:8px; font-size:14px;">Open ${escapeHtml(symbol)} levels</a>`,
    )
    .join('');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#1a1a1a; max-width:560px; margin:0 auto; padding:24px; line-height:1.5;">
      <div style="font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; margin-bottom:12px;">ZeroGEX wall alert${opts.alerts.length === 1 ? '' : 's'}</div>
      ${cards}
      <div style="margin:18px 0 6px;">${buttons}</div>
      <p style="font-size:11px; color:#9ca3af; margin-top:28px; line-height:1.6;">
        You are receiving this because you set a wall alert on ZeroGEX.
        <a href="${escapeHtml(manageUrl)}" style="color:#6b7280;">Manage your alerts</a>
        &middot;
        <a href="${escapeHtml(opts.unsubUrl)}" style="color:#6b7280;">Stop wall-alert emails</a><br>
        Alerts are informational market data, not financial advice. Prices are the 1-minute tape; walls are the published ZeroGEX Call/Put Walls.
      </p>
    </div>
  `.trim();

  return { subject, text: text.join('\n'), html };
}

/** For logs: a compact one-line description of a batch. */
export function describeBatch(alerts: WallAlertEmailItem[]): string {
  return alerts
    .map((a) => `${a.payload.symbol} ${a.payload.side} ${fmtStrike(a.payload.wall)} ${a.payload.kind}`)
    .join(', ');
}
