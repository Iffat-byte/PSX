import { describe, expect, it } from "vitest";
import { computePortfolio, findDuplicates, quantityHeld, valueSeries } from "./portfolio";
import { averageCost, compound, concentration, dividendIncome, portfolioVolatility, positionSize, profitTargets, whatIf } from "./calculators";
import { estimateFees, ZERO_FEES } from "./fees";
import { journalStats, rMultiple, tradePnl } from "./journal";
import { behaviorAnalytics, isoWeek } from "./behavior";
import { rsi, sma } from "./indicators";
import type { JournalTrade, Transaction } from "./types";

let n = 0;
const tx = (p: Partial<Transaction> & Pick<Transaction, "type" | "date">): Transaction => ({
  id: `t${++n}`,
  portfolioId: "p",
  quantity: 0,
  price: 0,
  fees: 0,
  amount: 0,
  source: "manual",
  createdAt: n,
  ...p,
});

describe("portfolio ledger (weighted average cost)", () => {
  it("computes weighted average cost including fees", () => {
    const s = computePortfolio(
      [
        tx({ type: "BUY", date: "2026-01-01", symbol: "OGDC", quantity: 100, price: 100, fees: 50 }),
        tx({ type: "BUY", date: "2026-01-05", symbol: "OGDC", quantity: 100, price: 120, fees: 50 }),
      ],
      { OGDC: { price: 130, prevClose: 125 } },
    );
    const h = s.holdings[0];
    expect(h.quantity).toBe(200);
    expect(h.costBasis).toBe(22100);
    expect(h.avgCost).toBeCloseTo(110.5, 10);
    expect(h.marketValue).toBe(26000);
    expect(h.unrealized).toBe(3900);
    expect(h.dayChange).toBe(1000);
  });

  it("handles partial sales without changing average cost and realizes P/L net of fees", () => {
    const s = computePortfolio(
      [
        tx({ type: "BUY", date: "2026-01-01", symbol: "HBL", quantity: 200, price: 100, fees: 0 }),
        tx({ type: "SELL", date: "2026-02-01", symbol: "HBL", quantity: 50, price: 90, fees: 10 }),
      ],
      { HBL: { price: 95, prevClose: 95 } },
    );
    const h = s.holdings[0];
    expect(h.quantity).toBe(150);
    expect(h.avgCost).toBe(100);
    expect(s.realized).toBe(-510); // 50*90 - 10 - 50*100
    expect(h.unrealized).toBe(-750);
    expect(s.realizedEvents[0].pnl).toBe(-510);
  });

  it("resets cost to zero when fully sold and starts fresh on re-entry", () => {
    const s = computePortfolio(
      [
        tx({ type: "BUY", date: "2026-01-01", symbol: "LUCK", quantity: 3, price: 10 }),
        tx({ type: "SELL", date: "2026-01-02", symbol: "LUCK", quantity: 3, price: 12 }),
        tx({ type: "BUY", date: "2026-01-03", symbol: "LUCK", quantity: 10, price: 20 }),
      ],
      { LUCK: { price: 20, prevClose: 20 } },
    );
    expect(s.holdings[0].avgCost).toBe(20);
    expect(s.realized).toBe(6);
  });

  it("rejects overselling and reports a ledger issue", () => {
    const s = computePortfolio(
      [
        tx({ type: "BUY", date: "2026-01-01", symbol: "SYS", quantity: 10, price: 10 }),
        tx({ type: "SELL", date: "2026-01-02", symbol: "SYS", quantity: 11, price: 10 }),
      ],
      {},
    );
    expect(s.issues).toHaveLength(1);
    expect(s.holdings[0].quantity).toBe(10);
    expect(s.missingPrices).toEqual(["SYS"]);
  });

  it("applies bonus shares at zero cost", () => {
    const s = computePortfolio(
      [
        tx({ type: "BUY", date: "2026-01-01", symbol: "FFC", quantity: 100, price: 110 }),
        tx({ type: "BONUS", date: "2026-02-01", symbol: "FFC", quantity: 10 }),
      ],
      { FFC: { price: 100, prevClose: 100 } },
    );
    expect(s.holdings[0].quantity).toBe(110);
    expect(s.holdings[0].avgCost).toBe(100);
    expect(s.holdings[0].unrealized).toBe(0);
  });

  it("tracks cash, dividends and returns against contributions", () => {
    const s = computePortfolio(
      [
        tx({ type: "DEPOSIT", date: "2026-01-01", amount: 10000 }),
        tx({ type: "BUY", date: "2026-01-02", symbol: "MCB", quantity: 50, price: 100, fees: 20 }),
        tx({ type: "DIVIDEND", date: "2026-03-01", symbol: "MCB", amount: 450 }),
        tx({ type: "FEE", date: "2026-03-02", amount: 30 }),
      ],
      { MCB: { price: 110, prevClose: 108 } },
    );
    expect(s.cash).toBe(10000 - 5020 + 450 - 30);
    expect(s.totalValue).toBe(5500 + 5400);
    expect(s.dividends).toBe(450);
    expect(s.totalGain).toBe(480 + 450 - 30);
    expect(s.returnPct).toBeCloseTo(900 / 10000, 10);
    // consistency: total value − contributions = total gain
    expect(s.totalValue - s.netContributions).toBeCloseTo(s.totalGain, 6);
  });

  it("is order independent within the ledger and safe on empty input", () => {
    const empty = computePortfolio([], {});
    expect(empty.totalValue).toBe(0);
    expect(empty.returnPct).toBeNull();
    expect(empty.dayChangePct).toBeNull();
  });

  it("computes quantity held as of a date, excluding an edited row", () => {
    const a = tx({ type: "BUY", date: "2026-01-01", symbol: "PSO", quantity: 10, price: 1 });
    const b = tx({ type: "SELL", date: "2026-01-05", symbol: "PSO", quantity: 4, price: 1 });
    expect(quantityHeld([a, b], "PSO")).toBe(6);
    expect(quantityHeld([a, b], "PSO", "2026-01-03")).toBe(10);
    expect(quantityHeld([a, b], "PSO", undefined, b.id)).toBe(10);
  });

  it("builds a value series consistent with the snapshot", () => {
    const txs = [
      tx({ type: "DEPOSIT", date: "2026-01-01", amount: 1000 }),
      tx({ type: "BUY", date: "2026-01-02", symbol: "X", quantity: 10, price: 50 }),
    ];
    const series = valueSeries(txs, ["2026-01-01", "2026-01-02", "2026-01-03"], (_s, d) => (d === "2026-01-03" ? 60 : 50));
    expect(series.map((p) => p.value)).toEqual([1000, 1000, 1100]);
  });

  it("detects duplicate imports, including within the incoming batch", () => {
    const existing = [tx({ type: "BUY", date: "2026-01-01", symbol: "OGDC", quantity: 10, price: 5 })];
    const incoming = [
      { date: "2026-01-01", type: "BUY" as const, symbol: "ogdc", quantity: 10, price: 5, amount: 0 },
      { date: "2026-01-02", type: "BUY" as const, symbol: "OGDC", quantity: 10, price: 5, amount: 0 },
      { date: "2026-01-02", type: "BUY" as const, symbol: "OGDC", quantity: 10, price: 5, amount: 0 },
    ];
    expect([...findDuplicates(incoming, existing)]).toEqual([0, 2]);
  });
});

