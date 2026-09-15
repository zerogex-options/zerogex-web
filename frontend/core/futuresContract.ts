/**
 * The CME contract behind an ES / NQ price, as display copy.
 *
 * Why this exists: the UI said "NQ", and "NQ" does not say *which* NQ. ES and
 * NQ trade as separate contracts expiring in March, June, September and
 * December, several of them at once, at different prices. When our feed rolls
 * to the next contract and another platform has not rolled yet, two charts both
 * labelled "NQ" sit a quarter of cost-of-carry apart — roughly +300 NQ points,
 * +70 ES points — and the reader has no way to see why. Every "your futures
 * numbers are off" report has been that gap. Naming the contract on screen is
 * the fix; nothing about the prices themselves changes.
 *
 * WHICH contract is a backend answer and only a backend answer. The API sends
 * `data_contract` / `data_contract_expiry` alongside every futures price, with
 * the roll offset measured from production feed behaviour (7 days before
 * expiry, not the conventional 8). This module never re-derives that: it takes
 * the two values as given and formats them. A second roll implementation on the
 * client would drift away from the feed the day the measurement changed, and
 * the drift would look exactly like the bug we are fixing.
 *
 * `data_contract` is a DISPLAY label. It must never key a cache, a request, or
 * persisted state — on a historical series it legitimately changes from row to
 * row across a roll, so anything keyed on it would fragment mid-series.
 *
 * Runtime-dependency-free (no React, no DOM), in keeping with the other core
 * modules, so the Node test runner can hold the copy.
 */

/** Where the tooltip's "why prices can differ" link goes. */
export const FUTURES_CONTRACT_HELP_HREF = '/help/platform/futures-contract-months';

/** The help article's title, kept here so the tooltip and the article agree. */
export const FUTURES_CONTRACT_ARTICLE_TITLE =
  'Why our futures price can differ from another platform';

/** Link text for the help article, on the tooltip and anywhere else it is cited. */
export const FUTURES_CONTRACT_HELP_LABEL = 'Why prices can differ';

/**
 * The static half of the tooltip — the part that actually deflects the support
 * email. The API supplies the contract and its expiry; this sentence supplies
 * the reason the number differs from the chart the reader is comparing against.
 *
 * Deliberately NOT the words "front month". During roll week that strictly
 * means the *expiring* contract, which is the opposite of what we quote, and
 * this copy exists to remove exactly that ambiguity.
 */
export const FUTURES_CONTRACT_EXPLAINER =
  'We quote the contract carrying the volume. Platforms showing an earlier contract quote a ' +
  'lower price; the difference is cost of carry.';

/**
 * Product names for the contract roots we serve. A root we do not recognize
 * degrades to the bare contract code rather than guessing a name — the code
 * alone is still enough to set another platform to the same contract, which is
 * the one thing the reader needs.
 */
const PRODUCT_NAMES: Readonly<Record<string, string>> = {
  ES: 'CME E-mini S&P 500',
  NQ: 'CME E-mini Nasdaq-100',
  MES: 'CME Micro E-mini S&P 500',
  MNQ: 'CME Micro E-mini Nasdaq-100',
};

/**
 * CME month codes. Fixed by the exchange and unchanging — this is a spelling
 * table for a value the backend already chose, not a second opinion about which
 * contract is live. Only read when `data_contract_expiry` is absent.
 */
