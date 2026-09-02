'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Download, LineChart } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { THINKORSWIM_STUDY_PATH } from '@/core/integrationAssets';
import {
  fillThinkScriptLevels,
  hasAnyLevel,
  type ThinkorswimLevels,
} from '@/core/thinkorswimStudy';

// "Plot these levels on thinkorswim" — the second free-indicator funnel step,
// alongside PlotOnTradingView.
//
// The delivery model is different from TradingView's on purpose. TradingView
// hosts our published script, so that block just links to it. thinkorswim has
// no equivalent public library a stranger can install from — sharing a study
// means handing someone the source and having them paste it into the Study
// Editor. So this block leads with a copy button and offers the raw file as
// the secondary path, which is the actual thinkorswim workflow rather than a
// worse imitation of the TradingView one.
//
// Free and ungated, like the TradingView script and for the same reason: the
// study is inert without numbers, and the numbers are on the public
// gamma-levels pages. There is nothing here to gate.
//
// When today's levels are available the copy button hands over the study with
// them ALREADY IN IT, so the daily ritual is one paste rather than a paste plus
// four numbers typed into a settings dialog. thinkScript cannot fetch anything,
// so pasting a regenerated script is the only automation the platform allows —
// it is what every vendor shipping GEX levels to thinkorswim does, and it is
// strictly less work than what this block asked for before. The filling itself
// lives in core/thinkorswimStudy.ts and rewrites the tracked template, so the
// filled study and the blank one cannot drift.

const STUDY_NAME = 'ZeroGEX Daily Gamma Levels';

// Content-addressed, from the generated manifest — a new build is a new URL,
// so a Cloudflare edge holding the previous bytes cannot answer for it. Same
// reasoning as the NinjaTrader indicator; see scripts/integration-assets-manifest.js.
const STUDY_URL: string = THINKORSWIM_STUDY_PATH;

// Where a standalone reader goes to get the numbers this study asks them to
// type in. On the gamma-levels pages those numbers are in the cards above.
const LEVELS_HREF = '/spx-gamma-levels';

interface PlotOnThinkorswimProps {
  /**
   * Today's levels, when the surface has them. The gamma-levels pages pass the
   * same snapshot their cards render, so what gets copied is what the reader is
   * looking at. Omitted (or all-null, on an outage) falls back to the blank
   * template — and the copy says so, rather than promising today's numbers and
   * handing over four zeros.
   */
  levels?: ThinkorswimLevels | null;
  /**
   * Set on the dedicated /thinkorswim-indicator page, where this section IS
   * the page rather than a block under today's level cards. It promotes the
   * heading to the page <h1> and swaps the "from the cards above" references —
   * which have no antecedent on their own page — for a link to the levels
   * themselves. Every other word is shared, so the two cannot drift.
   */
  standalone?: boolean;
}

const CTA_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 20px',
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 800,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;

