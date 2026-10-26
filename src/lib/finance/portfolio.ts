import { isZero, round2, safeDiv } from "./money";
import type {
  Holding,
  LedgerIssue,
  PortfolioSnapshot,
  Quote,
  RealizedEvent,
  Transaction,
} from "./types";

/** Deterministic ordering: by date, then by entry time. */
export function sortTransactions(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}

interface PositionState {
  quantity: number;
  costBasis: number;
  realized: number;
  dividends: number;
}

/**
 * Replays a transaction ledger using the weighted-average cost method.
 *
 * - BUY adds quantity and (price × qty + fees) to cost basis.
 * - SELL removes avgCost × qty from cost basis; realized P/L is
 *   (price × qty − fees) − removed cost. Average cost is unchanged by sales.
 * - BONUS adds shares at zero cost, lowering the average cost.
 * - Selling more than is held is rejected and reported as a ledger issue.
 * - When a position reaches zero shares its cost basis is reset to zero.
 */
export function replayLedger(txs: Transaction[], asOf?: string) {
  const positions = new Map<string, PositionState>();
  const realizedEvents: RealizedEvent[] = [];
  const issues: LedgerIssue[] = [];
  let cash = 0;
  let feesPaid = 0;
  let deposits = 0;
  let withdrawals = 0;
  let grossBuyCost = 0;

  const pos = (symbol: string) => {
    let p = positions.get(symbol);
    if (!p) {
      p = { quantity: 0, costBasis: 0, realized: 0, dividends: 0 };
      positions.set(symbol, p);
    }
    return p;
  };

  for (const tx of sortTransactions(txs)) {
    if (asOf && tx.date > asOf) break;
    switch (tx.type) {
      case "DEPOSIT":
        cash += tx.amount;
        deposits += tx.amount;
        break;
      case "WITHDRAWAL":
        cash -= tx.amount;
        withdrawals += tx.amount;
        break;
      case "FEE":
        cash -= tx.amount;
        feesPaid += tx.amount;
        break;
      case "DIVIDEND": {
        if (!tx.symbol) {
          issues.push({ txId: tx.id, date: tx.date, message: "Dividend without a symbol was ignored." });
          break;
        }
        cash += tx.amount;
        pos(tx.symbol).dividends += tx.amount;
        break;
      }
      case "BONUS": {
        if (!tx.symbol || tx.quantity <= 0) {
          issues.push({ txId: tx.id, date: tx.date, message: "Bonus entry needs a symbol and positive quantity." });
          break;
        }
        pos(tx.symbol).quantity += tx.quantity;
        break;
      }
      case "BUY": {
        if (!tx.symbol || tx.quantity <= 0 || tx.price < 0) {
          issues.push({ txId: tx.id, date: tx.date, message: "Invalid buy (symbol, quantity or price)." });
          break;
        }
        const cost = tx.quantity * tx.price + tx.fees;
        const p = pos(tx.symbol);
        p.quantity += tx.quantity;
        p.costBasis += cost;
        cash -= cost;
        feesPaid += tx.fees;
        grossBuyCost += cost;
        break;
      }
      case "SELL": {
        if (!tx.symbol || tx.quantity <= 0 || tx.price < 0) {
          issues.push({ txId: tx.id, date: tx.date, message: "Invalid sell (symbol, quantity or price)." });
          break;
        }
        const p = pos(tx.symbol);
        if (tx.quantity > p.quantity + 1e-9) {
          issues.push({
            txId: tx.id,
            date: tx.date,
            message: `Sell of ${tx.quantity} ${tx.symbol} exceeds ${p.quantity} shares held on ${tx.date}; ignored.`,
          });
          break;
        }
        const avg = p.quantity > 0 ? p.costBasis / p.quantity : 0;
        const costRemoved = avg * tx.quantity;
        const proceeds = tx.quantity * tx.price - tx.fees;
        const pnl = proceeds - costRemoved;
        p.quantity -= tx.quantity;
        p.costBasis -= costRemoved;
        if (isZero(p.quantity)) {
          p.quantity = 0;
          p.costBasis = 0;
        }
        p.realized += pnl;
        cash += proceeds;
        feesPaid += tx.fees;
        realizedEvents.push({
          date: tx.date,
          symbol: tx.symbol,
          quantity: tx.quantity,
          proceeds: round2(proceeds),
          costRemoved: round2(costRemoved),
          pnl: round2(pnl),
          txId: tx.id,
        });
        break;
      }
    }
  }

  return { positions, realizedEvents, issues, cash, feesPaid, deposits, withdrawals, grossBuyCost };
}

