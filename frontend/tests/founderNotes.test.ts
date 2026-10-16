import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOUNDER_NOTE_AUDIT_TYPE,
  FOUNDER_SIGNATURE,
  chooseFirstName,
  composeFounderNote,
  decideFounderNote,
  founderSignatureText,
  founderNoteAuditMessage,
  parseFounderNoteAudit,
  parseFounderNotes,
  renderFounderNote,
  type FounderNoteDecisionInput,
} from '../core/founderNotes.ts';

// Founder notes are personal emails about money a member owes, sent from the
// doc they were drafted in. The parser decides what text reaches a member, and
// the decision decides whether it reaches them at all, so both refuse anything
// they cannot read with certainty.

const ADRIANO_BODY = [
  'Hi {{first_name}},',
  '',
  "Your account is still fully on. When you're ready, you can pay with any card here: {{pay_link}}",
  '',
  '',
  'Best,',
].join('\n');

const DOC_LINES = [
  '# Founder notes',
  '',
  'Run this first:',
  '',
  '```',
  'make cancel-subscription EMAIL=tradingteorema@gmail.com VOID_INVOICE=1 DRY_RUN=1',
  '```',
  '',
  '~~~',
  'to: not-a-note@example.com',
  '~~~',
  '',
  '```note',
  'To: Adriano.Kor@Gmail.com',
  'invoice: in_1UNJP24AOiqteMYYsyAUXGuB',
  "Subject: Your ZeroGEX payment didn't go through",
  'send-after: 2026-10-08T09:00-04:00',
  'ACCESS: on',
  'Name: Adriano',
  '',
  '',
  'Hi {{first_name}},   ',
  '',
  "Your account is still fully on. When you're ready, you can pay with any card here: {{pay_link}}",
  '',
  '',
  'Best,',
  '',
  '```',
  '',
  'Some prose between the notes.',
  '',
  '```note',
  'to: jacksonbroschard@gmail.com',
  'invoice: in_1UNk6D4AOiqteMYYkUipIbIz',
  'subject: A quick note about your ZeroGEX payment',
  '',
  'Hi Jackson,',
  '',
  'Pay here: {{pay_link}}',
  '```',
];

test('a doc with two notes and unrelated fenced blocks reads as exactly the two notes', () => {
  const { notes, errors } = parseFounderNotes(DOC_LINES.join('\n'));
  assert.deepEqual(errors, []);
  assert.equal(notes.length, 2);

  const firstLine = DOC_LINES.indexOf('```note') + 1;
  const secondLine = DOC_LINES.indexOf('```note', firstLine) + 1;
  assert.deepEqual(notes[0], {
    line: firstLine,
    to: 'adriano.kor@gmail.com',
    invoiceId: 'in_1UNJP24AOiqteMYYsyAUXGuB',
    subject: "Your ZeroGEX payment didn't go through",
    sendAfterMs: Date.UTC(2026, 9, 8, 13, 0),
    access: 'on',
    fallbackName: 'Adriano',
    // Trailing spaces gone, blank lines at the ends gone, the double blank line
    // inside kept, and the long paragraph left as one line.
    body: ADRIANO_BODY,
  });
  assert.deepEqual(notes[1], {
    line: secondLine,
    to: 'jacksonbroschard@gmail.com',
    invoiceId: 'in_1UNk6D4AOiqteMYYkUipIbIz',
    subject: 'A quick note about your ZeroGEX payment',
    sendAfterMs: null,
    access: null,
    fallbackName: null,
    body: 'Hi Jackson,\n\nPay here: {{pay_link}}',
  });
});

test('Windows line endings read the same', () => {
  const { notes, errors } = parseFounderNotes(DOC_LINES.join('\r\n'));
  assert.deepEqual(errors, []);
  assert.equal(notes[0].body, ADRIANO_BODY);
});

test('a note shown as an example in another fence, or commented out, is not read', () => {
  const doc = [
    'The format:',
    '',
    '````md',
    '```note',
    'to: example@example.com',
    'invoice: in_EXAMPLE',
    'subject: Example',
    '',
    'Body',
    '```',
    '````',
    '',
    '<!--',
    '```note',
    'to: commented@example.com',
    'invoice: in_COMMENTED',
    'subject: Not this week',
    '',
    'Body',
    '```',
    '-->',
    '<!-- a one-line comment does not hide what follows -->',
    '```note',
    'to: real@example.com',
    'invoice: in_REAL',
    'subject: This one',
    '',
    'Body',
    '```',
  ].join('\n');
  const { notes, errors } = parseFounderNotes(doc);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    notes.map((n) => n.to),
    ['real@example.com'],
  );
});

