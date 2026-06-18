// Minimal RSS 2.0 + Atom 1.0 reader.
//
// Designed to handle the well-formed feeds we pull from in /api/news without
// pulling in an XML-parser dependency. Strips CDATA wrappers and HTML tags
// out of titles/descriptions, and tries common date fields in both formats
// before giving up on the timestamp.

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDateMs: number; // epoch ms, NaN if missing/unparseable
  guid: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, key: string) => {
    if (key in NAMED_ENTITIES) return NAMED_ENTITIES[key];
    if (key.startsWith("#")) {
      const isHex = key[1] === "x" || key[1] === "X";
      const code = isHex ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      if (Number.isFinite(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
    }
    return match;
  });
}

function stripCdata(input: string): string {
  const trimmed = input.trim();
  const m = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(trimmed);
  return m ? m[1] : trimmed;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function clean(input: string | null | undefined): string {
  if (!input) return "";
  return decodeHtmlEntities(stripHtml(stripCdata(input)));
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(block);
  return m ? m[1] : null;
}

// Atom <link href="..."/> form. Prefers a rel="alternate" link if multiple
// are present; otherwise falls back to the first link element with an href.
function extractAtomLink(block: string): string | null {
  const re = /<link\b([^>]*)\/?>(?:[\s\S]*?<\/link>)?/gi;
  let candidate: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    const attrs = match[1];
    const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    if (!href) continue;
    const url = href[2] ?? href[3] ?? "";
    if (!url) continue;
    const rel = /\brel\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const relValue = rel ? rel[2] ?? rel[3] ?? "" : "alternate";
    if (!rel || relValue === "alternate") return url;
    if (!candidate) candidate = url;
  }
  return candidate;
}

export function parseRss(xml: string): RssItem[] {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blockRe = isAtom
    ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi
    : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;

  const items: RssItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(xml)) !== null) {
    const block = match[1];
    const title = clean(extractTag(block, "title"));
    if (!title) continue;

    const link = isAtom
      ? extractAtomLink(block) ?? ""
      : clean(extractTag(block, "link"));

    const description = clean(
      extractTag(block, "description") ??
        extractTag(block, "summary") ??
        extractTag(block, "content"),
    );

    const dateRaw = (
      extractTag(block, "pubDate") ??
      extractTag(block, "published") ??
      extractTag(block, "updated") ??
      extractTag(block, "dc:date") ??
      ""
    ).trim();
    const stripped = stripCdata(dateRaw);
    const pubDateMs = stripped ? new Date(stripped).getTime() : NaN;

    const guidRaw = extractTag(block, "guid") ?? extractTag(block, "id");
    const guid = clean(guidRaw) || link || title;

    items.push({ title, link, description, pubDateMs, guid });
  }

  return items;
}
