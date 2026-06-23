import type { Metadata } from 'next';

// /login (and every /login?next=... variation) must not appear in search:
// GSC was filing the next-parameter variants under "Duplicate without
// user-selected canonical" and surfacing /login itself for branded queries.
// noindex,follow is the cleanest fix — Google drops the URL from the index
// while still following outbound links (e.g. to /register or the homepage).
// This only works if robots.txt also lets Googlebot crawl /login; the entry
// has been removed from app/robots.ts so the meta tag is actually visible.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
