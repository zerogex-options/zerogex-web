// A hand-kept "leave these people alone" list for the batch email scripts:
//   SKIP=vernon@example.com,in_1ABC…   (emails or invoice ids; commas or spaces)
//
// The batch senders pick recipients from rules, and rules can't know that the
// founder already wrote to someone personally. An automated "your payment
// failed" landing after a personal note reads as if nobody read the thread, so
// the operator names them and the scripts pass them by.
//
// It is a filter for the run it is given to, not a stored setting: every run
// that should skip someone needs the same SKIP. The scripts print their
// follow-up commands with the list already filled in so it is not dropped
// between the dry run and the real send.

export type SkipList = {
  /** Every entry as typed (trimmed), for echoing back and for typo warnings. */
  entries: string[];
  emails: Set<string>;
  invoiceIds: Set<string>;
};

export function parseSkipList(raw: string | null | undefined): SkipList {
  const entries = (raw ?? '')
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const emails = new Set<string>();
  const invoiceIds = new Set<string>();
  for (const entry of entries) {
    if (/^in_[A-Za-z0-9]+$/.test(entry)) invoiceIds.add(entry);
    else emails.add(entry.toLowerCase());
  }
  return { entries, emails, invoiceIds };
}

/** The SKIP entry that matches this recipient, or null. Emails match case-insensitively. */
export function skipEntryFor(
  list: SkipList,
  target: { email: string | null | undefined; invoiceId: string },
): string | null {
  if (list.invoiceIds.has(target.invoiceId)) return target.invoiceId;
  const email = target.email?.trim().toLowerCase();
  if (email && list.emails.has(email)) return email;
  return null;
}

/**
 * Entries that look like typos: an email that belongs to no account, or an
 * invoice id this run never saw. A typo in SKIP means the person it was meant
 * for gets emailed, so the scripts print these loudly. An email that belongs to
 * a real member who simply isn't in this run is fine and not reported, so the
 * same list can be handed to both scripts.
 */
export function suspectSkipEntries(
  list: SkipList,
  matched: ReadonlySet<string>,
  isKnownEmail: (email: string) => boolean,
): string[] {
  return list.entries.filter((entry) =>
    list.invoiceIds.has(entry) ? !matched.has(entry) : !matched.has(entry.toLowerCase()) && !isKnownEmail(entry.toLowerCase()),
  );
}

/** The SKIP=… argument to repeat in a printed follow-up command, or '' when there is none. */
export function skipArg(list: SkipList): string {
  return list.entries.length > 0 ? ` SKIP=${list.entries.join(',')}` : '';
}