// One note opening on line 3, so every message can be checked for the line.
function docWith(headers: string[], body: string[] = ['Hi,', '', 'Pay here: {{pay_link}}']): string {
  return ['# Notes', '', '```note', ...headers, '', ...body, '```', ''].join('\n');
}
const TO = 'to: member@example.com';
const INVOICE = 'invoice: in_1AbC';
const SUBJECT = 'subject: Your ZeroGEX payment';

function onlyError(doc: string): string {
  const { notes, errors } = parseFounderNotes(doc);
  assert.equal(errors.length, 1, `expected one error, got: ${JSON.stringify(errors)}`);
  assert.deepEqual(notes, [], 'a note with a mistake is never returned');
  assert.match(errors[0], /^Note at line 3: /, 'the error names the line the note starts on');
  return errors[0];
}

test('the three required headers are all present, or it is an error', () => {
  assert.match(onlyError(docWith([INVOICE, SUBJECT])), /"to" is missing/);
  assert.match(onlyError(docWith([TO, SUBJECT])), /"invoice" is missing/);
  assert.match(onlyError(docWith([TO, INVOICE])), /"subject" is missing/);
});

test('an unknown header, or one given twice, is an error', () => {
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'cc: someone@example.com'])), /unknown header "cc"/);
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'To: member@example.com'])), /"to" is given twice/);
});

test('a header line that is not key: value is an error, e.g. a missing blank line', () => {
  const doc = ['# Notes', '', '```note', TO, INVOICE, SUBJECT, 'Hi there', '', 'Body', '```'].join('\n');
  assert.match(onlyError(doc), /line 7 \("Hi there"\) is not a "key: value" header/);
});

test('to takes exactly one plain email address', () => {
  for (const to of ['a@example.com, b@example.com', 'Adriano <a@example.com>', 'not-an-email', 'a@localhost', '']) {
    assert.match(onlyError(docWith([`to: ${to}`, INVOICE, SUBJECT])), /is not one plain email address/, to);
  }
});

test('invoice must be a Stripe invoice id', () => {
  for (const invoice of ['inv_1AbC', 'in_', 'in_1A-bC', 'sub_1AbC']) {
    assert.match(onlyError(docWith([TO, `invoice: ${invoice}`, SUBJECT])), /is not a Stripe invoice id/, invoice);
  }
});

test('subject is non-empty, at most 200 characters, and has no placeholders', () => {
  assert.match(onlyError(docWith([TO, INVOICE, 'subject:'])), /"subject" is empty/);
  assert.match(onlyError(docWith([TO, INVOICE, `subject: ${'x'.repeat(201)}`])), /201 characters/);
  assert.match(onlyError(docWith([TO, INVOICE, 'subject: Hi {{name}}'])), /subject has a "\{" or "\}"/);
  assert.equal(parseFounderNotes(docWith([TO, INVOICE, `subject: ${'x'.repeat(200)}`])).errors.length, 0);
});

test('send-after must name its time zone', () => {
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'send-after: 2026-10-17T09:00'])), /has no time zone/);
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'send-after: 2026-10-17'])), /has no time zone/);
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'send-after: Thursday 9am'])), /not an ISO 8601 time/);
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'send-after: 2026-10-17T09:00+0400'])), /not an ISO 8601 time/);
  // Date.parse would quietly read these as other moments.
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'send-after: 2026-02-30T09:00Z'])), /not a real date/);
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'send-after: 2026-10-17T24:00Z'])), /not a real date/);
});

test('send-after in UTC or with an offset is the same instant', () => {
  const expected = Date.UTC(2026, 9, 17, 13, 0);
  for (const value of ['2026-10-17T13:00Z', '2026-10-17T09:00-04:00', '2026-10-17T09:00:00.000-04:00', '2026-10-17T18:30+05:30']) {
    const { notes, errors } = parseFounderNotes(docWith([TO, INVOICE, SUBJECT, `send-after: ${value}`]));
    assert.deepEqual(errors, [], value);
    assert.equal(notes[0].sendAfterMs, expected, value);
  }
});

