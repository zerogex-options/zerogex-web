// The rules behind scripts/send-founder-notes.mts, kept pure so what a note
// says, and whether it may go out, can be tested without Stripe, Resend or a
// database.
//
// WHY FOUNDER NOTES ARE SENT FROM THE DOC. The payment-failure follow-ups in
// docs/outreach/ are written by hand, one per member, a day or more before they
// go out, and each one carries that member's own signed /pay link. Sending them
// meant copying every draft into a mail client. That is slow; it is the one
// step where one member's pay link can be pasted into another member's email;
// and it sends whatever the draft said when it was written, so a member who
// paid, canceled or lost access overnight still got a note saying otherwise.
// Now the drafts sit in the doc as ```note blocks (format below), and the
// script checks each one against Stripe and the database at the moment it
// would go out.
//
// THE FORMAT. A note is a fenced block opened by a line that is exactly
// ```note and closed by a line of ```:
//
//   ```note
//   to: adriano.kor@gmail.com
//   invoice: in_1UNJP24AOiqteMYYsyAUXGuB
//   subject: Your ZeroGEX payment didn't go through
//   send-after: 2026-10-08T09:00-04:00
//   access: on
//
//   Hi Adriano,
//
//   When you're ready, you can pay with any card here: {{pay_link}}
//
//   Best,
//   ```
//
// Headers come first, one `key: value` per line, up to the first blank line.
// The email is everything after it, exactly as written: mail clients wrap, so
// each paragraph stays one line. The keys (any case):
//
//   to          required. The member's account email; one address.
//   invoice     required. The open invoice the note is about. One note per
//               invoice, ever: the send latch is keyed on it.
//   subject     required.
//   send-after  optional. Not before this instant. It must name its zone (Z or
//               an offset like -04:00), because "09:00" alone is a different
//               moment on a laptop in New York and on a server in UTC.
//   access      optional, "on" or "off": what the note tells the member about
//               their account. "on" says it is still on, so the note must not
//               go out once access has ended. "off" says it has ended ("Basic
//               is paused for now..."), so while they still hold a paid tier
//               the note waits, and a later run sends it once the grace
//               cutoff has taken access away.
//
// THE SIGNATURE. Every note goes out with Michael's signature under it, the
// same card his Gmail adds: his photo, "Michael", "Founder, ZeroGEX", the
// tagline and zerogex.io (FOUNDER_SIGNATURE below). So a note ends at its
// sign-off, "Best,", and one whose last line signs it ("Michael" or
// "Founder, ZeroGEX") is an error rather than an email signed twice.
//
// {{pay_link}} in the body becomes the signed /pay link for the note's own
// invoice, built at send time rather than pasted in, so a note can only carry
// the link for the invoice it was checked against. It is the only placeholder,
// and any other brace in the body is an error: a mistyped {{ pay_link }} would
// otherwise reach the member as literal text, with no way to pay.
//
// Everything else in the doc is prose and is ignored, including other fenced
// blocks and anything inside an HTML comment, so a note can be commented out,
// or shown as an example in a ```` or ~~~ block, without being sent. Any
// mistake in any note is an error, and one error stops the whole run before
// anything is looked up.
//
// The one mistake that would not look like one is a note missing its closing
// ```. It runs on into the doc until the next fence, often a command block a
// section or two down, and swallows that section's heading and its private
// notes about another member into the email. So the doc's fences must pair
// up, a ```note may not sit inside a ``` block, and a body may not hold a
// Markdown heading or rule. Each of those only happens when a ``` is missing.
//
// NO `server-only` AND NO '@/' ALIAS: the send script imports this under
// --experimental-strip-types, outside Next.

export type FounderNote = {
  /** 1-based line of the opening ```note fence, for messages. */
  line: number;
  /** The member's account email, lowercased. */
  to: string;
  invoiceId: string;
  subject: string;
  /** Not before this instant (ms since the epoch), or null when it may go any time. */
  sendAfterMs: number | null;
  /**
   * What the note tells the member about their access: 'on' (still on), 'off'
   * (it has ended), or null when it says neither. One field, so a note cannot
   * claim both.
   */
  access: 'on' | 'off' | null;
  /** The email as written: one line per paragraph, blank lines between. */
  body: string;
};

