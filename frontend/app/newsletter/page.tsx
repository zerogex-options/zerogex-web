import NewsletterClient from './Client';

export const metadata = {
  title: 'The GEX Morning Card — a daily options dealer-gamma newsletter | ZeroGEX',
  description:
    'Daily dealer-gamma levels for SPX / SPY / QQQ delivered to your inbox before the open. Free daily read; paid weekly Sunday deep-dive.',
  alternates: { canonical: '/newsletter' },
};

// Public landing page for the Beehiiv-hosted newsletter (Move 2).  The free
// tier signup flows through /api/newsletter/subscribe to Beehiiv's
// create-subscription endpoint; the paid weekly tier is handled entirely by
// Beehiiv's hosted paid checkout, so the CTA is a straight <a href> to
// NEXT_PUBLIC_BEEHIIV_PREMIUM_CHECKOUT_URL and we never see a card number
// here.
export default function NewsletterPage() {
  const premiumCheckoutUrl = process.env.NEXT_PUBLIC_BEEHIIV_PREMIUM_CHECKOUT_URL ?? '';
  return <NewsletterClient premiumCheckoutUrl={premiumCheckoutUrl} />;
}
