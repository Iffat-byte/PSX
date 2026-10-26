import type { Quote, PortfolioSnapshot } from "./finance/types";
import type { AlertKind, PriceAlert } from "@/store/types";
import { pct, fmtNum, fmtInt } from "./format";

export const ALERT_LABELS: Record<AlertKind, string> = {
  above: "Price rises to or above",
  below: "Price falls to or below",
  pctUp: "Daily change ≥ +%",
  pctDown: "Daily change ≤ −%",
  volumeAbove: "Volume above",
  positionWeight: "Portfolio weight above %",
};

export function describeAlert(a: Pick<PriceAlert, "kind" | "value" | "symbol">): string {
  switch (a.kind) {
    case "above": return `${a.symbol} ≥ Rs ${fmtNum(a.value)}`;
    case "below": return `${a.symbol} ≤ Rs ${fmtNum(a.value)}`;
    case "pctUp": return `${a.symbol} up ${a.value}% or more on the day`;
    case "pctDown": return `${a.symbol} down ${a.value}% or more on the day`;
    case "volumeAbove": return `${a.symbol} volume above ${fmtInt(a.value)}`;
    case "positionWeight": return `${a.symbol} above ${a.value}% of portfolio`;
  }
}

/** Returns the observed value if the alert condition is met, else null. */
export function checkAlert(a: PriceAlert, quotes: Record<string, Quote>, snap?: PortfolioSnapshot): number | null {
  const q = quotes[a.symbol];
  if (a.kind === "positionWeight") {
    const h = snap?.holdings.find((x) => x.symbol === a.symbol);
    return h && h.weight * 100 >= a.value ? h.weight * 100 : null;
  }
  if (!q) return null;
  const chg = q.prevClose ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;
  switch (a.kind) {
    case "above": return q.price >= a.value ? q.price : null;
    case "below": return q.price <= a.value ? q.price : null;
    case "pctUp": return chg >= a.value ? chg : null;
    case "pctDown": return chg <= -a.value ? chg : null;
    case "volumeAbove": return q.volume > a.value ? q.volume : null;
  }
}

export function observedLabel(a: Pick<PriceAlert, "kind">, v: number): string {
  if (a.kind === "pctUp" || a.kind === "pctDown") return pct(v / 100, 2, true);
  if (a.kind === "positionWeight") return `${v.toFixed(1)}%`;
  if (a.kind === "volumeAbove") return fmtInt(v);
  return `Rs ${fmtNum(v)}`;
}