/** The one placeholder a body may use. */
export const PAY_LINK_PLACEHOLDER = '{{pay_link}}';

const HEADER_KEYS = ['to', 'invoice', 'subject', 'send-after', 'access'] as const;
type HeaderKey = (typeof HEADER_KEYS)[number];

const MAX_SUBJECT_LENGTH = 200;
const INVOICE_ID = /^in_[A-Za-z0-9]+$/;
const HEADER_LINE = /^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*)$/;

// One address and nothing else: no display name, no list. A local part with
// none of the characters that would mean either, then a dotted domain.
const EMAIL_ADDRESS =
  /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

/** A basic shape check for one plain email address. */
export function isEmailAddress(value: string): boolean {
  return EMAIL_ADDRESS.test(value);
}

// ── Reading the doc ─────────────────────────────────────────────────────────

/** A note opens with exactly three backticks and `note`. */
const NOTE_OPEN = /^```note[ \t]*$/;
/** A line of backticks and nothing else closes it (CommonMark: up to 3 spaces in). */
const NOTE_CLOSE = /^ {0,3}`{3,}[ \t]*$/;
/** Any other fenced block's opening and closing lines. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
/** Inside a note, a line like this almost always means the note above it was never closed. */
const FENCE_LIKE = /^\s*`{3,}/;
/** Meant as a note, but not exactly ```note at the start of a line, so it would not be read. */
const NOTE_NEAR_MISS = /^[\s>]*(?:`{3,}|~{3,})\s*notes?\b/i;
const COMMENT_OPEN = /^ {0,3}<!--/;
/**
 * A Markdown heading or rule. The doc's own structure, never a line of a
 * plain-text email: in a body it means the note ran on past its end.
 */
const DOC_STRUCTURE = /^(?:#{1,6}(?:\s|$)|(?:-{3,}|\*{3,}|_{3,}|={3,})$)/;

type SourceLine = { text: string; line: number };

type ScanState =
  | { kind: 'prose' }
  | { kind: 'note'; line: number; rows: SourceLine[]; broken: boolean }
  | { kind: 'fence'; line: number; char: string; length: number; hiddenNote: number | null }
  | { kind: 'comment'; line: number; hiddenNote: number | null };

/**
 * Every ```note block in the doc, or every reason it cannot be trusted. The
 * caller sends nothing unless `errors` is empty.
 *
 * Other fenced blocks and HTML comments are tracked the way a Markdown renderer
 * reads them, so what is read as a note is what the doc shows as one: a
 * ```note line inside another block or a comment is not a note.
 */
export function parseFounderNotes(markdown: string): { notes: FounderNote[]; errors: string[] } {
  const notes: FounderNote[] = [];
  const errors: string[] = [];
  const noteLineByInvoice = new Map<string, number>();

  const finishNote = (line: number, rows: SourceLine[]) => {
    const parsed = parseNoteBlock(line, rows);
    errors.push(...parsed.errors);
    if (parsed.invoiceId) {
      const first = noteLineByInvoice.get(parsed.invoiceId);
      if (first !== undefined) {
        errors.push(
          `Note at line ${line}: invoice ${parsed.invoiceId} already has the note at line ${first}. One note per invoice.`,
        );
        return;
      }
      noteLineByInvoice.set(parsed.invoiceId, line);
    }
    if (parsed.note) notes.push(parsed.note);
  };

  let state: ScanState = { kind: 'prose' };
  const lines = markdown.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].replace(/\r$/, '');
    const line = index + 1;
    switch (state.kind) {
      case 'prose': {
        if (NOTE_OPEN.test(text)) {
          state = { kind: 'note', line, rows: [], broken: false };
          break;
        }
        if (NOTE_NEAR_MISS.test(text)) {
          errors.push(
            `Line ${line}: "${clip(text.trim())}" looks like the start of a note but is not read as one. ` +
              'A note opens with a line that is exactly ```note.',
          );
        }
        const fence = FENCE_OPEN.exec(text);
        // A backtick run followed by more backticks on the same line is inline
        // code, not a fence.
        if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
          state = { kind: 'fence', line, char: fence[1][0], length: fence[1].length, hiddenNote: null };
        } else if (COMMENT_OPEN.test(text) && !text.slice(text.indexOf('<!--') + 4).includes('-->')) {
          state = { kind: 'comment', line, hiddenNote: null };
        }
        break;
      }
      case 'note': {
        if (NOTE_CLOSE.test(text)) {
          // A broken note has already said why; its contents would only add noise.
          if (!state.broken) finishNote(state.line, state.rows);
          state = { kind: 'prose' };
          break;
        }
        if (FENCE_LIKE.test(text) && !state.broken) {
          state.broken = true;
          errors.push(
            `Note at line ${state.line}: line ${line} ("${clip(text.trim())}") starts with \`\`\` but does not close ` +
              'the note. Is the closing ``` missing above it? Each note ends with a line of just ```.',
          );
        }
        state.rows.push({ text, line });
        break;
      }
      case 'fence': {
        const close = FENCE_CLOSE.exec(text);
        if (close && close[1][0] === state.char && close[1].length >= state.length) {
          state = { kind: 'prose' };
        } else if (NOTE_OPEN.test(text)) {
          // Inside a ```` or ~~~ block, a ```note line is an example of one.
          // Inside a ``` block it cannot be, because Markdown would end the
          // block at the example's own closing line. There it means a ``` went
          // missing earlier and the fences since are being read back to front.
          if (state.char === '`' && state.length === 3) {
            errors.push(
              `Line ${line}: this \`\`\`note is inside the \`\`\` block that starts at line ${state.line}, so it is ` +
                'not read as a note. A ``` is missing above it, probably at the end of a note.',
            );
          }
          if (state.hiddenNote === null) state.hiddenNote = line;
        }
        break;
      }
      case 'comment': {
        if (text.includes('-->')) state = { kind: 'prose' };
        else if (state.hiddenNote === null && NOTE_OPEN.test(text)) state.hiddenNote = line;
        break;
      }
    }
  }

  // Fences come in pairs, so one still open at the end means a closing line is
  // missing somewhere above, and every fence after it was read back to front.
  // The likeliest missing one is a note's, whose email then ran on into the
  // doc. A comment left open only matters if it hides a note.
  if (state.kind === 'note' && !state.broken) {
    errors.push(`Note at line ${state.line}: it is never closed. End it with a line of just \`\`\`.`);
  } else if (state.kind === 'fence') {
    const fence = state.char.repeat(state.length);
    const hidden = state.hiddenNote === null ? '' : `, and the note at line ${state.hiddenNote} is inside it`;
    errors.push(
      `Line ${state.line}: the ${fence} block that starts here is never closed${hidden}. Fences come in pairs, ` +
        `so a ${fence} is probably missing earlier in the doc, for example at the end of a note.`,
    );
  } else if (state.kind === 'comment' && state.hiddenNote !== null) {
    errors.push(
      `Line ${state.line} opens an HTML comment (<!--) that is never closed, so the note at line ` +
        `${state.hiddenNote} inside it is not read. Close the comment with -->.`,
    );
  }

  return { notes, errors };
}

