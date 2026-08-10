import RealTimeGexLandingClient from './Client';
import { articleMetadata } from '@/core/articleRegistry';

// English-only body (no per-locale translation yet) — keep it English
// self-canonical with no hreflang so it doesn't advertise localized URLs that
// would serve duplicate English content. Revisit once the landing copy is translated.
export const metadata = articleMetadata('real-time-gex-0dte', undefined, { hreflang: false });

export default function RealTimeGex0DTEPage() {
  return <RealTimeGexLandingClient />;
}
