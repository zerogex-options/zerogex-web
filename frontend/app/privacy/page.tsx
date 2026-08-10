import PrivacyClient from './Client';

import type { Metadata } from 'next';
import { alternatesForPath } from '@/core/localizedMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Privacy Policy — ZeroGEX',
    description:
      'ZeroGEX Privacy Policy. What we collect, how we use it, and the controls available to users of zerogex.io and related services.',
    alternates: await alternatesForPath('/privacy'),
  };
}

export default function PrivacyPage() {
  return <PrivacyClient />;
}
