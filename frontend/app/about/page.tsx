import AboutClient from './Client';

import type { Metadata } from 'next';
import { alternatesForPath } from '@/core/localizedMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About ZeroGEX: The Open Options Analytics Platform',
    description:
      'About ZeroGEX — what we build, how the platform works, and why an open, real-time gamma-exposure and options-flow stack matters for retail and pro traders.',
    alternates: await alternatesForPath('/about'),
  };
}

export default function AboutPage() {
  return <AboutClient />;
}
