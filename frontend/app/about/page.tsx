import type { Metadata } from 'next';
import { getServerT } from '@/core/localizedContent';
import AboutClient from './Client';
import { dict as metaDict } from './meta.i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/about' },
  };
}

export default function AboutPage() {
  return <AboutClient />;
}
