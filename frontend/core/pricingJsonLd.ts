// The /pricing structured data: one SoftwareApplication for the product with
// an Offer per plan on sale, built from the same catalogue the cards render
// from (core/billingPlans.ts) so the price Google reads is the price the page
// shows.
//
// Pure, like billingPlans itself: the site URL and publisher reference come in
// as arguments because core/articleRegistry.ts resolves a '@/' import and
// cannot load under the bare node test runner (tests/pricingJsonLd.test.ts).
import {
  BILLABLE_TIERS,
  CADENCE_MONTHS,
  LIST_PRICE_USD,
  type BillableTier,
  type BillingCadence,
} from './billingPlans.ts';

const TIER_LABEL: Record<BillableTier, string> = { basic: 'Basic', pro: 'Pro' };

export type PricingOffer = {
  '@type': 'Offer';
  '@id': string;
  name: string;
  price: string;
  priceCurrency: 'USD';
  category: 'subscription';
  url: string;
  availability: 'https://schema.org/InStock';
  priceSpecification: {
    '@type': 'UnitPriceSpecification';
    price: string;
    priceCurrency: 'USD';
    billingDuration: { '@type': 'QuantitativeValue'; value: number; unitCode: 'MON' };
  };
};

// One Offer per tier for each cadence on sale. List price, never the promo:
// the promo is a limited-time coupon on the first invoices, and a structured
// price that changes when it ends would read as a price change.
export function pricingOffers(siteUrl: string, cadences: readonly BillingCadence[]): PricingOffer[] {
  return BILLABLE_TIERS.flatMap((tier) =>
    cadences.map((cadence): PricingOffer => {
      const price = String(LIST_PRICE_USD[tier][cadence]);
      return {
        '@type': 'Offer',
        // Anchored on /pricing so the two Pro integration landings can point
        // their own Offer at the same node by @id.
        '@id': `${siteUrl}/pricing#${tier}-${cadence}`,
        name: `ZeroGEX ${TIER_LABEL[tier]} (${cadence})`,
        price,
        priceCurrency: 'USD',
        category: 'subscription',
        url: `${siteUrl}/pricing?plan=${tier}`,
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price,
          priceCurrency: 'USD',
          billingDuration: { '@type': 'QuantitativeValue', value: CADENCE_MONTHS[cadence], unitCode: 'MON' },
        },
      };
    }),
  );
}

export function pricingJsonLd(opts: {
  siteUrl: string;
  publisher: { readonly '@id': string };
  cadences: readonly BillingCadence[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${opts.siteUrl}/#app`,
    name: 'ZeroGEX',
    url: opts.siteUrl,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    publisher: opts.publisher,
    offers: pricingOffers(opts.siteUrl, opts.cadences),
  };
}
