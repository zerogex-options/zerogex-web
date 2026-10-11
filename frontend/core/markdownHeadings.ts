// Heading ids and the "On this page" list for the markdown renderer
// (components/MarkdownContent.tsx), kept in a pure module so node --test can
// load it: the renderer itself imports next/link and a client component.
//
// WHY. No article, guide or help page had a single in-page anchor, so nothing
// could link to a section: not Google's "jump to" links on a long result, not
// an answer engine citing one passage, not a partner quoting the pillar's
// calculation section. The ids are derived from the heading text, so they are
// stable for as long as the heading is, and they are computed by this one
// function for both the rendered heading and the list that links to it, so the
// two can never disagree.

export type MarkdownHeading = { level: 2 | 3 | 4; text: string; id: string };

/** Heading text without its inline markdown: `code`, **bold**, *em*, [links](...). */
export function plainHeadingText(raw: string): string {
  return raw
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/** "What is a gamma flip?" -> "what-is-a-gamma-flip". */
export function slugifyHeading(raw: string): string {
  return (
    plainHeadingText(raw)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/**
 * Every h2/h3/h4 in document order, with a unique id. Mirrors the renderer's
 * block rules exactly: a heading is a `## `, `### ` or `#### ` line outside a
 * fenced code block. A repeated heading gets `-2`, `-3`... in the order it
 * appears.
 */
export function extractHeadings(markdown: string): MarkdownHeading[] {
  const out: MarkdownHeading[] = [];
  const seen = new Map<string, number>();
  let fence: string | null = null;
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (fence) {
      if (trimmed.startsWith(fence)) fence = null;
      continue;
    }
    if (trimmed.startsWith('```')) {
      fence = '```';
      continue;
    }
    const m = /^(#{2,4}) (.+)$/.exec(trimmed);
    if (!m) continue;
    const level = m[1].length as 2 | 3 | 4;
    const base = slugifyHeading(m[2]);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    out.push({ level, text: plainHeadingText(m[2]), id: count === 1 ? base : `${base}-${count}` });
  }
  return out;
}

/** Below these, a contents list is clutter rather than navigation. */
export const TOC_MIN_H2 = 6;
export const TOC_MIN_WORDS = 2000;

export function wordCount(markdown: string): number {
  return markdown.split(/\s+/).filter(Boolean).length;
}

/** Whether a document is long enough, and sectioned enough, to get a contents list. */
export function wantsTableOfContents(markdown: string, headings = extractHeadings(markdown)): boolean {
  return headings.filter((h) => h.level === 2).length >= TOC_MIN_H2 && wordCount(markdown) >= TOC_MIN_WORDS;
}