const MONTH_CODES: Readonly<Record<string, number>> = {
  F: 0, G: 1, H: 2, J: 3, K: 4, M: 5, N: 6, Q: 7, U: 8, V: 9, X: 10, Z: 11,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface FuturesContractDisplay {
  /** The contract code exactly as the API sent it, e.g. 'ESZ26'. */
  code: string;
  /** 'CME E-mini S&P 500', or null for a root we do not have a name for. */
  productName: string | null;
  /** 'December 2026', or null when neither the expiry nor the code yields one. */
  monthLabel: string | null;
  /** '18 Dec 2026', or null when the API sent no expiry. */
  expiryLabel: string | null;
  /** Everything after the code in the headline: 'CME E-mini S&P 500, December 2026'. */
  descriptor: string | null;
  /** Line 1: 'ESZ26 — CME E-mini S&P 500, December 2026'. */
  headline: string;
  /** Line 2: 'Expires 18 Dec 2026', or null when the API sent no expiry. */
  expiryLine: string | null;
}

/**
 * Split a contract code into its root and month/year suffix.
 *
 * Accepts the two spellings a CME code comes in — two-digit year ('ESZ26') and
 * four-digit ('ESZ2026') — and rejects anything else, so a value that is not a
 * contract code falls through to "show the code, skip the decoding" rather than
 * producing a confidently wrong month.
 */
function splitContractCode(code: string): { root: string; month: number; year: number } | null {
  const match = /^([A-Z]{1,3})([FGHJKMNQUVXZ])(\d{2}|\d{4})$/.exec(code);
  if (!match) return null;
  const [, root, monthCode, yearDigits] = match;
  const month = MONTH_CODES[monthCode];
  if (month == null) return null;
  const year = yearDigits.length === 4 ? Number(yearDigits) : 2000 + Number(yearDigits);
  return { root, month, year };
}

/**
 * Parse an ISO date (YYYY-MM-DD) as calendar fields.
 *
 * Deliberately NOT `new Date(iso)`: that parses a bare date as midnight UTC and
 * then renders it in the reader's zone, which moves an expiry back a day for
 * anyone west of Greenwich. An expiry date has no time of day, so it is read as
 * three numbers and never becomes an instant.
 */
function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * The tooltip's display strings for one futures price, or null when there is
 * nothing to say.
 *
 * Null is the ordinary case, not an error: both fields are optional and absent
 * for anything that is not a future, so SPX and SPY responses land here and the
 * caller renders exactly what it renders today.
 */
export function resolveFuturesContract(
  contract: string | null | undefined,
  expiry?: string | null,
): FuturesContractDisplay | null {
  const code = (contract ?? '').trim().toUpperCase();
  if (!code) return null;

  const parsedCode = splitContractCode(code);
  const parsedExpiry = expiry ? parseIsoDate(expiry) : null;

  const productName = parsedCode ? PRODUCT_NAMES[parsedCode.root] ?? null : null;

  // The expiry date is the API's own value, so it names the contract month
  // without any decoding on our side; the code's month letter is the fallback
  // for a response that carries the contract but not its expiry.
  const monthSource = parsedExpiry ?? parsedCode;
  const monthLabel = monthSource ? `${MONTH_NAMES[monthSource.month]} ${monthSource.year}` : null;

  const expiryLabel = parsedExpiry
    ? `${parsedExpiry.day} ${MONTH_ABBREVIATIONS[parsedExpiry.month]} ${parsedExpiry.year}`
    : null;

  // Each descriptive clause is appended only if it is known, so a contract with
  // an unrecognized root or a missing expiry reads as a shorter true sentence
  // rather than one with a hole in it.
  const descriptors = [productName, monthLabel].filter((part): part is string => !!part);

  const descriptor = descriptors.length > 0 ? descriptors.join(', ') : null;

  return {
    code,
    productName,
    monthLabel,
    expiryLabel,
    descriptor,
    headline: descriptor ? `${code} — ${descriptor}` : code,
    expiryLine: expiryLabel ? `Expires ${expiryLabel}` : null,
  };
}

/**
 * The whole tooltip as one plain sentence run.
 *
 * Two callers: the button's accessible description (so a screen reader gets the
 * explanation without opening anything), and the `title` attribute on surfaces
 * that render a bare chip. Ends by naming the article rather than linking to
 * it — neither context can carry a link.
 */
export function futuresContractDescription(contract: FuturesContractDisplay): string {
  return [
    contract.headline + '.',
    contract.expiryLine ? contract.expiryLine + '.' : null,
    FUTURES_CONTRACT_EXPLAINER,
    `See the help article "${FUTURES_CONTRACT_ARTICLE_TITLE}".`,
  ]
    .filter((part): part is string => !!part)
    .join(' ');
}

/**
 * Every contract a historical series touches, in the order it touches them.
 *
 * On `/api/market/historical` the contract is per-row, derived from each bar's
 * own timestamp, so a series spanning a roll genuinely holds two contracts —
 * and the price step between the two bars either side of the change is cost of
 * carry, not a market move. This is the one place that reads a series' contract
 * labels, and it is written for the plural case: nothing downstream may assume
 * one contract per series.
 *
 * `latest` is the contract of the newest LABELLED bar, which is what the chart
 * headline is quoting; `rolls` carries the boundaries so the chart can say the
 * visible range crosses one. A bar with no contract is a gap in the labelling
 * rather than a roll, so the last known contract carries forward and one
 * unlabelled row cannot manufacture two spurious boundaries.
 *
 * Annotation only. Nothing here may key data, and the codes must never be
 * persisted or sent back to the API.
 */
export interface SeriesContractSpan {
  /** Distinct contracts in the order the series reaches them, e.g. ['NQU26', 'NQZ26']. */
  contracts: string[];
  /** The newest labelled bar's contract — the one the headline price is on. */
  latest: string | null;
  /** That contract's expiry, so a caller has both halves without a second pass. */
  latestExpiry: string | null;
  /** Each change of contract: the index of the first bar on the new one. */
  rolls: Array<{ index: number; from: string; to: string }>;
}

export function summarizeSeriesContracts(
  rows: ReadonlyArray<{ data_contract?: string | null; data_contract_expiry?: string | null }>,
): SeriesContractSpan {
  const contracts: string[] = [];
  const rolls: SeriesContractSpan['rolls'] = [];
  let previous: string | null = null;
  let previousExpiry: string | null = null;

  for (let i = 0; i < rows.length; i += 1) {
    const current = (rows[i]?.data_contract ?? '').trim().toUpperCase() || null;
    if (!current) continue;
    if (previous && current !== previous) rolls.push({ index: i, from: previous, to: current });
    if (!contracts.includes(current)) contracts.push(current);
    previous = current;
    previousExpiry = rows[i]?.data_contract_expiry ?? null;
  }

  return { contracts, latest: previous, latestExpiry: previousExpiry, rolls };
}

/**
 * One line for a chart whose visible range crosses a roll.
 *
 * A multi-day futures chart spanning a roll has a genuine step in it — ~324 NQ
 * points on the September 2026 roll — that is not a market move. Saying so on
 * the chart itself is cheaper than answering "your chart has a gap in it" once
 * a quarter. Null when the range sits on a single contract, which is the
 * ordinary case.
 */
export function seriesRollNote(span: SeriesContractSpan): string | null {
  if (span.rolls.length === 0) return null;
  return (
    `This range spans a contract roll (${span.contracts.join(' → ')}). ` +
    'The step in price where it changes is cost of carry, not a market move.'
  );
}