describe("fees", () => {
  it("is zero by default and applies minimum per-share commission", () => {
    expect(estimateFees(ZERO_FEES, 100, 50)).toBe(0);
    const p = { commissionPct: 0.1, minPerShare: 0.05, taxOnCommissionPct: 10, otherPct: 0, flatPerTrade: 0 };
    // 1000 shares @ 10 = 10,000; 0.1% = 10; min 0.05*1000 = 50 → 50 + 5 tax
    expect(estimateFees(p, 1000, 10)).toBe(55);
  });
});

describe("calculators", () => {
  it("average cost: averaging down", () => {
    const r = averageCost({ existingQty: 100, existingAvg: 200, newPrice: 150, investAmount: 15000, feePct: 0 });
    expect(r.addQty).toBe(100);
    expect(r.totalQty).toBe(200);
    expect(r.newAvg).toBe(175);
    expect(r.breakEven).toBe(175);
    expect(r.pnlAt(200)).toBe(5000);
    expect(r.avgChangePct).toBeCloseTo(-0.125);
  });

  it("average cost: fees raise break-even above average", () => {
    const r = averageCost({ existingQty: 0, existingAvg: 0, newPrice: 100, investAmount: 10100, feePct: 1 });
    expect(r.addQty).toBe(100);
    expect(r.newAvg).toBeCloseTo(101);
    expect(r.breakEven).toBeCloseTo(101 / 0.99);
    expect(r.avgChangePct).toBeNull();
  });

  it("position sizing respects risk budget and capital", () => {
    const r = positionSize({ capital: 1_000_000, riskPct: 1, entry: 100, stop: 95, feePct: 0 });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.quantity).toBe(2000);
    expect(r.potentialLoss).toBe(10000);
    expect(r.rTarget(2)).toBe(110);
    const capped = positionSize({ capital: 10_000, riskPct: 50, entry: 100, stop: 99, feePct: 0 });
    expect(capped.valid && capped.quantity).toBe(100);
    expect(capped.valid && capped.cappedByCapital).toBe(true);
    expect(positionSize({ capital: 1000, riskPct: 1, entry: 100, stop: 101, feePct: 0 }).valid).toBe(false);
  });

  it("profit targets", () => {
    const [a] = profitTargets(100, 50, 0, [55]);
    expect(a.pnl).toBe(500);
    expect(a.returnPct).toBeCloseTo(0.1);
  });

  it("concentration and volatility", () => {
    const c = concentration([50, 50]);
    expect(c.hhi).toBe(0.5);
    expect(c.effectiveN).toBe(2);
    expect(portfolioVolatility([1, 1], [0.2, 0.2], 1)).toBeCloseTo(0.2);
    expect(portfolioVolatility([1, 1], [0.2, 0.2], 0)).toBeCloseTo(0.2 / Math.SQRT2);
  });

  it("dividend income nets tax", () => {
    expect(dividendIncome(1000, 5, 15).net).toBe(4250);
  });

  it("compounding with zero return equals contributions", () => {
    const rows = compound({ initial: 1000, monthly: 100, annualReturnPct: 0, years: 2, stepUpPct: 0, inflationPct: 0 });
    expect(rows.at(-1)!.balance).toBeCloseTo(3400);
    const g = compound({ initial: 1000, monthly: 0, annualReturnPct: 10, years: 1, stepUpPct: 0, inflationPct: 0 });
    expect(g.at(-1)!.balance).toBeCloseTo(1100);
  });

  it("what-if handles negative moves", () => {
    const r = whatIf(100, 100, 100, -20, 0, 0);
    expect(r.pnl).toBe(-2000);
    expect(r.pnlPct).toBeCloseTo(-0.2);
  });
});