function isHeaderKey(key: string): key is HeaderKey {
  return (HEADER_KEYS as readonly string[]).includes(key);
}

function parseNoteBlock(
  line: number,
  rows: SourceLine[],
): { note: FounderNote | null; invoiceId: string | null; errors: string[] } {
  const errors: string[] = [];
  const fail = (message: string) => {
    errors.push(`Note at line ${line}: ${message}`);
  };

  // Headers: from the first non-blank line to the first blank one.
  let index = 0;
  while (index < rows.length && rows[index].text.trim() === '') index += 1;
  const values = new Map<HeaderKey, string>();
  for (; index < rows.length && rows[index].text.trim() !== ''; index += 1) {
    const header = rows[index].text.trim();
    const match = HEADER_LINE.exec(header);
    if (!match) {
      fail(
        `line ${rows[index].line} ("${clip(header)}") is not a "key: value" header. ` +
          'The headers end at the first blank line, and the email starts after it.',
      );
      continue;
    }
    const key = match[1].toLowerCase();
    if (!isHeaderKey(key)) {
      fail(`unknown header "${match[1]}". The headers are: ${HEADER_KEYS.join(', ')}.`);
      continue;
    }
    if (values.has(key)) {
      fail(`"${key}" is given twice.`);
      continue;
    }
    values.set(key, match[2].trim());
  }

  const toRaw = values.get('to');
  let to: string | null = null;
  if (toRaw === undefined) fail('"to" is missing: the member\'s account email.');
  else if (!isEmailAddress(toRaw)) fail(`to: "${clip(toRaw)}" is not one plain email address.`);
  else to = toRaw.toLowerCase();

  const invoiceRaw = values.get('invoice');
  let invoiceId: string | null = null;
  if (invoiceRaw === undefined) fail('"invoice" is missing: the unpaid invoice the note is about (in_...).');
  else if (!INVOICE_ID.test(invoiceRaw)) fail(`invoice: "${clip(invoiceRaw)}" is not a Stripe invoice id (in_...).`);
  else invoiceId = invoiceRaw;

  const subject = values.get('subject');
  if (subject === undefined) fail('"subject" is missing.');
  else if (subject === '') fail('"subject" is empty.');
  else if (subject.length > MAX_SUBJECT_LENGTH) {
    fail(`the subject is ${subject.length} characters; the most is ${MAX_SUBJECT_LENGTH}.`);
  } else if (/[{}]/.test(subject)) {
    fail(`the subject has a "{" or "}". Only ${PAY_LINK_PLACEHOLDER}, in the body, is filled in.`);
  }

  const sendAfterRaw = values.get('send-after');
  let sendAfterMs: number | null = null;
  if (sendAfterRaw !== undefined) {
    const parsed = parseZonedIso(sendAfterRaw);
    if ('error' in parsed) fail(`send-after: ${parsed.error}`);
    else sendAfterMs = parsed.ms;
  }

  const accessRaw = values.get('access');
  let access: 'on' | 'off' | null = null;
  if (accessRaw !== undefined) {
    const value = accessRaw.toLowerCase();
    if (value === 'on' || value === 'off') access = value;
    else {
      fail(
        `access: "${clip(accessRaw)}" is not allowed. Use "on" (the note says their access is still on) or ` +
          '"off" (it says their access has ended), or leave the line out.',
      );
    }
  }

  // The body: after the blank line that ends the headers. Trailing space goes,
  // blank lines at either end go, everything else stays exactly as written.
  const bodyRows = rows.slice(index + 1).map((row) => ({ line: row.line, text: row.text.replace(/\s+$/, '') }));
  while (bodyRows.length > 0 && bodyRows[0].text === '') bodyRows.shift();
  while (bodyRows.length > 0 && bodyRows[bodyRows.length - 1].text === '') bodyRows.pop();
  const body = bodyRows.map((row) => row.text).join('\n');
  if (!body) {
    fail('the email itself is empty. It goes after the headers and one blank line.');
  } else {
    // A note missing its closing ``` runs on until the next fence, which in an
    // outreach doc is often a command block a section or two down. Its body
    // then holds that section's heading, and its private notes about another
    // member, and would otherwise parse as a perfectly good note.
    const structure = bodyRows.find((row) => DOC_STRUCTURE.test(row.text.trimStart()));
    if (structure) {
      fail(
        `line ${structure.line} ("${clip(structure.text.trim())}") is a Markdown heading or rule: part of the doc, ` +
          'not the email. Is the closing ``` missing above it?',
      );
    }
    // The signature goes on at send time, so a note that signs itself would
    // arrive with the name twice.
    const last = bodyRows[bodyRows.length - 1];
    if (SIGNS_ITSELF.test(last.text.trim())) {
      fail(
        `line ${last.line} ("${clip(last.text.trim())}") signs the note, but the signature is added when it is ` +
          'sent. End the note at the sign-off, e.g. "Best,".',
      );
    }
    const stray = strayPlaceholders(body);
    if (stray.length > 0) {
      fail(
        `the body has ${stray.map((token) => `"${token}"`).join(', ')}. The only placeholder is ` +
          `${PAY_LINK_PLACEHOLDER}, written exactly like that, and the body may have no other braces.`,
      );
    }
  }

  if (errors.length > 0 || !to || !invoiceId || !subject) return { note: null, invoiceId, errors };
  return { note: { line, to, invoiceId, subject, sendAfterMs, access, body }, invoiceId, errors };
}

