import ConfirmedClient from './Client';

export const metadata = {
  title: 'You\'re on the list — GEX Morning Card | ZeroGEX',
  description: 'Confirm your subscription to the ZeroGEX daily newsletter.',
  alternates: { canonical: '/newsletter/confirmed' },
  robots: { index: false, follow: true },
};

export default function ConfirmedPage() {
  const premiumCheckoutUrl = process.env.NEXT_PUBLIC_BEEHIIV_PREMIUM_CHECKOUT_URL ?? '';
  return <ConfirmedClient premiumCheckoutUrl={premiumCheckoutUrl} />;
}
