import type { ReactNode } from 'react';
import Link from 'next/link';

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${match.index}-b`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const isInternal = href.startsWith('/');
        const linkClass = 'font-medium text-[var(--color-warning)] underline-offset-2 hover:underline';
        if (isInternal) {
          nodes.push(<Link key={`${match.index}-a`} href={href} className={linkClass}>{label}</Link>);
        } else {
          nodes.push(
            <a key={`${match.index}-a`} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {label}
            </a>,
          );
        }
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(<em key={`${match.index}-i`}>{token.slice(1, -1)}</em>);
    }
    last = regex.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(markdown: string): ReactNode[] {
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

    const blockImage = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (blockImage) {
      const [, alt, src] = blockImage;
      out.push(
        <figure key={`img-${i}`} className="my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="w-full rounded-2xl border border-[var(--color-border)]"
          />
          {alt && (
            <figcaption className="mt-3 text-center text-sm italic text-[var(--text-muted)]">
              {alt}
            </figcaption>
          )}
        </figure>,
      );
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
      const parsed = tableLines
        .filter((row) => !/^\|[-\s|]+\|$/.test(row))
        .map((row) => {
          const isAccent = row.startsWith('|!');
          const stripped = isAccent ? '|' + row.slice(2) : row;
          const cells = stripped
            .slice(1, -1)
            .split(/(?<!\\)\|/)
            .map((cell) => cell.trim().replace(/\\\|/g, '|'));
          return { cells, isAccent };
        });
      const [header, ...body] = parsed;
      out.push(
        <div key={`tbl-${i}`} className="my-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-xl border border-[var(--color-border)] text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-subtle)]">
                {header.cells.map((cell, idx) => (
                  <th key={idx} className="border border-[var(--color-border)] px-4 py-2 text-left font-semibold text-[var(--color-text-primary)]">{parseInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={
                    row.isAccent
                      ? 'bg-[var(--color-warning-soft)] font-medium'
                      : undefined
                  }
                >
                  {row.cells.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className={
                        row.isAccent
                          ? 'border border-[var(--color-warning)] px-4 py-2 text-[var(--color-text-primary)]'
                          : 'border border-[var(--color-border)] px-4 py-2 text-[var(--text-secondary)]'
                      }
                    >
                      {parseInline(cell)}
                    </td>
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

    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      out.push(
        <ol key={`ol-${i}`} className="my-4 list-decimal space-y-2 pl-6 text-[17px] leading-8 text-[var(--text-secondary)]">
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !['#', '##', '###', '-', '>', '|'].some((prefix) => lines[i].trim().startsWith(prefix)) &&
      !/^\d+\.\s/.test(lines[i].trim()) &&
      lines[i].trim() !== '---'
    ) {
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