// A last line that is the signature's own first or second line.
const SIGNS_ITSELF = /^(?:[-\u2013\u2014]+\s*)?(?:michael|founder,?\s+zerogex\.?)$/i;

// Anything brace-shaped that is not exactly {{pay_link}}: {{ pay_link }},
// {pay_link}, {{paylink}}, {{name}}, an unclosed {{pay_link, a stray brace.
const BRACE_RUN = /\{+[^{}\n]{0,40}\}+|\{+[^{}\s]{0,40}|[^{}\s]{0,40}\}+/g;

function strayPlaceholders(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(BRACE_RUN)) {
    if (match[0] !== PAY_LINK_PLACEHOLDER) found.add(match[0]);
  }
  return [...found];
}

const ZONED_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;
const UNZONED_ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;
const ZONED_EXAMPLE = '2026-10-17T09:00-04:00 (New York in summer; -05:00 in winter) or 2026-10-17T13:00Z (UTC)';

/**
 * An ISO 8601 instant that names its zone, as ms since the epoch. Checked by
 * hand rather than by Date.parse, which reads "2026-02-30" as March 2 and a
 * zoneless time as the local zone of whatever machine runs it.
 */
function parseZonedIso(raw: string): { ms: number } | { error: string } {
  const match = ZONED_ISO.exec(raw);
  if (!match) {
    if (UNZONED_ISO.test(raw)) {
      return {
        error: `"${raw}" has no time zone, so it is a different moment on your laptop and on the server. Add one, e.g. ${ZONED_EXAMPLE}.`,
      };
    }
    return { error: `"${clip(raw)}" is not an ISO 8601 time. Write it like ${ZONED_EXAMPLE}.` };
  }
  const [, y, mo, d, h, mi, s = '0', fraction = '0', zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const realDate =
    month >= 1 && month <= 12 && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
  if (!realDate || hour > 23 || minute > 59 || second > 59) {
    return { error: `"${raw}" is not a real date and time.` };
  }
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMins = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMins > 59) return { error: `"${raw}" has an offset no time zone uses.` };
    offsetMinutes = (zone[0] === '-' ? -1 : 1) * (offsetHours * 60 + offsetMins);
  }
  const millis = Math.round(Number(`0.${fraction}`) * 1000);
  return { ms: Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMinutes * 60_000 };
}

