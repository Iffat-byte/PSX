import { safeDiv } from "./money";

/* ---------------------------------------------------------------- A: Average cost */

export interface AverageCostInput {
  existingQty: number;
  existingAvg: number;
  newPrice: number;
  investAmount: number;
  /** One-way fee rate as % of trade value, applied to the new purchase and to the eventual sale */
  feePct: number;
}

export function averageCost(i: AverageCostInput) {
  const feeRate = Math.max(0, i.feePct) / 100;
  const unitCost = i.newPrice * (1 + feeRate);
  const addQty = i.newPrice > 0 && i.investAmount > 0 ? Math.floor(i.investAmount / unitCost) : 0;
  const addCost = addQty * unitCost;
  const existingCost = Math.max(0, i.existingQty) * Math.max(0, i.existingAvg);
  const totalQty = Math.max(0, i.existingQty) + addQty;
  const totalCost = existingCost + addCost;
  const newAvg = totalQty > 0 ? totalCost / totalQty : 0;
  // Price at which selling everything (after sell-side fees) returns total cost.
  const breakEven = totalQty > 0 ? totalCost / (totalQty * (1 - feeRate)) : 0;
  const unspent = Math.max(0, i.investAmount - addCost);
  const avgChangePct = i.existingAvg > 0 && i.existingQty > 0 ? (newAvg - i.existingAvg) / i.existingAvg : null;
  const pnlAt = (price: number) => totalQty * price * (1 - feeRate) - totalCost;
  return { addQty, addCost, totalQty, totalCost, newAvg, breakEven, unspent, avgChangePct, pnlAt };
}

/* ---------------------------------------------------------------- C: Position sizing */

export interface PositionSizeInput {
  capital: number;
  riskPct: number;
  entry: number;
  stop: number;
  feePct: number;
}

export function positionSize(i: PositionSizeInput) {
  const errors: string[] = [];
  if (i.capital <= 0) errors.push("Trading capital must be greater than zero.");
  if (i.entry <= 0) errors.push("Entry price must be greater than zero.");
  if (i.stop <= 0) errors.push("Stop-loss must be greater than zero.");
  if (i.stop >= i.entry) errors.push("For a long position the stop-loss must be below the entry price.");
  if (i.riskPct <= 0 || i.riskPct > 100) errors.push("Risk per trade must be between 0 and 100%.");
  const feeRate = Math.max(0, i.feePct) / 100;
  const riskBudget = (i.capital * i.riskPct) / 100;
  // Loss per share includes fees on entry and exit.
  const perShareRisk = i.entry - i.stop + i.entry * feeRate + i.stop * feeRate;
  if (errors.length) return { valid: false as const, errors, riskBudget };
  const byRisk = Math.floor(riskBudget / perShareRisk);
  const byCapital = Math.floor(i.capital / (i.entry * (1 + feeRate)));
  const quantity = Math.max(0, Math.min(byRisk, byCapital));
  const positionValue = quantity * i.entry;
  return {
    valid: true as const,
    errors,
    riskBudget,
    perShareRisk,
    quantity,
    cappedByCapital: byCapital < byRisk,
    positionValue,
    pctOfCapital: positionValue / i.capital,
    potentialLoss: quantity * perShareRisk,
    stopDistancePct: (i.entry - i.stop) / i.entry,
    rTarget: (r: number) => i.entry + r * (i.entry - i.stop),
  };
}

/* ---------------------------------------------------------------- D: Profit targets */

export function profitTargets(qty: number, entry: number, feePct: number, targets: number[]) {
  const f = Math.max(0, feePct) / 100;
  const cost = qty * entry * (1 + f);
  return targets.map((t) => {
    const proceeds = qty * t * (1 - f);
    const pnl = proceeds - cost;
    return { target: t, movePct: safeDiv(t - entry, entry) ?? 0, proceeds, pnl, returnPct: safeDiv(pnl, cost) ?? 0 };
  });
}

/* ---------------------------------------------------------------- E: Rebalancing & concentration */

