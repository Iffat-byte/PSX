import { addDays, todayISO } from "../format";
import { BENCHMARKS, SYMBOLS, SYMBOL_MAP } from "./symbols";
import type { Quote } from "../finance/types";

/**
 * DEMO market data provider.
 *
 * Generates deterministic synthetic price series so every screen can be
 * exercised without a licensed PSX feed. Nothing here reflects real prices.
 * Replace with an authorised provider implementing `MarketDataProvider`.
 */
export interface MarketDataProvider {
  id: string;
  label: string;
  isLive: boolean;
  disclaimer: string;
  asOf(): string;
  tradingDays(): string[];
  history(symbol: string): { date: string; close: number; volume: number }[];
  quote(symbol: string): Quote | undefined;
  quotes(): Record<string, Quote>;
  closeOn(symbol: string, date: string): number | null;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function gauss(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const DAYS = 320;

function buildTradingDays(): string[] {
  let d = todayISO();
  const out: string[] = [];
  while (out.length < DAYS) {
    const wd = new Date(d + "T00:00:00").getDay();
    if (wd !== 0 && wd !== 6) out.push(d);
    d = addDays(d, -1);
  }
  return out.reverse();
}

function buildSeries(key: string, seed: number, vol: number, days: string[], drift = 0.12) {
  const rand = mulberry32(hash(key));
  const dt = 1 / 252;
  // Walk backwards from the seed price so the latest close sits near it.
  const closes: number[] = new Array(days.length);
  closes[days.length - 1] = seed * (0.92 + rand() * 0.16);
  for (let i = days.length - 2; i >= 0; i--) {
    const shock = gauss(rand) * vol * Math.sqrt(dt);
    closes[i] = closes[i + 1] / Math.exp((drift - 0.5 * vol * vol) * dt + shock);
  }
  return days.map((date, i) => ({
    date,
    close: Math.round(closes[i] * 100) / 100,
    volume: Math.round((0.3 + rand() * 1.7) * (2_000_000 / Math.sqrt(seed))) * 100,
  }));
}

class DemoProvider implements MarketDataProvider {
  id = "demo";
  label = "Demo data (synthetic)";
  isLive = false;
  disclaimer =
    "Prices, volumes and index levels are synthetic and generated for demonstration. They are not PSX market data and must not be used for investment decisions.";
  private days: string[] | null = null;
  private cache = new Map<string, { date: string; close: number; volume: number }[]>();
  private idx = new Map<string, Map<string, number>>();

  tradingDays() {
    if (!this.days) this.days = buildTradingDays();
    return this.days;
  }
  asOf() {
    const d = this.tradingDays();
    return d[d.length - 1];
  }
  history(symbol: string) {
    let h = this.cache.get(symbol);
    if (h) return h;
    const info = SYMBOL_MAP[symbol];
    const bench = BENCHMARKS[symbol as keyof typeof BENCHMARKS];
    if (info) h = buildSeries(symbol, info.seedPrice, info.vol, this.tradingDays());
    else if (bench) h = buildSeries(symbol, bench.seed, bench.vol, this.tradingDays(), 0.18);
    else h = [];
    this.cache.set(symbol, h);
    this.idx.set(symbol, new Map(h.map((p, i) => [p.date, i])));
    return h;
  }
  quote(symbol: string): Quote | undefined {
    const h = this.history(symbol);
    if (h.length < 2) return undefined;
    const last = h[h.length - 1];
    return { symbol, price: last.close, prevClose: h[h.length - 2].close, volume: last.volume, asOf: last.date, source: this.label };
  }
  quotes() {
    const out: Record<string, Quote> = {};
    for (const s of SYMBOLS) out[s.symbol] = this.quote(s.symbol)!;
    return out;
  }
  closeOn(symbol: string, date: string): number | null {
    const h = this.history(symbol);
    if (!h.length || date < h[0].date) return null;
    const exact = this.idx.get(symbol)?.get(date);
    if (exact !== undefined) return h[exact].close;
    // binary search for last date <= date
    let lo = 0;
    let hi = h.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (h[mid].date <= date) lo = mid;
      else hi = mid - 1;
    }
    return h[lo].close;
  }
}

export const market: MarketDataProvider = new DemoProvider();
