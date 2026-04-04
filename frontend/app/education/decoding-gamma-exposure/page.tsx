import fs from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import Link from 'next/link';

const articlePath = path.join(process.cwd(), 'content/articles/decoding-gamma-exposure.md');

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${match.index}-i`}>{token.slice(1, -1)}</em>);
    }
    last = regex.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split('\n');
  const out: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      out.push(<hr key={`hr-${i}`} className="my-10 border-[var(--color-border)]" />);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      out.push(<h1 key={`h1-${i}`} className="mt-2 mb-6 text-4xl font-extrabold leading-tight text-[var(--color-text-primary)]">{parseInline(trimmed.slice(2))}</h1>);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      out.push(<h2 key={`h2-${i}`} className="mt-10 mb-4 text-2xl font-bold leading-tight text-[var(--color-text-primary)]">{parseInline(trimmed.slice(3))}</h2>);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      out.push(<h3 key={`h3-${i}`} className="mt-8 mb-3 text-xl font-semibold text-[var(--color-text-primary)]">{parseInline(trimmed.slice(4))}</h3>);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        block.push(lines[i].trim().slice(2));
        i += 1;
      }
      out.push(
        <blockquote key={`q-${i}`} className="my-6 border-l-4 border-[var(--color-warning)] bg-[var(--color-warning-soft)] py-3 pl-4 text-lg font-medium text-[var(--text-primary)]">
          {block.map((t, idx) => <p key={idx} className="my-1">{parseInline(t)}</p>)}
        </blockquote>,
      );
      continue;
    }

    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i += 1;
      }
      const rows = tableLines
        .filter((row) => !/^\|[-\s|]+\|$/.test(row))
        .map((row) => row.slice(1, -1).split('|').map((cell) => cell.trim()));
      const [header, ...body] = rows;
      out.push(
        <div key={`tbl-${i}`} className="my-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl border border-[var(--color-border)] text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)]">
                {header.map((cell, idx) => (
                  <th key={idx} className="border border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-primary)]">{parseInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="border border-[var(--color-border)] px-4 py-2 text-[var(--text-secondary)]">{parseInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (trimmed.startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        listItems.push(lines[i].trim().slice(2));
        i += 1;
      }
      out.push(
        <ul key={`ul-${i}`} className="my-4 list-disc space-y-2 pl-6 text-[17px] leading-8 text-[var(--text-secondary)]">
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !['#', '##', '###', '-', '>', '|'].some((prefix) => lines[i].trim().startsWith(prefix)) && lines[i].trim() !== '---') {
      paragraph.push(lines[i].trim());
      i += 1;
    }

    if (paragraph.length) {
      out.push(
        <p key={`p-${i}`} className="my-5 text-[18px] leading-9 text-[var(--text-secondary)]">
          {parseInline(paragraph.join(' '))}
        </p>,
      );
      continue;
    }

    i += 1;
  }

  return out;
}

export default function DecodingGammaExposurePage() {
  const markdown = fs.readFileSync(articlePath, 'utf8');

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/education" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Education Hub
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Education • 15 min read</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>
    </div>
  );
}