const jt = (p: Partial<JournalTrade>): JournalTrade => ({
  id: `j${++n}`,
  symbol: "OGDC",
  side: "LONG",
  entryDate: "2026-01-05",
  entryPrice: 100,
  quantity: 100,
  fees: 0,
  tags: [],
  entryReason: "",
  confidence: 3,
  emotionEntry: "Calm",
  followedPlan: true,
  riskRespected: true,
  impulsive: false,
  pressured: false,
  createdAt: n,
  ...p,
});

describe("journal analytics", () => {
  it("computes pnl for long and short including fees, and R multiple", () => {
    expect(tradePnl(jt({ exitDate: "2026-01-06", exitPrice: 110, fees: 100 }))).toBe(900);
    expect(tradePnl(jt({ side: "SHORT", exitDate: "2026-01-06", exitPrice: 110 }))).toBe(-1000);
    expect(tradePnl(jt({}))).toBeNull();
    expect(rMultiple(jt({ stopLoss: 95, exitDate: "2026-01-06", exitPrice: 110 }))).toBe(2);
  });

  it("stats: win rate, profit factor, drawdown, sample flags", () => {
    const s = journalStats([
      jt({ exitDate: "2026-01-02", exitPrice: 110 }), // +1000
      jt({ exitDate: "2026-01-03", exitPrice: 95 }), // -500
      jt({ exitDate: "2026-01-04", exitPrice: 90 }), // -1000
      jt({}), // open
    ]);
    expect(s.closed).toBe(3);
    expect(s.open).toBe(1);
    expect(s.winRate).toBeCloseTo(1 / 3);
    expect(s.profitFactor).toBeCloseTo(1000 / 1500);
    expect(s.maxDrawdown).toBe(-1500);
    expect(s.ratiosReliable).toBe(false);
    expect(journalStats([jt({ exitDate: "2026-01-02", exitPrice: 110 })]).profitFactor).toBeNull();
  });
});

describe("behavior analytics", () => {
  it("flags loss-chasing and plan adherence", () => {
    const loss = jt({ entryDate: "2026-01-05", exitDate: "2026-01-06", exitPrice: 90 });
    const chase = jt({ entryDate: "2026-01-07", quantity: 300, followedPlan: false });
    const b = behaviorAnalytics([loss, chase]);
    expect(b.lossChasing).toHaveLength(1);
    expect(b.planAdherence).toBe(0.5);
    expect(b.unplanned.count).toBe(0); // the chase trade is still open
  });

  it("iso week", () => {
    expect(isoWeek("2026-01-01")).toBe("2026-W01");
    expect(isoWeek("2025-12-29")).toBe("2026-W01");
    expect(isoWeek("2026-10-26")).toBe("2026-W44");
  });
});

describe("indicators", () => {
  it("sma and rsi bounds", () => {
    expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
    const up = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(rsi(up).at(-1)).toBe(100);
  });
});
