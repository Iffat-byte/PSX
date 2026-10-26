import { market } from "@/lib/market/demo-provider";
import { addDays } from "@/lib/format";
import type { JournalTrade, Portfolio, Transaction, Emotion } from "@/lib/finance/types";
import type { CalendarEvent, DividendRecord, PriceAlert, ResearchNote, Watchlist, WeeklyReview } from "./types";
import { isoWeek } from "@/lib/finance/behavior";

/**
 * Builds the clearly-labelled demo dataset shown on first launch.
 * Every record carries source/origin "demo" and can be removed from Settings.
 */
export function buildDemoData() {
  const days = market.tradingDays();
  const at = (i: number) => days[Math.max(0, Math.min(days.length - 1, i))];
  const px = (s: string, d: string) => market.closeOn(s, d) ?? 100;
  const now = Date.now();
  let k = 0;

  const core: Portfolio = { id: "pf-demo-core", name: "Core Portfolio", kind: "real", benchmark: "KSE100", createdAt: now - 1e9, description: "Demo long-term portfolio" };
  const paper: Portfolio = { id: "pf-demo-paper", name: "Paper Trading", kind: "paper", benchmark: "KSE100", createdAt: now - 9e8, description: "Virtual money — educational only" };

  const T = (p: Partial<Transaction> & Pick<Transaction, "type" | "date">): Transaction => ({
    id: `tx-demo-${++k}`,
    portfolioId: core.id,
    quantity: 0,
    price: 0,
    fees: 0,
    amount: 0,
    source: "demo",
    createdAt: now - 1e8 + k,
    ...p,
  });
  const buy = (sym: string, i: number, qty: number) => {
    const d = at(i);
    const price = px(sym, d);
    return T({ type: "BUY", date: d, symbol: sym, quantity: qty, price, fees: Math.round(qty * price * 0.0015) });
  };
  const sell = (sym: string, i: number, qty: number) => {
    const d = at(i);
    const price = px(sym, d);
    return T({ type: "SELL", date: d, symbol: sym, quantity: qty, price, fees: Math.round(qty * price * 0.0015) });
  };

  const transactions: Transaction[] = [
    T({ type: "DEPOSIT", date: at(10), amount: 2_500_000, note: "Initial funding" }),
    buy("OGDC", 12, 1500),
    buy("MCB", 14, 800),
    buy("LUCK", 20, 400),
    buy("FFC", 25, 600),
    buy("SYS", 40, 1200),
    buy("HUBC", 55, 1500),
    buy("MEBL", 70, 500),
    T({ type: "DEPOSIT", date: at(120), amount: 750_000, note: "Monthly savings" }),
    buy("OGDC", 125, 700),
    buy("TRG", 130, 3000),
    sell("TRG", 190, 3000),
    buy("PPL", 200, 1500),
    sell("SYS", 230, 500),
    buy("EFERT", 250, 1000),
    T({ type: "DIVIDEND", date: at(160), symbol: "MCB", amount: 800 * 9 * 0.85, note: "Demo dividend, net of illustrative 15% tax" }),
    T({ type: "DIVIDEND", date: at(210), symbol: "FFC", amount: 600 * 8 * 0.85, note: "Demo dividend, net of illustrative 15% tax" }),
    T({ type: "BONUS", date: at(240), symbol: "LUCK", quantity: 40, note: "Demo bonus issue (10%)" }),
    buy("BAHL", days.length - 1, 600),
  ];

  const paperTx: Transaction[] = [
    { id: "tx-demo-paper-1", portfolioId: paper.id, date: at(days.length - 40), type: "DEPOSIT", quantity: 0, price: 0, fees: 0, amount: 1_000_000, note: "Virtual starting balance", source: "paper", createdAt: now - 5e7 },
    { id: "tx-demo-paper-2", portfolioId: paper.id, date: at(days.length - 30), type: "BUY", symbol: "HBL", quantity: 1000, price: px("HBL", at(days.length - 30)), fees: 0, amount: 0, source: "paper", createdAt: now - 4e7 },
  ];

  // Journal: a varied, realistic-looking set of closed swing trades on demo prices.
  const emotions: Emotion[] = ["Calm", "Confident", "Excited", "Anxious", "FOMO", "Calm", "Greedy", "Frustrated", "Calm", "Confident"];
  const syms = ["OGDC", "PPL", "HBL", "LUCK", "SYS", "TRG", "MLCF", "PSO", "UBL", "HUBC", "DGKC", "EFERT"];
  const strategies = ["Breakout", "Pullback", "Results play", "Dividend run-up", "Mean reversion"];
  const lessons = [
    "Waited for confirmation and it paid off; patience with entries works.",
    "Entered late after a big move — FOMO entry, stop was too tight.",
    "Ignored stop-loss and hoped for recovery; respect the stop.",
    "Position size too large relative to plan; felt anxious all day.",
    "Followed the plan exactly, exited at target.",
    "Chased after previous loss; revenge trade, size too large.",
    "Took profits too early out of fear; let winners run per plan.",
    "Good setup but market-wide selling; stop worked as designed.",
  ];
  const journal: JournalTrade[] = [];
  for (let j = 0; j < 26; j++) {
    const sym = syms[j % syms.length];
    const ei = 60 + j * 9 + (j % 3);
    const hold = 2 + ((j * 7) % 11);
    const xi = Math.min(days.length - 2, ei + hold);
    const entry = px(sym, at(ei));
    const exit = px(sym, at(xi));
    const qty = (j % 5 === 4 ? 1500 : 500) + (j % 3) * 100;
    const unplanned = j % 4 === 1 || j % 7 === 5;
    const impulsive = j % 6 === 1;
    journal.push({
      id: `jr-demo-${j}`,
      symbol: sym,
      side: "LONG",
      entryDate: at(ei),
      entryPrice: entry,
      quantity: qty,
      exitDate: j >= 24 ? undefined : at(xi),
      exitPrice: j >= 24 ? undefined : exit,
      fees: Math.round(qty * entry * 0.003),
      stopLoss: Math.round(entry * 0.95 * 100) / 100,
      target: Math.round(entry * 1.1 * 100) / 100,
      strategy: strategies[j % strategies.length],
      tags: [strategies[j % strategies.length].toLowerCase().replace(/\s+/g, "-"), ...(unplanned ? ["unplanned"] : []), ...(impulsive ? ["fomo"] : [])],
      entryReason: unplanned ? "Saw strong move on the screen and jumped in." : `Setup matched my ${strategies[j % strategies.length].toLowerCase()} checklist.`,
      exitReason: j >= 24 ? undefined : exit > entry ? "Reached planned target zone." : "Stop-loss / thesis invalidated.",
      confidence: 1 + ((j * 3) % 5),
      emotionEntry: emotions[j % emotions.length],
      emotionExit: j >= 24 ? undefined : exit > entry ? "Calm" : "Frustrated",
      followedPlan: !unplanned,
      riskRespected: !(j % 5 === 2),
      impulsive,
      pressured: j % 8 === 3,
      lessons: j >= 24 ? undefined : lessons[j % lessons.length],
      createdAt: now - 3e7 + j,
    });
  }

  const watchlists: Watchlist[] = [
    { id: "wl-demo-1", name: "Core Ideas", kind: "general", createdAt: now, items: ["UBL", "POL", "MARI", "INDU", "PSO", "ATRL"].map((s, i) => ({ symbol: s, note: i === 0 ? "Watching for pullback toward support" : undefined, addedAt: now - i })) },
    { id: "wl-demo-2", name: "Shariah Research", kind: "shariah", createdAt: now, items: ["MEBL", "LUCK", "EFERT", "SYS"].map((s, i) => ({ symbol: s, addedAt: now - i, note: "Verify status in latest official list" })) },
  ];

  const q = (s: string) => market.quote(s)!.price;
  const alerts: PriceAlert[] = [
    { id: "al-demo-1", symbol: "UBL", kind: "below", value: Math.round(q("UBL") * 0.95), note: "Support zone", active: true, createdAt: now },
    { id: "al-demo-2", symbol: "OGDC", kind: "above", value: Math.round(q("OGDC") * 0.97), note: "Breakout level", active: true, createdAt: now },
    { id: "al-demo-3", symbol: "PSO", kind: "pctDown", value: 3, active: true, createdAt: now },
    { id: "al-demo-4", symbol: "OGDC", kind: "positionWeight", value: 20, note: "Concentration check", active: true, createdAt: now },
  ];

  const today = market.asOf();
  const ev = (offset: number, symbol: string, type: CalendarEvent["type"], title: string): CalendarEvent => ({
    id: `ev-demo-${symbol}-${offset}`,
    date: addDays(today, offset),
    symbol,
    type,
    title,
    note: "Sample event for demonstration — not an actual PSX announcement.",
    remind: false,
    origin: "demo",
  });
  const events: CalendarEvent[] = [
    ev(2, "OGDC", "Board Meeting", "Board meeting (sample)"),
    ev(4, "MCB", "Results", "Quarterly results (sample)"),
    ev(6, "FFC", "Dividend", "Dividend announcement (sample)"),
    ev(9, "FFC", "Book Closure", "Book closure (sample)"),
    ev(11, "LUCK", "Results", "Quarterly results (sample)"),
    ev(13, "HUBC", "Board Meeting", "Board meeting (sample)"),
    ev(16, "SYS", "AGM", "Annual general meeting (sample)"),
    ev(19, "UBL", "Dividend", "Dividend announcement (sample)"),
    ev(23, "EFERT", "Rights", "Rights issue consideration (sample)"),
    ev(-3, "PPL", "Results", "Quarterly results (sample)"),
    ev(-8, "MEBL", "Bonus", "Bonus announcement (sample)"),
  ];

  const dividends: DividendRecord[] = [
    { id: "dv-demo-1", portfolioId: core.id, symbol: "MCB", status: "received", dps: 9, quantity: 800, taxPct: 15, paymentDate: at(160), ledgerTxId: "tx-demo-16", createdAt: now, note: "Demo" },
    { id: "dv-demo-2", portfolioId: core.id, symbol: "FFC", status: "declared", dps: 10, quantity: 600, taxPct: 15, bookClosure: addDays(today, 9), paymentDate: addDays(today, 30), createdAt: now, note: "Demo — sample declaration" },
    { id: "dv-demo-3", portfolioId: core.id, symbol: "OGDC", status: "expected", dps: 3, quantity: 2200, taxPct: 15, createdAt: now, note: "Hypothetical — your own estimate" },
  ];

  const notes: ResearchNote[] = [
    { id: "rn-demo-1", symbol: "OGDC", title: "Thesis check-in", body: "Track circular debt developments and production updates. Re-check payout consistency after results.", stance: "neutral", createdAt: now - 2e6 },
  ];

  const lastWeek = isoWeek(addDays(today, -7));
  const reviews: WeeklyReview[] = [
    { id: "wr-demo-1", week: lastWeek, wentWell: "Respected stops on two trades.", improve: "Avoid entries in the first 15 minutes.", focus: "Only take A+ setups from the checklist.", rating: 3, createdAt: now - 6e8 },
  ];

  return { portfolios: [core, paper], transactions: [...transactions, ...paperTx], journal, watchlists, alerts, events, dividends, notes, reviews };
}