test('access says on or off, in any case, and nothing else', () => {
  const accessOf = (header: string | null) =>
    parseFounderNotes(docWith(header === null ? [TO, INVOICE, SUBJECT] : [TO, INVOICE, SUBJECT, header])).notes[0].access;
  assert.equal(accessOf('access: on'), 'on');
  assert.equal(accessOf('Access: On'), 'on');
  assert.equal(accessOf('access: off'), 'off');
  assert.equal(accessOf('ACCESS: OFF'), 'off');
  assert.equal(accessOf(null), null);
  for (const value of ['yes', 'ended', 'on off', '']) {
    assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, `access: ${value}`])), /access: ".*" is not allowed/, value);
  }
  // One field, so a note cannot say both.
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, 'access: on', 'access: off'])), /"access" is given twice/);
});

test('a note with no email in it is an error', () => {
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT], [])), /the email itself is empty/);
  assert.match(onlyError(docWith([TO, INVOICE, SUBJECT], ['', '   ', ''])), /the email itself is empty/);
});

test('any placeholder but {{pay_link}} and {{first_name}} is an error, typos included', () => {
  for (const typo of ['{{ pay_link }}', '{pay_link}', '{{paylink}}', '{{Pay_Link}}', '{{pay_link}', '{{name}}', '{{{pay_link}}}']) {
    const error = onlyError(docWith([TO, INVOICE, SUBJECT], ['Hi,', '', `Pay here: ${typo}`]));
    assert.match(error, /The only placeholders are \{\{first_name\}\} and \{\{pay_link\}\}/, typo);
    assert.ok(error.includes(`"${typo}"`), `${typo} is named in: ${error}`);
  }
  // Correct ones, any number of them, are fine.
  const ok = parseFounderNotes(docWith([TO, INVOICE, SUBJECT], ['Pay: {{pay_link}}', '', 'Again: {{pay_link}}.']));
  assert.deepEqual(ok.errors, []);
});

test('two notes about the same invoice are an error', () => {
  const doc = [docWith([TO, INVOICE, SUBJECT]), '```note', 'to: other@example.com', INVOICE, SUBJECT, '', 'Hi', '```'].join('\n');
  const secondLine = doc.split('\n').lastIndexOf('```note') + 1;
  const { errors } = parseFounderNotes(doc);
  assert.deepEqual(errors, [
    `Note at line ${secondLine}: invoice in_1AbC already has the note at line 3. One note per invoice.`,
  ]);
});

