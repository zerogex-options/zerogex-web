import totalsJson from '@/content/giving/totals.json';

export interface GivingDonation {
  amountUsd: number;
  donatedAtIso: string;
  quarter: string;
  receiptUrl?: string;
}

export interface GivingTotals {
  totalDonatedUsd: number;
  donationsCount: number;
  lastDonation: GivingDonation | null;
  nextDonationAtIso: string | null;
  pledgePct: number;
  partner: string;
  history: GivingDonation[];
}

export function getGivingTotals(): GivingTotals {
  return totalsJson as GivingTotals;
}
