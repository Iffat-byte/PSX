import type { JournalTrade } from "./types";

export const MIN_SAMPLE_FOR_EXPECTANCY = 20;
export const MIN_SAMPLE_FOR_RATIOS = 10;

export function isClosed(t: JournalTrade): t is JournalTrade & { exitDate: string; exitPrice: number } {
  return t.exitDate !== undefined && t.exitPrice !== undefined && t.exitPrice !== null;
}

export function tradePnl(t: JournalTrade): number | null {
  if (!isClosed(t)) return null;
  const dir = t.side === "SHORT" ? -1 : 1;
  return (t.exitPrice - t.entryPrice) * t.quantity * dir - t.fees;
}

export function tradeReturnPct(t: JournalTrade): number | null {
  const p = tradePnl(t);
  const cost = t.entryPrice * t.quantity;
  return p === null || cost <= 0 ? null : p / cost;
}

/** Initial risk in PKR from stop-loss distance; null if no stop was recorded. */
export function initialRisk(t: JournalTrade): number | null {
  if (t.stopLoss === undefined || t.stopLoss === null) return null;
  const r = Math.abs(t.entryPrice - t.stopLoss) * t.quantity;
  return r > 0 ? r : null;
}

export function rMultiple(t: JournalTrade): number | null {
  const p = tradePnl(t);
  const r = initialRisk(t);
  return p === null || r === null ? null : p / r;
}

export function plannedRewardRisk(t: JournalTrade): number | null {
  if (t.stopLoss == null || t.target == null) return null;
  const risk = Math.abs(t.entryPrice - t.stopLoss);
  return risk > 0 ? Math.abs(t.target - t.entryPrice) / risk : null;
}

export function holdingDays(t: JournalTrade): number | null {
  if (!isClosed(t)) return null;
  return Math.max(0, Math.round((Date.parse(t.exitDate) - Date.parse(t.entryDate)) / 86_400_000));
}

export function journalStats(trades: JournalTrade[]) {
  const closed = trades.filter(isClosed).sort((a, b) => (a.exitDate < b.exitDate ? -1 : a.exitDate > b.exitDate ? 1 : a.createdAt - b.createdAt));
  const pnls = closed.map((t) => tradePnl(t)!);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const net = grossWin - grossLoss;
  const n = closed.length;

  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  const curve = closed.map((t, i) => {
    equity += pnls[i];
    peak = Math.max(peak, equity);
    const dd = equity - peak;
    maxDD = Math.min(maxDD, dd);
    return { date: t.exitDate, symbol: t.symbol, pnl: pnls[i], equity, drawdown: dd };
  });

  const monthly = new Map<string, { month: string; pnl: number; trades: number; wins: number }>();
  closed.forEach((t, i) => {
    const m = t.exitDate.slice(0, 7);
    const row = monthly.get(m) ?? { month: m, pnl: 0, trades: 0, wins: 0 };
    row.pnl += pnls[i];
    row.trades += 1;
    if (pnls[i] > 0) row.wins += 1;
    monthly.set(m, row);
  });

  const rs = closed.map(rMultiple).filter((x): x is number => x !== null);
  const holds = closed.map(holdingDays).filter((x): x is number => x !== null);

  return {
    total: trades.length,
    open: trades.length - n,
    closed: n,
    wins: wins.length,
    losses: losses.length,
    breakeven: n - wins.length - losses.length,
    winRate: n > 0 ? wins.length / n : null,
    grossWin,
    grossLoss,
    net,
    avgWin: wins.length ? grossWin / wins.length : null,
    avgLoss: losses.length ? grossLoss / losses.length : null,
    largestWin: wins.length ? Math.max(...wins) : null,
    largestLoss: losses.length ? Math.min(...losses) : null,
    /** null when there are no losing trades (undefined ratio) */
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    expectancy: n > 0 ? net / n : null,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    rSample: rs.length,
    avgHoldDays: holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : null,
    maxDrawdown: maxDD,
    curve,
    monthly: [...monthly.values()].sort((a, b) => (a.month < b.month ? -1 : 1)),
    ratiosReliable: n >= MIN_SAMPLE_FOR_RATIOS,
    expectancyReliable: n >= MIN_SAMPLE_FOR_EXPECTANCY,
  };
}
