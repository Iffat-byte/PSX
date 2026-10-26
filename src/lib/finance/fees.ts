/**
 * User-configurable fee model. PSX brokerage and statutory charges vary by
 * broker and change over time, so PSX Pilot ships with every rate at zero and
 * asks the user to enter their own broker's schedule.
 */
export interface FeeProfile {
  /** Brokerage commission as % of trade value */
  commissionPct: number;
  /** Minimum commission per share, PKR (applied when higher than % commission) */
  minPerShare: number;
  /** Sales tax applied on commission, % */
  taxOnCommissionPct: number;
  /** Other charges (CDC, exchange, regulatory) as % of trade value */
  otherPct: number;
  /** Flat charge per transaction, PKR */
  flatPerTrade: number;
}

export const ZERO_FEES: FeeProfile = {
  commissionPct: 0,
  minPerShare: 0,
  taxOnCommissionPct: 0,
  otherPct: 0,
  flatPerTrade: 0,
};

export function isFeeProfileConfigured(p: FeeProfile): boolean {
  return Object.values(p).some((v) => v > 0);
}

export function estimateFees(p: FeeProfile, quantity: number, price: number): number {
  if (quantity <= 0 || price <= 0) return 0;
  const value = quantity * price;
  const commission = Math.max((value * p.commissionPct) / 100, quantity * p.minPerShare);
  const tax = (commission * p.taxOnCommissionPct) / 100;
  const other = (value * p.otherPct) / 100;
  return Math.round((commission + tax + other + p.flatPerTrade) * 100) / 100;
}

/** Effective one-way cost as a fraction of trade value (approximate, for calculators). */
export function effectiveFeeRate(p: FeeProfile, quantity: number, price: number): number {
  const v = quantity * price;
  return v > 0 ? estimateFees(p, quantity, price) / v : 0;
}
