import PrivacyClient from './Client';

export const metadata = {
  title: 'Privacy Policy — ZeroGEX',
  description:
    'ZeroGEX Privacy Policy. What we collect, how we use it, and the controls available to users of zerogex.io and related services.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
