import LandingClient from './LandingClient';

import type { Metadata } from 'next';
import { alternatesForPath } from '@/core/localizedMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: await alternatesForPath('/'),
  };
}

export default function HomePage() {
  return <LandingClient />;
}