test('a note that is never closed, or runs into the next one, is an error', () => {
  const unclosed = ['# Notes', '', '```note', TO, INVOICE, SUBJECT, '', 'Hi'].join('\n');
  assert.match(onlyError(unclosed), /is never closed/);

  // Without its closing fence the first note would swallow the second, headers
  // and all, and go out with the other member's text in it.
  const runOn = ['# Notes', '', '```note', TO, INVOICE, SUBJECT, '', 'Hi', '', '```note', 'to: b@example.com', 'invoice: in_2', SUBJECT, '', 'Hi', '```'].join('\n');
  assert.match(onlyError(runOn), /line 10 \("```note"\) starts with ``` but does not close the note/);
});

test('a fence that is almost ```note is an error, not silently skipped', () => {
  for (const opener of ['``` note', '```Note', '  ```note', '```notes', '~~~note', '> ```note']) {
    const doc = ['# Notes', '', opener, TO, INVOICE, SUBJECT, '', 'Hi', '```'].join('\n');
    const { notes, errors } = parseFounderNotes(doc);
    assert.deepEqual(notes, [], opener);
    assert.ok(errors.some((e) => /^Line 3: .*looks like the start of a note/.test(e)), `${opener}: ${JSON.stringify(errors)}`);
  }
});

test('a fence left open at the end of the doc is an error, hidden note or not', () => {
  // Fences come in pairs. An odd one out means a closing line is missing
  // somewhere above, and every fence after it was read back to front.
  assert.deepEqual(parseFounderNotes('# Notes\n\n```\nnever closed\n').errors, [
    'Line 3: the ``` block that starts here is never closed. Fences come in pairs, so a ``` is probably ' +
      'missing earlier in the doc, for example at the end of a note.',
  ]);
  const hiding = ['````md', '```note', TO, INVOICE, SUBJECT, '', 'Hi', '```'].join('\n');
  assert.deepEqual(parseFounderNotes(hiding).errors, [
    'Line 1: the ```` block that starts here is never closed, and the note at line 2 is inside it. Fences ' +
      'come in pairs, so a ```` is probably missing earlier in the doc, for example at the end of a note.',
  ]);
});

test('a ```note inside a plain ``` block is an error, not an example', () => {
  // Markdown ends a ``` block at the first bare ``` line, so a real example
  // needs ```` or ~~~ around it (see the test above that uses one).
  const doc = ['```', 'make diagnose-user EMAIL=a@example.com', '```note', TO, '```'].join('\n');
  const { notes, errors } = parseFounderNotes(doc);
  assert.deepEqual(notes, []);
  assert.deepEqual(errors, [
    'Line 3: this ```note is inside the ``` block that starts at line 1, so it is not read as a note. ' +
      'A ``` is missing above it, probably at the end of a note.',
  ]);
});

test('a note body may not hold a Markdown heading or rule', () => {
  for (const line of ['---', '## 4. gardeniatattoostudio@gmail.com', '### The read', '#', '***', '===']) {
    const error = onlyError(docWith([TO, INVOICE, SUBJECT], ['Hi,', '', line, '', 'Best,']));
    assert.match(error, /line 10 \(".*"\) is a Markdown heading or rule/, line);
  }
  // Ordinary email lines that merely start with those characters are fine,
  // the "-- " signature delimiter among them.
  const ok = parseFounderNotes(docWith([TO, INVOICE, SUBJECT], ['#1 thing first:', '- one', '--', 'Michael', '-- ']));
  assert.deepEqual(ok.errors, []);
});

test('a note that lost its closing ``` cannot carry the next section into the email', () => {
  // The Oct 7 doc's shape: a note, then the next member's section, whose read
  // is private and whose commands sit in a ``` block above their own note.
  const doc = [
    '## 3. adriano.kor@gmail.com',
    '',
    '```note',
    'to: adriano.kor@gmail.com',
    'invoice: in_1UNJP24AOiqteMYYsyAUXGuB',
    SUBJECT,
    '',
    'Hi Adriano,',
    '',
    'Pay here: {{pay_link}}',
    '',
    '---',
    '',
    '## 4. gardeniatattoostudio@gmail.com',
    '',
    '### The read',
    '',
    'This is the same person as tradingteorema@gmail.com.',
    '',
    '```',
    'make cancel-subscription EMAIL=tradingteorema@gmail.com VOID_INVOICE=1 DRY_RUN=1',
    '```',
    '',
    '```note',
    'to: gardeniatattoostudio@gmail.com',
    'invoice: in_1UNYNN4AOiqteMYYo9E26RTl',
    SUBJECT,
    '',
    'Hi,',
    '```',
  ].join('\n');
  const { notes, errors } = parseFounderNotes(doc);
  assert.deepEqual(notes, []);
  assert.ok(errors.some((e) => /^Note at line 3: line 12 \("---"\) is a Markdown heading or rule/.test(e)), JSON.stringify(errors));
  assert.ok(errors.some((e) => /^Line 24: this ```note is inside the ``` block that starts at line 22/.test(e)), JSON.stringify(errors));
});

test('the body goes out with the pay link in every placeholder', () => {
  const link = 'https://zerogex.io/pay?i=in_1AbC&t=tok';
  assert.equal(
    renderFounderNote('Pay: {{pay_link}}\n\nOr here: {{pay_link}}', { payLink: link }),
    `Pay: ${link}\n\nOr here: ${link}`,
  );
  // A replacement pattern in the link is just text.
  assert.equal(renderFounderNote('Pay: {{pay_link}}', { payLink: 'https://x/pay?t=$&' }), 'Pay: https://x/pay?t=$&');
  // No placeholder, no link needed.
  assert.equal(renderFounderNote('Just checking in.', { payLink: null }), 'Just checking in.');
  // Never "{{pay_link}}" as literal text.
  assert.throws(() => renderFounderNote('Pay: {{pay_link}}', { payLink: null }), /no pay link/);
});

test('a note that signs itself is refused, since the signature is added when it is sent', () => {
  for (const last of ['Michael', 'michael', 'Founder, ZeroGEX', 'Founder ZeroGEX', '- Michael', '— Michael']) {
    const error = onlyError(docWith([TO, INVOICE, SUBJECT], ['Hi,', '', 'Pay here: {{pay_link}}', '', 'Best,', last]));
    assert.match(error, /signs the note, but the signature is added when it is sent/, last);
  }
  // Ending at the sign-off is right, and the name elsewhere in the note is fine.
  const ok = parseFounderNotes(
    docWith([TO, INVOICE, SUBJECT], ['Hi Michael,', '', 'Michael here, about your payment: {{pay_link}}', '', 'Best,']),
  );
  assert.deepEqual(ok.errors, []);
});

test('an email goes out in two parts, each with the signature under the sign-off', () => {
  const link = 'https://zerogex.io/pay?i=in_1AbC&t=tok';
  const body = 'Hi Joe,\n\nYou can pay with any card here: {{pay_link}}\n\nIf now isn\'t the right time, just reply.\n\nBest,';
  const { text, html } = composeFounderNote(body, { payLink: link, photoUrl: 'https://zerogex.io/founder.jpg', firstName: null });

  // Text: the note as written, then the signature, one line each.
  assert.equal(text, `${body.replace('{{pay_link}}', link)}\n${founderSignatureText()}`);
  assert.equal(
    founderSignatureText(),
    'Michael\nFounder, ZeroGEX\nKnow the levels that matter before price gets there.\nzerogex.io',
  );

  // HTML: one paragraph per paragraph, the link clickable, its & escaped in
  // both the href and the text, and the signature card after the sign-off.
  assert.match(html, /<p style="margin: 0 0 14px;">Hi Joe,<\/p>/);
  assert.ok(
    html.includes(
      'here: <a href="https://zerogex.io/pay?i=in_1AbC&amp;t=tok">https://zerogex.io/pay?i=in_1AbC&amp;t=tok</a></p>',
    ),
    html,
  );
  assert.ok(html.includes('isn&#39;t the right time'), 'apostrophes are escaped');
  assert.ok(html.indexOf('>Best,</p>') < html.indexOf('<table'), 'the card comes after the sign-off');
  assert.ok(html.includes('<img src="https://zerogex.io/founder.jpg" width="68" height="68" alt="Michael"'));
  assert.ok(html.includes('>Michael</div>'));
  assert.ok(html.includes('Founder, <b>ZeroGEX</b>'));
  assert.ok(html.includes(`>${FOUNDER_SIGNATURE.tagline}</div>`));
  assert.ok(html.includes(`<a href="https://zerogex.io" style="color: ${FOUNDER_SIGNATURE.accent};`));
});

test('the HTML part never lets note text through as markup, and keeps line breaks', () => {
  const { html } = composeFounderNote('Hi,\n\n<b>not bold</b> & "quoted"\nsecond line\n\nBest,', {
    payLink: null,
    photoUrl: 'https://zerogex.io/founder.jpg',
    firstName: null,
  });
  assert.ok(html.includes('&lt;b&gt;not bold&lt;/b&gt; &amp; &quot;quoted&quot;<br>second line'), html);
  assert.ok(!html.includes('<b>not bold</b>'));
});

test('a link at the end of a sentence leaves the period outside it', () => {
  const { html } = composeFounderNote('Start here: https://zerogex.io/pricing. Or reply (https://zerogex.io/help).\n\nBest,', {
    payLink: null,
    photoUrl: 'https://zerogex.io/founder.jpg',
    firstName: null,
  });
  assert.ok(html.includes('<a href="https://zerogex.io/pricing">https://zerogex.io/pricing</a>. Or'), html);
  assert.ok(html.includes('(<a href="https://zerogex.io/help">https://zerogex.io/help</a>).'), html);
});

test('{{first_name}} goes once, in the greeting, after a space', () => {
  const ok = parseFounderNotes(docWith([TO, INVOICE, SUBJECT, 'name: Joe'], ['Hi {{first_name}},', '', 'Pay: {{pay_link}}']));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.notes[0].fallbackName, 'Joe');

  // Anywhere but the first line, or not after a space, it could not read right without a name.
  for (const body of [
    ['Hi,', '', 'Thanks, {{first_name}}.'],
    ['{{first_name}}, a quick note.'],
    ['Hi,{{first_name}},'],
  ]) {
    assert.match(onlyError(docWith([TO, INVOICE, SUBJECT], body)), /outside the greeting/, body.join(' / '));
  }
  assert.match(
    onlyError(docWith([TO, INVOICE, SUBJECT], ['Hi {{first_name}},', '', 'Again {{first_name}}.'])),
    /appears 2 times/,
  );
});