function clip(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

// ── Writing the email ───────────────────────────────────────────────────────

/**
 * The body as it goes out. Throws rather than send {{pay_link}} as literal
 * text when there is no link to put there.
 */
export function renderFounderNote(body: string, opts: { payLink: string | null }): string {
  if (!body.includes(PAY_LINK_PLACEHOLDER)) return body;
  const payLink = opts.payLink;
  if (!payLink) throw new Error(`This note uses ${PAY_LINK_PLACEHOLDER} but there is no pay link to put there.`);
  // A function, so a "$&" in the link could never be read as a replacement pattern.
  return body.replaceAll(PAY_LINK_PLACEHOLDER, () => payLink);
}

// ── The signature ───────────────────────────────────────────────────────────

/**
 * Michael's signature, matching the one his Gmail adds to every email he
 * writes, so a note reads like one he sent himself. The photo is the round
 * orange headshot the About page already serves.
 */
export const FOUNDER_SIGNATURE = {
  name: 'Michael',
  title: 'Founder',
  company: 'ZeroGEX',
  tagline: 'Know the levels that matter before price gets there.',
  site: 'zerogex.io',
  siteUrl: 'https://zerogex.io',
  /** Path on the site; the sender puts NEXT_PUBLIC_APP_URL in front. */
  photoPath: '/founder.jpg',
  /** The orange of the photo's background, which his signature's link uses too. */
  accent: '#E58455',
} as const;

/** The signature as plain text, one line each, for the text/plain part. */
export function founderSignatureText(): string {
  const s = FOUNDER_SIGNATURE;
  return [s.name, `${s.title}, ${s.company}`, s.tagline, s.site].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A link as typed in a note, up to the next space. Run on text that is already
// escaped, so its & arrive as &amp;, which is also what an href needs.
const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/g;
// What ends a sentence rather than the link: "…here: https://x.io/pay?i=1."
const URL_TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

function linkify(escaped: string): string {
  return escaped.replace(URL_IN_TEXT, (match) => {
    const trailing = match.match(URL_TRAILING_PUNCTUATION)?.[0] ?? '';
    const url = trailing ? match.slice(0, -trailing.length) : match;
    return `<a href="${url}">${url}</a>${trailing}`;
  });
}

/**
 * The note as HTML: its paragraphs as written, links clickable, and the
 * signature card under the sign-off. Plain Arial on white, like an email typed
 * in Gmail, not a designed template. `text` is the body with {{pay_link}}
 * already filled in, and without the text signature.
 */
export function founderNoteHtml(text: string, opts: { photoUrl: string }): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split('\n').map((line) => linkify(escapeHtml(line))).join('<br>'))
    .map((paragraph) => `<p style="margin: 0 0 14px;">${paragraph}</p>`)
    .join('\n');

  const s = FOUNDER_SIGNATURE;
  // A table, because it is the one layout every mail client keeps side by side.
  // The photo is cropped round with border-radius; a client that ignores it
  // (Outlook on Windows) shows the square photo instead.
  const signature = [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-top: 4px;">',
    '<tr>',
    '<td style="padding: 0 14px 0 0; vertical-align: middle;">',
    `<img src="${escapeHtml(opts.photoUrl)}" width="68" height="68" alt="${escapeHtml(s.name)}" style="display: block; width: 68px; height: 68px; border: 0; border-radius: 50%;">`,
    '</td>',
    '<td style="vertical-align: middle; font-family: Arial, Helvetica, sans-serif;">',
    `<div style="font-size: 16px; font-weight: bold; color: #222222; line-height: 1.35;">${escapeHtml(s.name)}</div>`,
    `<div style="font-size: 14px; color: #222222; line-height: 1.35;">${escapeHtml(s.title)}, <b>${escapeHtml(s.company)}</b></div>`,
    `<div style="font-size: 13px; color: #666666; line-height: 1.35;">${escapeHtml(s.tagline)}</div>`,
    `<div style="font-size: 13px; line-height: 1.35;"><a href="${escapeHtml(s.siteUrl)}" style="color: ${s.accent}; font-weight: bold; text-decoration: none;">${escapeHtml(s.site)}</a></div>`,
    '</td>',
    '</tr>',
    '</table>',
  ].join('\n');

  return (
    '<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #222222;">\n' +
    `${paragraphs}\n${signature}\n</div>`
  );
}

