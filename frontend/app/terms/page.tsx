import TermsClient from './Client';

import type { Metadata } from 'next';
import { alternatesForPath } from '@/core/localizedMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Terms of Service — ZeroGEX',
    description:
      'ZeroGEX Terms of Service. Acceptable use, billing, disclaimers, and the legal terms governing access to zerogex.io and related services.',
    alternates: await alternatesForPath('/terms'),
  };
}

export default function TermsPage() {
  return <TermsClient />;
}