test('a name: line is one first name as it should appear', () => {
  for (const name of ['Joe', 'Jean-Paul', "D'Andre", 'Barış']) {
    assert.deepEqual(parseFounderNotes(docWith([TO, INVOICE, SUBJECT, `name: ${name}`])).errors, [], name);
  }
  for (const name of ['Joe Smith', 'J', 'joe2', '{{first_name}}']) {
    assert.match(onlyError(docWith([TO, INVOICE, SUBJECT, `name: ${name}`])), /is not one first name/, name);
  }
});

test('the first name comes from the first Stripe name that reads as a person', () => {
  const pick = (email: string, ...names: Array<string | null>) =>
    chooseFirstName({ email, candidates: names.map((name, i) => ({ name, source: `source ${i + 1}` })) });

  // Checkout names, cleaned up: case, titles, initials.
  assert.deepEqual(pick('joedietrich86@icloud.com', 'JOE DIETRICH'), { firstName: 'Joe', source: 'source 1', from: 'JOE DIETRICH' });
  assert.equal(pick('a@example.com', 'maria lopez')?.firstName, 'Maria');
  assert.equal(pick('a@example.com', 'JEAN-PAUL MARTIN')?.firstName, 'Jean-Paul');
  assert.equal(pick('a@example.com', 'DeShawn Smith')?.firstName, 'DeShawn');
  assert.equal(pick('a@example.com', 'Mr. Robert Smith')?.firstName, 'Robert');
  assert.equal(pick('barisyelken51@yandex.com', 'BARIŞ YELKEN')?.firstName, 'Barış');

  // Not a person's first name: the next source is tried.
  assert.equal(pick('a@example.com', 'J. Smith', 'Jordan Smith')?.firstName, 'Jordan');
  assert.equal(pick('a@example.com', 'Flamingo Corp LLC', null, 'Ana Lima')?.firstName, 'Ana');
  assert.equal(pick('a@example.com', 'Card 4242', '')?.firstName, undefined);
  assert.equal(pick('a@example.com', null, '   '), null);

  // The family's card, not the member's: the surname is in the address, this first name is not.
  assert.equal(pick('jadenhelfinstine@gmail.com', 'Mark Helfinstine'), null);
  assert.equal(pick('jadenhelfinstine@gmail.com', 'Mark Helfinstine', 'Jaden Helfinstine')?.firstName, 'Jaden');
  // A surname-first card whose given name is in the address is passed over the same way.
  assert.equal(pick('tuananhthmno1@gmail.com', 'NGUYEN TUAN ANH'), null);
  // An address that says nothing about the name leaves the name alone.
  assert.equal(pick('killthelevel@gmail.com', 'Kevin Brooks')?.firstName, 'Kevin');
});