/**
 * The email as it goes out, in both parts: the text with {{pay_link}} filled
 * in and the signature under it, and the same as HTML with the signature card.
 */
export function composeFounderNote(
  body: string,
  opts: { payLink: string | null; photoUrl: string },
): { text: string; html: string } {
  const filled = renderFounderNote(body, { payLink: opts.payLink });
  return {
    text: `${filled}\n${founderSignatureText()}`,
    html: founderNoteHtml(filled, { photoUrl: opts.photoUrl }),
  };
}

// ── Whether it goes out ─────────────────────────────────────────────────────

/** What Stripe says about the note's invoice. */
export type FounderNoteInvoice = {
  found: boolean;
  status: string | null;
  customerId: string | null;
  /** Cents still owed. */
  amountDue: number | null;
};

export type FounderNoteSubscription = {
  status: string | null;
  cancelAtPeriodEnd: boolean;
};

export type FounderNoteDecisionInput = {
  nowMs: number;
  note: Pick<FounderNote, 'sendAfterMs' | 'access'>;
  /** The SKIP entry that matches this note, or null. */
  skipEntry: string | null;
  /** When a note for this invoice was sent before (its latch row), or null. */
  latchedAt: string | null;
  /** The account with the note's email. */
  user: { found: boolean; deleted: boolean; tier: string | null; stripeCustomerId: string | null };
  /** What Stripe says about the invoice, or why it could not be asked. */
  invoice: FounderNoteInvoice | string;
  /** The invoice's subscription, or null when it has none. */
  subscription: FounderNoteSubscription | null;
};

export type FounderNoteDecision =
  | { action: 'send' }
  /**
   * Every check passed, but not yet. untilMs is its send-after time, or null
   * when it waits on something with no time attached: an `access: off` note
   * whose member still holds a paid tier.
   */
  | { action: 'wait'; untilMs: number | null; reason: string }
  | { action: 'skip'; reason: string }
  | { action: 'error'; reason: string };

