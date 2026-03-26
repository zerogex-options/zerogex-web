import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

const articlePath = path.join(process.cwd(), 'content/articles/decoding-gamma-exposure.md');

export default function DecodingGammaExposurePage() {
  const markdown = fs.readFileSync(articlePath, 'utf8');

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/education" className="mb-6 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200">
        ← Back to Education
      </Link>
      <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <pre className="whitespace-pre-wrap font-sans text-[15px] leading-8 text-[#ddd7dc]">{markdown}</pre>
      </article>
    </div>
  );
}
