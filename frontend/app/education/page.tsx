import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';

export default function EducationPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
          <BookOpen size={14} />
          Education
        </div>
        <h1 className="mb-3 text-3xl font-bold text-white">ZeroGEX Learning Hub</h1>
        <p className="max-w-2xl text-sm leading-7 text-[#b9b3b7]">
          Practical market-structure education for options traders. Start with our first guide on
          Gamma Exposure (GEX), then revisit this section as more ZeroGEX educational articles are added.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Article 01</div>
        <h2 className="mb-3 text-xl font-semibold text-white">
          ZeroGEX™ Guide: Decoding Gamma Exposure — The Hidden Force Driving Market Behavior
        </h2>
        <p className="mb-5 text-sm leading-7 text-[#b9b3b7]">
          Learn how dealer hedging flows can stabilize or destabilize price action, why the gamma flip matters,
          and how to adapt strategy selection across volatility regimes.
        </p>
        <Link
          href="/education/decoding-gamma-exposure"
          className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/20"
        >
          Read article
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