export default function PlotOnThinkorswim({ levels, standalone = false }: PlotOnThinkorswimProps) {
  const Heading = standalone ? 'h1' : 'h2';
  // Only claim pre-filled levels when at least one actually resolved. On an
  // outage the snapshot is present but every field is null, and offering
  // "today's levels" that are four zeros is worse than offering the blank
  // template honestly.
  const prefilled = hasAnyLevel(levels);
  const prefilledSymbol = prefilled ? levels?.symbol : null;
  // Three states, not two: a failed copy must not show a success tick. Older
  // Safari and any non-secure context reject navigator.clipboard outright, and
  // silently rendering "Copied" there would send someone to the Study Editor
  // to paste an empty buffer.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const levelsSource = standalone ? (
    <>
      from today&apos;s{' '}
      <Link href={LEVELS_HREF} style={{ color: 'var(--color-brand-primary)' }}>
        free gamma levels
      </Link>
    </>
  ) : (
    <>from the cards above</>
  );

  const onCopy = async () => {
    capture('thinkorswim_indicator_clicked', { action: prefilled ? 'copy_prefilled' : 'copy' });
    try {
      // Fetched rather than inlined into the bundle: the study is ~6KB of
      // thinkScript that every visitor to a gamma-levels page would otherwise
      // download as part of the JS payload, to serve the few who click.
      const response = await fetch(STUDY_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const template = await response.text();
      // Filling is a substitution over the fetched template, so a failure here
      // is a bug in our regex rather than anything the user did — and it would
      // hand them a study that looks filled and is not. Let it throw into the
      // catch below, which shows the failure and points at the download.
      const source = prefilled && levels ? fillThinkScriptLevels(template, levels) : template;
      await navigator.clipboard.writeText(source);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch {
      // Leave the failure on screen — the download link beside it is the
      // recovery path, and a state that clears itself would hide the problem
      // before the reader worked out what to do about it.
      setCopyState('failed');
      // Recorded separately from the click above, which fires on intent. Without
      // this a blocked clipboard counts as a successful copy, and the one number
      // that tells us whether the download fallback is load-bearing — how often
      // the primary path fails — is not in the data at all.
      capture('thinkorswim_indicator_clicked', { action: 'copy_failed' });
    }
  };

  return (
    <section
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '28px',
        marginBottom: 48,
        background: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-brand-primary)',
          border: '1px solid var(--color-brand-primary)44',
          background: 'var(--color-brand-primary)14',
          borderRadius: 999,
          padding: '5px 14px',
          marginBottom: 16,
        }}
      >
        <LineChart size={12} /> Free · thinkorswim
      </div>

      <Heading
        style={{
          margin: '0 0 12px 0',
          fontSize: standalone ? 'clamp(28px, 4.2vw, 38px)' : 24,
          fontWeight: standalone ? 900 : 800,
          lineHeight: standalone ? 1.15 : undefined,
          letterSpacing: '-0.3px',
        }}
      >
        {standalone ? 'Plot ZeroGEX gamma levels on thinkorswim' : 'Plot these levels on thinkorswim'}
      </Heading>
      <p style={{ margin: '0 0 8px 0', fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)', maxWidth: 720 }}>
        On Schwab&apos;s thinkorswim? Paste our free{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>{STUDY_NAME}</strong> study into the Study
        Editor. It draws the Gamma Flip, Call Wall, Put Wall, and Max Pain as horizontal lines with a price
        chip on each — and can fire a thinkorswim alert when price crosses one.
        {prefilled ? (
          <>
            {' '}
            The copy button below hands you the study with{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              today&apos;s {prefilledSymbol} levels already in it
            </strong>{' '}
            — nothing to type.
          </>
        ) : (
          <> Then enter today&apos;s numbers {levelsSource}.</>
        )}
      </p>
      <p style={{ margin: '0 0 20px 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', opacity: 0.85, maxWidth: 720 }}>
        Manual-entry only. thinkScript runs sandboxed inside thinkorswim with no network access at all, so no
        study on that platform — ours or anyone&apos;s — can fetch live levels. For levels that update
        themselves, see our{' '}
        <Link href="/integrations" style={{ color: 'var(--color-brand-primary)' }}>
          NinjaTrader and Sierra Chart integrations
        </Link>
        .
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onCopy}
          style={{
            ...CTA_BASE,
            background: 'var(--color-brand-primary)',
            color: '#ffffff',
          }}
        >
          {copyState === 'copied' ? (
            <>
              Copied <Check size={16} />
            </>
          ) : (
            <>
              {prefilled ? `Copy with today's ${prefilledSymbol} levels` : 'Copy the study'}{' '}
              <Copy size={16} />
            </>
          )}
        </button>
        <a
          href={STUDY_URL}
          download="ZeroGEX_Daily_Gamma_Levels.ts"
          onClick={() => capture('thinkorswim_indicator_clicked', { action: 'download' })}
          style={{
            ...CTA_BASE,
            border: '1px solid var(--border-default)',
            color: 'var(--color-text-primary)',
            background: 'transparent',
          }}
        >
          Download the file <Download size={16} />
        </a>
      </div>
      {/* The download attribute restores the .ts extension thinkorswim itself
          uses. It is stored as .thinkscript because frontend/tsconfig.json
          globs every .ts file with only node_modules excluded, so a .ts file
          under public/ would be handed to the TypeScript compiler and fail
          the build. */}
      <p
        style={{
          margin: '0 0 18px 0',
          fontSize: 12,
          lineHeight: 1.6,
          minHeight: 19,
          color: copyState === 'failed' ? 'var(--color-warning)' : 'var(--color-text-secondary)',
          opacity: copyState === 'failed' ? 1 : 0.8,
        }}
      >
        {copyState === 'failed'
          ? 'Your browser blocked the clipboard — use Download the file instead, then open it in any text editor.'
          : prefilled
            ? 'Roughly 150 lines of thinkScript, with the four levels filled in. Nothing to install and no account needed — re-copy tomorrow for the new numbers.'
            : 'Roughly 150 lines of thinkScript. Nothing to install and no account needed.'}
      </p>

      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          maxWidth: 720,
        }}
      >
        <li>
          <strong style={{ color: 'var(--color-text-primary)' }}>Create the study.</strong> On a chart, open{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>Studies → Edit Studies… → Create</strong>,
          select everything already in the editor, and paste ours over it. Name it{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>&ldquo;{STUDY_NAME}&rdquo;</strong> and click
          OK.
        </li>
        <li>
          {prefilled ? (
            <>
              <strong style={{ color: 'var(--color-text-primary)' }}>Add it to the chart.</strong> The levels
              are already set, so it draws immediately. To refresh them tomorrow, come back and copy again,
              then paste over the same study — or open its settings and edit the four numbers by hand.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--color-text-primary)' }}>Add it to the chart</strong> and open its
              settings, then enter today&apos;s Gamma Flip, Call Wall, Put Wall, and Max Pain {levelsSource}.
              Leave any level at 0 to hide it.
            </>
          )}
        </li>
        <li>
          It follows you across{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>desktop, web, and mobile</strong> — thinkorswim
          syncs custom studies to your account, so this is a one-time paste.
        </li>
      </ol>
    </section>
  );
}