/**
 * Whether one note goes out now, later, never, or needs a look first.
 *
 * A SKIP is a note that has nothing left to say: sent already, paid since,
 * canceled since. An ERROR is a note that cannot be trusted as written, and
 * the run exits non-zero so it is looked at. The difference matters most at
 * the customer check: an invoice that belongs to someone other than the
 * account the note goes to means the doc pairs a member with another member's
 * invoice, and sending it would hand them that member's pay link.
 *
 * The order is the order of the questions: first whether to look at all, then
 * whether the note is about the right person, then whether what it says is
 * still true, and only then whether it is time.
 *
 * The two access values are mirror images that end differently. An
 * `access: on` note whose member has lost access is a SKIP: access does not
 * come back by itself, so the note will never be true again. An `access: off`
 * note whose member still has access is a WAIT: the hourly grace cutoff takes
 * access away soon, the note is true from then on, and a later run sends it.
 * Send-after is asked first, so a note waiting on both shows its time.
 */
export function decideFounderNote(input: FounderNoteDecisionInput): FounderNoteDecision {
  const { note, user, invoice, subscription } = input;
  const skip = (reason: string): FounderNoteDecision => ({ action: 'skip', reason });
  const error = (reason: string): FounderNoteDecision => ({ action: 'error', reason });

  if (input.skipEntry) return skip('skipped at your request');
  if (input.latchedAt) return skip(`already sent ${easternDate(input.latchedAt)}`);
  if (!user.found) return skip('no account with this email');
  if (user.deleted) return skip('account deleted');

  if (typeof invoice === 'string') return error(`Stripe lookup failed: ${invoice}`);
  if (!invoice.found) return error('invoice not found in Stripe');
  if (!user.stripeCustomerId || !invoice.customerId || invoice.customerId !== user.stripeCustomerId) {
    const account = user.stripeCustomerId
      ? `the account's is ${user.stripeCustomerId}`
      : 'the account has no Stripe customer';
    return error(
      `invoice belongs to a different Stripe customer (the invoice's is ${invoice.customerId ?? 'missing'}; ${account})`,
    );
  }

  switch (invoice.status) {
    case 'open':
      break;
    case 'paid':
      return skip('paid since');
    case 'void':
      return skip('invoice voided');
    case 'uncollectible':
      return skip('invoice written off');
    default:
      return error(`invoice is ${invoice.status ? `"${invoice.status}"` : 'in no status'}, not open`);
  }
  if (typeof invoice.amountDue !== 'number' || !Number.isFinite(invoice.amountDue)) {
    return error('Stripe did not say how much is owed');
  }
  if (invoice.amountDue <= 0) return skip('nothing owed');

  if (subscription?.status === 'canceled') return skip('subscription canceled since');
  if (subscription?.cancelAtPeriodEnd) return skip('member has asked to cancel');

  const tier = user.tier?.trim().toLowerCase() ?? '';
  const hasPaidTier = tier !== '' && tier !== 'public';
  if (note.access === 'on' && !hasPaidTier) return skip('access already ended, and this note says it is on');

  if (note.sendAfterMs !== null && note.sendAfterMs > input.nowMs) {
    return { action: 'wait', untilMs: note.sendAfterMs, reason: 'its send-after time has not come' };
  }
  if (note.access === 'off' && hasPaidTier) {
    return { action: 'wait', untilMs: null, reason: 'access is still on, and this note says it has ended' };
  }
  return { action: 'send' };
}

function easternDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── The latch ───────────────────────────────────────────────────────────────

/** Latch type: one founder note per invoice, ever. Written only after Resend accepts the email. */
export const FOUNDER_NOTE_AUDIT_TYPE = 'founder_note_sent';

export function founderNoteAuditMessage(invoiceId: string, subject: string): string {
  return `Founder note sent for invoice ${invoiceId}: ${subject}`;
}

/** The invoice a latch row is for. Anchored, so an invoice id in a subject is never read as the key. */
export function parseFounderNoteAudit(message: string): string | null {
  return message.match(/^Founder note sent for invoice (in_[A-Za-z0-9]+)/)?.[1] ?? null;
}
