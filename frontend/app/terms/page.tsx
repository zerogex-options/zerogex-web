import TermsClient from './Client';

export const metadata = {
  title: 'Terms of Service\u00a0- ZeroGEX',
  description:
    'ZeroGEX Terms of Service. Acceptable use, billing, disclaimers, and the legal terms governing access to zerogex.io and related services.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <TermsClient />;
}
