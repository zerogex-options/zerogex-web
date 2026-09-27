// The Quick Start video library: every walkthrough that is planned, and which
// ones are actually published. Lives here rather than in the page so the help
// home and the sidebar can ask the same question the page does.
//
// Nothing is linked until a video exists. All of these sat on /help/quickstarts
// as "Coming soon" cards for months, including one labeled "Watch this first",
// in front of the new members most likely to want a video and least likely to
// come back and check. To publish one: set its status to 'live' and give it an
// href. The page, the Help menu entry and the Help Center card appear on their
// own once any walkthrough is live.

export type Walkthrough = {
  id: string;
  title: string;
  blurb: string;
  duration: string;
  level: 'New trader' | 'Returning' | 'Advanced';
  tag: string;
  status: 'live' | 'coming-soon';
  href?: string;
};

export type Track = {
  id: string;
  title: string;
  blurb: string;
  walkthroughs: Walkthrough[];
};

export const QUICK_START_TRACKS: readonly Track[] = [
  {
    id: 'onboarding',
    title: 'Onboarding',
    blurb: 'Your first 15 minutes\u00a0- sign up, orient, find the page you need.',
    walkthroughs: [
      {
        id: 'tour',
        title: 'ZeroGEX in 90 seconds',
        blurb: 'A high-altitude tour of the platform\u00a0- the sidebar, the dashboard, the signals, the bulletin. Watch this first.',
        duration: '1:30',
        level: 'New trader',
        tag: 'Orientation',
        status: 'coming-soon',
      },
      {
        id: 'first-trade',
        title: 'Your first trade in ZeroGEX',
        blurb: 'From the morning open to a structured trade on SPX\u00a0- the workflow a working ZeroGEX user runs daily.',
        duration: '3:10',
        level: 'New trader',
        tag: 'Workflow',
        status: 'coming-soon',
      },
      {
        id: 'sign-up-and-set-up',
        title: 'Sign up, verify, and configure preferences',
        blurb: 'The account setup happy path\u00a0- Google or email, email verification, theme and palette, and the symbol picker.',
        duration: '1:45',
        level: 'New trader',
        tag: 'Account',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'dashboard-and-bulletin',
    title: 'Dashboard &amp; Bulletin',
    blurb: 'The two pages you keep open all day.',
    walkthroughs: [
      {
        id: 'reading-dashboard',
        title: 'Reading the Dashboard in 30 seconds',
        blurb: 'The discipline of a morning read\u00a0- the Key Levels strip, the gamma regime, Today\'s Read, the Trade Bias card. The right order.',
        duration: '2:20',
        level: 'New trader',
        tag: 'Dashboard',
        status: 'coming-soon',
      },
      {
        id: 'bulletin-tour',
        title: 'Live Bulletin tour',
        blurb: 'Picking a symbol and horizon, reading the regime, key levels, and expected-range band, and exporting the card to share.',
        duration: '2:00',
        level: 'New trader',
        tag: 'Live Bulletin',
        status: 'coming-soon',
      },
      {
        id: 'regime-cues',
        title: 'Spotting regime changes early',
        blurb: 'The cues that say "we are about to flip"\u00a0- heatmap migration, vol expansion, walls drifting.',
        duration: '2:45',
        level: 'Returning',
        tag: 'Dashboard',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'signals',
    title: 'Signals',
    blurb: 'Reading the score line, the cards, and the triggers.',
    walkthroughs: [
      {
        id: 'score-line',
        title: 'Reading the −100 to +100 score line',
        blurb: 'Sign, magnitude, when a 0 is a non-answer, and the Trade Bias card that changes the meaning of the score.',
        duration: '2:30',
        level: 'New trader',
        tag: 'Signals',
        status: 'coming-soon',
      },
      {
        id: 'basic-vs-advanced',
        title: 'Basic vs Advanced signals',
        blurb: 'Why some signals trigger and others are advisory early warnings that stay out of the composite. How the distinction changes how you use them.',
        duration: '2:15',
        level: 'New trader',
        tag: 'Signals',
        status: 'coming-soon',
      },
      {
        id: 'composite-walkthrough',
        title: 'Using the Composite Score',
        blurb: 'How to read the 0-100 MSI gauge, the six-component contribution bar, and when the composite is unhelpful.',
        duration: '2:50',
        level: 'Returning',
        tag: 'Composite Score',
        status: 'coming-soon',
      },
      {
        id: 'eod-pressure',
        title: 'Trading the close with EOD Pressure',
        blurb: 'The 14:30 → 15:45 ramp, the trigger, and the Trade Bias card in the final 90 minutes.',
        duration: '3:00',
        level: 'Returning',
        tag: 'EOD Pressure',
        status: 'coming-soon',
      },
      {
        id: 'squeeze-setup',
        title: 'Squeeze Setup: coiled markets',
        blurb: 'What "coiled" means, the inputs that drive the score, and when to use it as a precondition filter.',
        duration: '2:40',
        level: 'Returning',
        tag: 'Squeeze Setup',
        status: 'coming-soon',
      },
      {
        id: 'trap-detection',
        title: 'Trap Detection: fading failed breakouts',
        blurb: 'Reading the score after a break of the call wall or put wall\u00a0- when the snap-back is the trade.',
        duration: '2:55',
        level: 'Returning',
        tag: 'Trap Detection',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'metrics',
    title: 'Metrics &amp; Structure',
    blurb: 'The structural pages\u00a0- GEX, flow, max pain, technicals.',
    walkthroughs: [
      {
        id: 'dealer-positioning-tour',
        title: 'Dealer Positioning tour',
        blurb: 'Gamma exposure and open interest by strike, the strike × DTE heatmap, and what the regime header tells you.',
        duration: '3:00',
        level: 'New trader',
        tag: 'Dealer Positioning',
        status: 'coming-soon',
      },
      {
        id: 'reading-the-flip',
        title: 'Reading the gamma flip',
        blurb: 'How to interpret distance-to-flip, why it matters, and how dealer behavior changes when you cross.',
        duration: '2:35',
        level: 'Returning',
        tag: 'Dealer Positioning',
        status: 'coming-soon',
      },
      {
        id: 'flow-analysis',
        title: 'Flow Analysis in practice',
        blurb: 'Premium-weighted flow vs. net volume vs. directional flow\u00a0- when each matters and why.',
        duration: '2:50',
        level: 'Returning',
        tag: 'Flow',
        status: 'coming-soon',
      },
      {
        id: 'smart-money',
        title: 'Reading the Smart Money screen',
        blurb: 'What qualifies as smart money, the call/put notional split, and how to use the bias intraday.',
        duration: '2:30',
        level: 'Returning',
        tag: 'Smart Money',
        status: 'coming-soon',
      },
      {
        id: 'max-pain',
        title: 'Max Pain: magnet or coincidence?',
        blurb: 'When max pain is reliable, when it is not, and how to read it next to the wall structure.',
        duration: '2:20',
        level: 'New trader',
        tag: 'Max Pain',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'strategy',
    title: 'Strategy Tools',
    blurb: 'Building, pricing, and stress-testing positions.',
    walkthroughs: [
      {
        id: 'strategy-builder',
        title: 'Strategy Builder walkthrough',
        blurb: 'Building a vertical, a calendar, and a 1-by-2\u00a0- and reading the P&amp;L-at-expiration chart for each.',
        duration: '3:10',
        level: 'Returning',
        tag: 'Strategy Builder',
        status: 'coming-soon',
      },
      {
        id: 'live-chain',
        title: 'Reading a live options quote',
        blurb: 'Picking a contract by expiration, strike, and type, then reading its intraday price, bid/ask volume, open interest, IV, delta, and theta.',
        duration: '2:15',
        level: 'New trader',
        tag: 'Live Options Quotes',
        status: 'coming-soon',
      },
      {
        id: 'backtest-a-rule',
        title: 'Running your first backtest',
        blurb: 'Setting up a single-condition rule, reading the equity curve, and the out-of-sample discipline.',
        duration: '3:20',
        level: 'Advanced',
        tag: 'Backtesting',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'account-and-billing',
    title: 'Account &amp; Billing',
    blurb: 'The administrative basics.',
    walkthroughs: [
      {
        id: 'manage-subscription',
        title: 'Managing your subscription',
        blurb: 'Upgrading from Basic to Pro, switching to annual, updating payment method, and canceling cleanly.',
        duration: '1:50',
        level: 'New trader',
        tag: 'Billing',
        status: 'coming-soon',
      },
      {
        id: 'linked-providers',
        title: 'Linking a sign-in provider',
        blurb: 'Connecting Google, setting a password as fallback, and safely unlinking.',
        duration: '1:30',
        level: 'New trader',
        tag: 'Account',
        status: 'coming-soon',
      },
      {
        id: 'referrals',
        title: 'Using your referral code',
        blurb: 'Where to find it, how credits land on your bill, and the rules of the program.',
        duration: '1:40',
        level: 'New trader',
        tag: 'Referrals',
        status: 'coming-soon',
      },
    ],
  },
  {
    id: 'api',
    title: 'API &amp; Developer',
    blurb: 'For Pro subscribers using the data programmatically.',
    walkthroughs: [
      {
        id: 'api-keys',
        title: 'Generating an API key',
        blurb: 'The Pro key flow\u00a0- generation, rotation, and the "copy now" pitfall.',
        duration: '1:35',
        level: 'Advanced',
        tag: 'API',
        status: 'coming-soon',
      },
      {
        id: 'first-api-call',
        title: 'Your first API call',
        blurb: 'A working request against the GEX summary endpoint, with rate-limit handling and a JSON walkthrough.',
        duration: '3:00',
        level: 'Advanced',
        tag: 'API',
        status: 'coming-soon',
      },
    ],
  },
];

// Tracks cut down to their published walkthroughs, dropping any track left
// empty. A walkthrough counts only with both status 'live' and an href, so a
// half-edited entry can never render a card with nothing to watch.
export function liveQuickStartTracks(tracks: readonly Track[] = QUICK_START_TRACKS): Track[] {
  return tracks
    .map((track) => ({
      ...track,
      walkthroughs: track.walkthroughs.filter((w) => w.status === 'live' && !!w.href),
    }))
    .filter((track) => track.walkthroughs.length > 0);
}

export const HAS_LIVE_QUICK_STARTS = liveQuickStartTracks().length > 0;