/** Herfindahl–Hirschman index on weights (0..1). 1/HHI = effective number of positions. */
export function concentration(weights: number[]) {
  const total = weights.reduce((a, b) => a + b, 0);
  const w = total > 0 ? weights.map((x) => x / total) : [];
  const hhi = w.reduce((a, x) => a + x * x, 0);
  const sorted = [...w].sort((a, b) => b - a);
  return {
    hhi,
    effectiveN: hhi > 0 ? 1 / hhi : 0,
    top1: sorted[0] ?? 0,
    top3: sorted.slice(0, 3).reduce((a, b) => a + b, 0),
  };
}

/**
 * Illustrative portfolio volatility under a single constant pairwise
 * correlation assumption: σp² = Σ wᵢ²σᵢ² + ρ Σᵢ≠ⱼ wᵢwⱼσᵢσⱼ.
 */
export function portfolioVolatility(weights: number[], vols: number[], rho: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const w = weights.map((x) => x / total);
  let v = 0;
  for (let i = 0; i < w.length; i++) {
    for (let j = 0; j < w.length; j++) {
      v += w[i] * w[j] * vols[i] * vols[j] * (i === j ? 1 : rho);
    }
  }
  return Math.sqrt(Math.max(0, v));
}

/** Trades needed to move from current values to target weights at given prices. */
export function rebalanceTrades(
  rows: { symbol: string; value: number; price: number; targetWeight: number }[],
  totalValue?: number,
) {
  const tv = totalValue ?? rows.reduce((a, r) => a + r.value, 0);
  return rows.map((r) => {
    const targetValue = tv * r.targetWeight;
    const deltaValue = targetValue - r.value;
    const shares = r.price > 0 ? Math.trunc(deltaValue / r.price) : 0;
    return { symbol: r.symbol, targetValue, deltaValue, shares };
  });
}

/* ---------------------------------------------------------------- F: Dividend income */

export function dividendIncome(qty: number, dps: number, taxPct: number, zakatPct = 0) {
  const gross = Math.max(0, qty) * Math.max(0, dps);
  const tax = (gross * Math.max(0, taxPct)) / 100;
  const zakat = (gross * Math.max(0, zakatPct)) / 100;
  return { gross, tax, zakat, net: gross - tax - zakat };
}

/* ---------------------------------------------------------------- G: Compounding */

export interface CompoundInput {
  initial: number;
  monthly: number;
  annualReturnPct: number;
  years: number;
  /** Yearly increase in the monthly contribution, % */
  stepUpPct: number;
  /** Annual inflation for real-value display, % */
  inflationPct: number;
}

export function compound(i: CompoundInput) {
  const r = Math.pow(1 + i.annualReturnPct / 100, 1 / 12) - 1;
  const infl = i.inflationPct / 100;
  let balance = Math.max(0, i.initial);
  let contributed = balance;
  let monthly = Math.max(0, i.monthly);
  const rows: { year: number; balance: number; contributed: number; growth: number; real: number }[] = [
    { year: 0, balance, contributed, growth: 0, real: balance },
  ];
  const years = Math.max(0, Math.min(60, Math.round(i.years)));
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + r) + monthly; // contribution at month end
      contributed += monthly;
    }
    rows.push({ year: y, balance, contributed, growth: balance - contributed, real: balance / Math.pow(1 + infl, y) });
    monthly *= 1 + i.stepUpPct / 100;
  }
  return rows;
}

/* ---------------------------------------------------------------- B: What-if */

export function whatIf(qty: number, avgCost: number, currentPrice: number, movePct: number, addQty: number, addPrice: number) {
  const price = currentPrice * (1 + movePct / 100);
  const totalQty = qty + addQty;
  const totalCost = qty * avgCost + addQty * addPrice;
  const value = totalQty * price;
  const pnl = value - totalCost;
  return {
    price,
    totalQty,
    totalCost,
    avg: totalQty > 0 ? totalCost / totalQty : 0,
    value,
    pnl,
    pnlPct: safeDiv(pnl, totalCost) ?? 0,
  };
}