test('the greeting reads "Hi Joe," with a name and "Hi," without one', () => {
  const body = 'Hi {{first_name}},\n\nPay here: {{pay_link}}\n\nBest,';
  const photoUrl = 'https://zerogex.io/founder.jpg';
  const named = composeFounderNote(body, { payLink: 'https://x.io/p', photoUrl, firstName: 'Joe' });
  assert.ok(named.text.startsWith('Hi Joe,\n\nPay here: https://x.io/p'), named.text);
  assert.ok(named.html.includes('<p style="margin: 0 0 14px;">Hi Joe,</p>'));
  const unnamed = composeFounderNote(body, { payLink: 'https://x.io/p', photoUrl, firstName: null });
  assert.ok(unnamed.text.startsWith('Hi,\n\nPay here:'), unnamed.text);
  // A name is text, never markup.
  const odd = composeFounderNote(body, { payLink: 'https://x.io/p', photoUrl, firstName: "D'Andre" });
  assert.ok(odd.html.includes('Hi D&#39;Andre,'));
});

// ── The decision ────────────────────────────────────────────────────────────

const NOW = Date.UTC(2026, 9, 16, 14, 0);

function input(overrides: Partial<FounderNoteDecisionInput> = {}): FounderNoteDecisionInput {
  return {
    nowMs: NOW,
    note: { sendAfterMs: null, access: null },
    skipEntry: null,
    latchedAt: null,
    user: { found: true, deleted: false, tier: 'basic', stripeCustomerId: 'cus_A' },
    invoice: { found: true, status: 'open', customerId: 'cus_A', amountDue: 2900 },
    subscription: { status: 'past_due', cancelAtPeriodEnd: false },
    ...overrides,
  };
}

const NO_USER = { found: false, deleted: false, tier: null, stripeCustomerId: null };

test('an open invoice on the right account, with nothing in the way, is sent', () => {
  assert.deepEqual(decideFounderNote(input()), { action: 'send' });
  // A one-off invoice has no subscription to check.
  assert.deepEqual(decideFounderNote(input({ subscription: null })), { action: 'send' });
});

