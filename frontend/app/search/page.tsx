import { Suspense } from 'react';
import SearchClient from './SearchClient';

// Search results are intentionally noindex,follow — a results page is thin,
// query-parameterized content Google shouldn't index, but links out should
// still be followed. The page stays crawlable (not robots-disallowed) so the
// directive is visible, consistent with /login and /register.
export const metadata = {
  title: 'Search — ZeroGEX',
  description: 'Search ZeroGEX options gamma education, live SPX / SPY / QQQ gamma levels, and tools.',
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      {/* useSearchParams requires a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