export function computePortfolio(
  txs: Transaction[],
  quotes: Record<string, Pick<Quote, "price" | "prevClose"> | undefined>,
): PortfolioSnapshot {
  const led = replayLedger(txs);
  const open: Holding[] = [];
  const closedSymbols: string[] = [];
  const missingPrices: string[] = [];
  let realized = 0;
  let dividends = 0;

  for (const [symbol, p] of led.positions) {
    realized += p.realized;
    dividends += p.dividends;
    if (p.quantity <= 0) {
      closedSymbols.push(symbol);
      continue;
    }
    const q = quotes[symbol];
    if (!q) missingPrices.push(symbol);
    const price = q?.price ?? null;
    const prevClose = q?.prevClose ?? null;
    // Without a price we value the position at cost so totals stay meaningful.
    const marketValue = price !== null ? p.quantity * price : p.costBasis;
    const unrealized = marketValue - p.costBasis;
    const dayChange = price !== null && prevClose !== null ? (price - prevClose) * p.quantity : 0;
    open.push({
      symbol,
      quantity: p.quantity,
      costBasis: round2(p.costBasis),
      avgCost: p.costBasis / p.quantity,
      price,
      prevClose,
      marketValue: round2(marketValue),
      unrealized: round2(unrealized),
      unrealizedPct: safeDiv(unrealized, p.costBasis) ?? 0,
      dayChange: round2(dayChange),
      dayChangePct: prevClose ? (price! - prevClose) / prevClose : 0,
      realized: round2(p.realized),
      dividends: round2(p.dividends),
      weight: 0,
    });
  }

  const marketValue = open.reduce((a, h) => a + h.marketValue, 0);
  for (const h of open) h.weight = marketValue > 0 ? h.marketValue / marketValue : 0;
  open.sort((a, b) => b.marketValue - a.marketValue);

  const unrealized = open.reduce((a, h) => a + h.unrealized, 0);
  const dayChange = open.reduce((a, h) => a + h.dayChange, 0);
  const prevMarketValue = marketValue - dayChange;
  const netContributions = led.deposits - led.withdrawals;
  // Standalone FEE entries are not part of any position's cost basis.
  const standaloneFees = txs.filter((t) => t.type === "FEE").reduce((a, t) => a + t.amount, 0);
  const totalGain = unrealized + realized + dividends - standaloneFees;
  const base = netContributions > 0 ? netContributions : led.grossBuyCost;

  return {
    holdings: open,
    closedSymbols,
    cash: round2(led.cash),
    marketValue: round2(marketValue),
    totalValue: round2(marketValue + led.cash),
    costBasis: round2(open.reduce((a, h) => a + h.costBasis, 0)),
    unrealized: round2(unrealized),
    realized: round2(realized),
    dividends: round2(dividends),
    feesPaid: round2(led.feesPaid),
    deposits: round2(led.deposits),
    withdrawals: round2(led.withdrawals),
    netContributions: round2(netContributions),
    grossBuyCost: round2(led.grossBuyCost),
    totalGain: round2(totalGain),
    returnPct: safeDiv(totalGain, base),
    dayChange: round2(dayChange),
    dayChangePct: prevMarketValue > 0 ? dayChange / prevMarketValue : null,
    realizedEvents: led.realizedEvents,
    issues: led.issues,
    missingPrices,
  };
}

/** Quantity held of a symbol as of a date (inclusive). Used for validation. */
export function quantityHeld(txs: Transaction[], symbol: string, asOf?: string, excludeId?: string): number {
  const led = replayLedger(
    txs.filter((t) => t.id !== excludeId),
    asOf,
  );
  return led.positions.get(symbol)?.quantity ?? 0;
}

/**
 * Daily portfolio value series. `closeOn(symbol, date)` must return the most
 * recent close on or before `date`, or null when unknown.
 */
export function valueSeries(
  txs: Transaction[],
  dates: string[],
  closeOn: (symbol: string, date: string) => number | null,
): { date: string; value: number; invested: number; cash: number }[] {
  const sorted = sortTransactions(txs);
  const qty = new Map<string, number>();
  const cost = new Map<string, number>();
  let cash = 0;
  let netIn = 0;
  let i = 0;
  const out: { date: string; value: number; invested: number; cash: number }[] = [];
  for (const d of dates) {
    while (i < sorted.length && sorted[i].date <= d) {
      const t = sorted[i++];
      const s = t.symbol ?? "";
      const q = qty.get(s) ?? 0;
      const c = cost.get(s) ?? 0;
      switch (t.type) {
        case "DEPOSIT": cash += t.amount; netIn += t.amount; break;
        case "WITHDRAWAL": cash -= t.amount; netIn -= t.amount; break;
        case "FEE": cash -= t.amount; break;
        case "DIVIDEND": cash += t.amount; break;
        case "BONUS": qty.set(s, q + t.quantity); break;
        case "BUY":
          qty.set(s, q + t.quantity);
          cost.set(s, c + t.quantity * t.price + t.fees);
          cash -= t.quantity * t.price + t.fees;
          break;
        case "SELL": {
          if (t.quantity > q + 1e-9) break;
          const avg = q > 0 ? c / q : 0;
          qty.set(s, q - t.quantity);
          cost.set(s, q - t.quantity <= 1e-9 ? 0 : c - avg * t.quantity);
          cash += t.quantity * t.price - t.fees;
          break;
        }
      }
    }
    let mv = 0;
    let costHeld = 0;
    for (const [s, q] of qty) {
      if (q <= 0) continue;
      const px = closeOn(s, d);
      mv += px !== null ? q * px : cost.get(s) ?? 0;
      costHeld += cost.get(s) ?? 0;
    }
    // When no deposits are recorded, "invested" falls back to cost of open positions.
    out.push({ date: d, value: round2(mv + cash), invested: round2(netIn > 0 ? netIn : costHeld), cash: round2(cash) });
  }
  return out;
}

/** Duplicate detection for imports: same date, type, symbol, quantity, price. */
export function txFingerprint(t: Pick<Transaction, "date" | "type" | "symbol" | "quantity" | "price" | "amount">): string {
  return [t.date, t.type, (t.symbol ?? "").toUpperCase(), round2(t.quantity), round2(t.price), round2(t.amount)].join("|");
}

export function findDuplicates<T extends Pick<Transaction, "date" | "type" | "symbol" | "quantity" | "price" | "amount">>(
  incoming: T[],
  existing: Transaction[],
): Set<number> {
  const seen = new Set(existing.map(txFingerprint));
  const dupes = new Set<number>();
  incoming.forEach((t, idx) => {
    const fp = txFingerprint(t);
    if (seen.has(fp)) dupes.add(idx);
    else seen.add(fp);
  });
  return dupes;
}