test('1. SKIP comes first, before anything is looked at', () => {
  assert.deepEqual(decideFounderNote(input({ skipEntry: 'in_1AbC', latchedAt: '2026-10-15T14:00:00.000Z', user: NO_USER })), {
    action: 'skip',
    reason: 'skipped at your request',
  });
});

test('2. a note already sent for the invoice is never sent again', () => {
  // 01:30 UTC on the 16th is the evening of the 15th in New York.
  assert.deepEqual(decideFounderNote(input({ latchedAt: '2026-10-16T01:30:00.000Z', user: NO_USER })), {
    action: 'skip',
    reason: 'already sent Oct 15, 2026',
  });
});

test('3. no account, or a deleted one, is skipped before Stripe is consulted', () => {
  assert.deepEqual(decideFounderNote(input({ user: NO_USER, invoice: 'boom' })), {
    action: 'skip',
    reason: 'no account with this email',
  });
  assert.deepEqual(
    decideFounderNote(input({ user: { found: true, deleted: true, tier: 'basic', stripeCustomerId: 'cus_A' }, invoice: 'boom' })),
    { action: 'skip', reason: 'account deleted' },
  );
});

test('4. a failed Stripe lookup is an error that carries its message', () => {
  const decision = decideFounderNote(input({ invoice: 'connection reset' }));
  assert.deepEqual(decision, { action: 'error', reason: 'Stripe lookup failed: connection reset' });
});

test('5. an invoice Stripe does not have is an error', () => {
  assert.deepEqual(decideFounderNote(input({ invoice: { found: false, status: null, customerId: null, amountDue: null } })), {
    action: 'error',
    reason: 'invoice not found in Stripe',
  });
});

test("6. another customer's invoice is an ERROR, not a skip, whatever its state", () => {
  // The guard against mailing one member another member's pay link. It runs
  // before the invoice's state, so even a paid one is flagged: the doc pairs
  // the wrong invoice with this member either way.
  for (const status of ['open', 'paid', 'void']) {
    const decision = decideFounderNote(input({ invoice: { found: true, status, customerId: 'cus_B', amountDue: 2900 } }));
    assert.equal(decision.action, 'error', status);
    assert.match(decision.action === 'error' ? decision.reason : '', /^invoice belongs to a different Stripe customer/);
    assert.match(decision.action === 'error' ? decision.reason : '', /cus_B.*cus_A/);
  }
  // An account with no Stripe customer at all cannot own the invoice, even
  // when Stripe somehow reports none either.
  for (const customerId of ['cus_A', null]) {
    const decision = decideFounderNote(
      input({
        user: { found: true, deleted: false, tier: 'basic', stripeCustomerId: null },
        invoice: { found: true, status: 'open', customerId, amountDue: 2900 },
      }),
    );
    assert.equal(decision.action, 'error', String(customerId));
    assert.match(decision.action === 'error' ? decision.reason : '', /different Stripe customer.*no Stripe customer/);
  }
});

test('7. a settled or closed invoice has nothing left to say; a strange one is an error', () => {
  const withStatus = (status: string | null, amountDue = 2900) =>
    decideFounderNote(input({ invoice: { found: true, status, customerId: 'cus_A', amountDue } }));
  assert.deepEqual(withStatus('paid', 0), { action: 'skip', reason: 'paid since' });
  assert.deepEqual(withStatus('void'), { action: 'skip', reason: 'invoice voided' });
  assert.deepEqual(withStatus('uncollectible'), { action: 'skip', reason: 'invoice written off' });
  assert.equal(withStatus('draft').action, 'error');
  assert.equal(withStatus(null).action, 'error');
  assert.deepEqual(withStatus('open', 0), { action: 'skip', reason: 'nothing owed' });
});

test('7. a paid invoice wins over a canceled subscription and a pending send-after', () => {
  const decision = decideFounderNote(
    input({
      note: { sendAfterMs: NOW + 86_400_000, access: 'on' },
      user: { found: true, deleted: false, tier: 'public', stripeCustomerId: 'cus_A' },
      invoice: { found: true, status: 'paid', customerId: 'cus_A', amountDue: 0 },
      subscription: { status: 'canceled', cancelAtPeriodEnd: false },
    }),
  );
  assert.deepEqual(decision, { action: 'skip', reason: 'paid since' });
});

