import type { PortfolioSnapshot } from "./finance/types";
import { concentration } from "./finance/calculators";
import { sectorOf } from "./market/symbols";
import { pct, pkr, fmtDate, addDays, todayISO } from "./format";
import type { CalendarEvent, Settings } from "@/store/types";
import { isFeeProfileConfigured } from "./finance/fees";

export function sectorAllocation(snap: PortfolioSnapshot) {
  const m = new Map<string, number>();
  for (const h of snap.holdings) m.set(sectorOf(h.symbol), (m.get(sectorOf(h.symbol)) ?? 0) + h.marketValue);
  const total = snap.marketValue || 1;
  return [...m.entries()].map(([sector, value]) => ({ sector, value, weight: value / total })).sort((a, b) => b.value - a.value);
}

export type Severity = "high" | "medium" | "info";
export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  href?: string;
}

/**
 * Deterministic, rule-based observations about the user's own records.
 * These are factual checks against user-configured thresholds, not
 * recommendations or predictions.
 */
export function portfolioInsights(snap: PortfolioSnapshot, settings: Settings, events: CalendarEvent[]): Insight[] {
  const out: Insight[] = [];
  const conc = concentration(snap.holdings.map((h) => h.marketValue));
  for (const h of snap.holdings) {
    if (h.weight * 100 > settings.maxPositionPct) {
      out.push({ id: `pos-${h.symbol}`, severity: "high", title: `${h.symbol} is ${pct(h.weight, 1)} of your portfolio`, body: `Above your ${settings.maxPositionPct}% single-position limit. Review whether this concentration is intentional.`, href: "/lab?tab=rebalance" });
    }
  }
  for (const s of sectorAllocation(snap)) {
    if (s.weight * 100 > settings.maxSectorPct) {
      out.push({ id: `sec-${s.sector}`, severity: "medium", title: `${s.sector} exposure at ${pct(s.weight, 1)}`, body: `Above your ${settings.maxSectorPct}% sector limit.`, href: "/portfolio?tab=allocation" });
    }
  }
  if (snap.holdings.length >= 2 && conc.effectiveN < 4) {
    out.push({ id: "effn", severity: "info", title: `Effective number of positions: ${conc.effectiveN.toFixed(1)}`, body: "Based on position weights (1 / HHI). Lower values mean returns depend on fewer holdings." });
  }
  for (const h of snap.holdings) {
    if (h.unrealizedPct <= -0.15) out.push({ id: `dd-${h.symbol}`, severity: "medium", title: `${h.symbol} is ${pct(h.unrealizedPct, 1)} below your average cost`, body: "Consider revisiting your original thesis and any exit rules you set.", href: `/research?s=${h.symbol}` });
  }
  if (snap.cash < -1) {
    out.push({ id: "cash", severity: "medium", title: `Cash balance is ${pkr(snap.cash)}`, body: "Purchases exceed recorded deposits. Record a deposit to reconcile with your broker statement.", href: "/portfolio?tab=reconcile" });
  }
  for (const i of snap.issues.slice(0, 3)) out.push({ id: `iss-${i.txId}`, severity: "high", title: "Ledger issue", body: i.message, href: "/portfolio?tab=transactions" });
  if (snap.missingPrices.length) out.push({ id: "mp", severity: "info", title: "Positions without a price", body: `${snap.missingPrices.join(", ")} valued at cost — no quote from the current data source.` });

  const held = new Set(snap.holdings.map((h) => h.symbol));
  const today = todayISO();
  const soon = events.filter((e) => e.symbol && held.has(e.symbol) && e.date >= today && e.date <= addDays(today, 14)).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const e of soon.slice(0, 3)) out.push({ id: `ev-${e.id}`, severity: "info", title: `${e.symbol}: ${e.type} on ${fmtDate(e.date)}`, body: e.origin === "demo" ? "Sample event (demo)." : e.title, href: "/calendar" });

  if (!isFeeProfileConfigured(settings.feeProfile)) {
    out.push({ id: "fees", severity: "info", title: "Fee profile not configured", body: "Enter your broker's commission and charges so new transactions estimate fees automatically.", href: "/settings#fees" });
  }
  const rank = { high: 0, medium: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
