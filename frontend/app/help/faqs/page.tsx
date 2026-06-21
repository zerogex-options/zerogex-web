import FAQsClient from './Client';

export const metadata = {
  title: 'ZeroGEX FAQs: Data, Signals, Billing &amp; Account',
  description:
    'Plain-English answers to the questions ZeroGEX traders ask most often — supported symbols, refresh cadence, signal scores, billing, and account topics.',
  alternates: { canonical: '/help/faqs' },
};

export default function FAQsPage() {
  return <FAQsClient />;
}