test('8. a member who canceled, or asked to, is not chased for the money', () => {
  assert.deepEqual(decideFounderNote(input({ subscription: { status: 'canceled', cancelAtPeriodEnd: false } })), {
    action: 'skip',
    reason: 'subscription canceled since',
  });
  assert.deepEqual(
    decideFounderNote(
      input({
        note: { sendAfterMs: null, access: 'on' },
        user: { found: true, deleted: false, tier: 'public', stripeCustomerId: 'cus_A' },
        subscription: { status: 'past_due', cancelAtPeriodEnd: true },
      }),
    ),
    { action: 'skip', reason: 'member has asked to cancel' },
  );
});

const withTier = (tier: string | null) => ({ found: true, deleted: false, tier, stripeCustomerId: 'cus_A' });

test('9. a note that says access is on is not sent once it is off', () => {
  for (const tier of [null, '', 'public', ' Public ']) {
    assert.deepEqual(
      decideFounderNote(input({ note: { sendAfterMs: NOW + 60_000, access: 'on' }, user: withTier(tier) })),
      { action: 'skip', reason: 'access already ended, and this note says it is on' },
      String(tier),
    );
  }
  // Still on: fine. And a note that says nothing about access does not care.
  assert.deepEqual(decideFounderNote(input({ note: { sendAfterMs: null, access: 'on' } })), { action: 'send' });
  assert.deepEqual(decideFounderNote(input({ user: withTier('public') })), { action: 'send' });
  assert.deepEqual(decideFounderNote(input({ user: withTier('pro') })), { action: 'send' });
});

test('10. a note that is not due yet waits for a later run', () => {
  const later = NOW + 3_600_000;
  assert.deepEqual(decideFounderNote(input({ note: { sendAfterMs: later, access: null } })), {
    action: 'wait',
    untilMs: later,
    reason: 'its send-after time has not come',
  });
  // Due exactly now, or already past: send.
  assert.deepEqual(decideFounderNote(input({ note: { sendAfterMs: NOW, access: null } })), { action: 'send' });
  assert.deepEqual(decideFounderNote(input({ note: { sendAfterMs: NOW - 1, access: null } })), { action: 'send' });
});

test('11. a note that says access has ended waits while the member still has it', () => {
  // Not a skip: the grace cutoff takes access away within the hour, and from
  // then on the note is true, so a later run sends it.
  for (const tier of ['basic', 'pro', 'admin']) {
    assert.deepEqual(
      decideFounderNote(input({ note: { sendAfterMs: null, access: 'off' }, user: withTier(tier) })),
      { action: 'wait', untilMs: null, reason: 'access is still on, and this note says it has ended' },
      tier,
    );
  }
  // Ended: it goes.
  for (const tier of ['public', null, '']) {
    assert.deepEqual(
      decideFounderNote(input({ note: { sendAfterMs: null, access: 'off' }, user: withTier(tier) })),
      { action: 'send' },
      String(tier),
    );
  }
});

test('11. send-after is asked first, so a note waiting on both shows its time', () => {
  const later = NOW + 3_600_000;
  assert.deepEqual(decideFounderNote(input({ note: { sendAfterMs: later, access: 'off' }, user: withTier('basic') })), {
    action: 'wait',
    untilMs: later,
    reason: 'its send-after time has not come',
  });
  // Past its time and still on: now it waits on access, with no time.
  assert.deepEqual(decideFounderNote(input({ note: { sendAfterMs: NOW - 1, access: 'off' }, user: withTier('basic') })), {
    action: 'wait',
    untilMs: null,
    reason: 'access is still on, and this note says it has ended',
  });
  // Everything earlier still wins: a member who paid hears nothing.
  assert.deepEqual(
    decideFounderNote(
      input({
        note: { sendAfterMs: null, access: 'off' },
        user: withTier('basic'),
        invoice: { found: true, status: 'paid', customerId: 'cus_A', amountDue: 0 },
      }),
    ),
    { action: 'skip', reason: 'paid since' },
  );
});

test('the latch round-trips its invoice id, and nothing else reads as one', () => {
  assert.equal(FOUNDER_NOTE_AUDIT_TYPE, 'founder_note_sent');
  const message = founderNoteAuditMessage('in_1AbC', 'About in_9Zz: my mistake');
  assert.equal(message, 'Founder note sent for invoice in_1AbC: About in_9Zz: my mistake');
  assert.equal(parseFounderNoteAudit(message), 'in_1AbC');
  assert.equal(parseFounderNoteAudit('Resent payment-failed email for invoice in_1AbC'), null);
  assert.equal(parseFounderNoteAudit(''), null);
});
