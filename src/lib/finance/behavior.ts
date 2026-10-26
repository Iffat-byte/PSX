import { isClosed, tradePnl } from "./journal";
import type { Emotion, JournalTrade } from "./types";

/** ISO week key (YYYY-Www) for a YYYY-MM-DD date. */
export function isoWeek(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const STOP = new Set(
  "the a an and or but to of in on for with at by from it is was were be been i my me we our this that so too very not no just than then as into over after before when if about".split(" "),
);

export interface BehaviorOptions {
  /** Weekly trade count above which a week is flagged for overtrading review */
  maxTradesPerWeek: number;
  /** Days after a losing exit within which a new, larger trade counts as possible loss-chasing */
  chaseWindowDays: number;
  /** Size multiplier vs. the losing trade that marks a position as "larger" */
  chaseSizeMultiplier: number;
}

export const DEFAULT_BEHAVIOR_OPTIONS: BehaviorOptions = {
  maxTradesPerWeek: 5,
  chaseWindowDays: 2,
  chaseSizeMultiplier: 1.25,
};

export function behaviorAnalytics(trades: JournalTrade[], opts: BehaviorOptions = DEFAULT_BEHAVIOR_OPTIONS) {
  const n = trades.length;
  const byEntry = [...trades].sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : a.createdAt - b.createdAt));
  const rate = (f: (t: JournalTrade) => boolean) => (n ? trades.filter(f).length / n : null);

  // Weekly activity
  const weeks = new Map<string, { week: string; trades: number; unplanned: number; impulsive: number; ruleBreaks: number }>();
  for (const t of byEntry) {
    const k = isoWeek(t.entryDate);
    const w = weeks.get(k) ?? { week: k, trades: 0, unplanned: 0, impulsive: 0, ruleBreaks: 0 };
    w.trades++;
    if (!t.followedPlan) w.unplanned++;
    if (t.impulsive) w.impulsive++;
    if (!t.riskRespected) w.ruleBreaks++;
    weeks.set(k, w);
  }
  const weekly = [...weeks.values()].sort((a, b) => (a.week < b.week ? -1 : 1));
  const counts = weekly.map((w) => w.trades).sort((a, b) => a - b);
  const median = counts.length ? counts[Math.floor(counts.length / 2)] : 0;
  const overtradingWeeks = weekly.filter((w) => w.trades > opts.maxTradesPerWeek || (median > 0 && w.trades >= median * 2 && w.trades >= 4));

  // Loss-chasing: a new entry soon after a losing exit, sized larger or flagged impulsive.
  const chase: { trade: JournalTrade; after: JournalTrade }[] = [];
  const closed = trades.filter(isClosed);
  for (const t of byEntry) {
    const prior = closed
      .filter((c) => c.id !== t.id && c.exitDate <= t.entryDate && (tradePnl(c) ?? 0) < 0)
      .filter((c) => (Date.parse(t.entryDate) - Date.parse(c.exitDate)) / 86_400_000 <= opts.chaseWindowDays)
      .sort((a, b) => (a.exitDate < b.exitDate ? 1 : -1))[0];
    if (!prior) continue;
    const larger = t.entryPrice * t.quantity >= prior.entryPrice * prior.quantity * opts.chaseSizeMultiplier;
    if (larger || t.impulsive) chase.push({ trade: t, after: prior });
  }

  // Planned vs unplanned outcomes
  const group = (f: (t: JournalTrade) => boolean) => {
    const g = closed.filter(f);
    const p = g.map((t) => tradePnl(t)!);
    return {
      count: g.length,
      winRate: g.length ? p.filter((x) => x > 0).length / g.length : null,
      avgPnl: g.length ? p.reduce((a, b) => a + b, 0) / g.length : null,
      net: p.reduce((a, b) => a + b, 0),
    };
  };

  const confidence = [1, 2, 3, 4, 5].map((c) => ({ confidence: c, ...group((t) => t.confidence === c) }));
  const emotionKeys = [...new Set(trades.map((t) => t.emotionEntry))] as Emotion[];
  const emotions = emotionKeys
    .map((e) => ({ emotion: e, total: trades.filter((t) => t.emotionEntry === e).length, ...group((t) => t.emotionEntry === e) }))
    .sort((a, b) => b.total - a.total);

  // Recurring themes from tags and free text
  const freq = new Map<string, number>();
  for (const t of trades) {
    for (const tag of t.tags) freq.set(`#${tag.toLowerCase()}`, (freq.get(`#${tag.toLowerCase()}`) ?? 0) + 1);
    const text = `${t.lessons ?? ""} ${t.exitReason ?? ""}`.toLowerCase();
    const words = new Set(text.match(/[a-z][a-z'-]{3,}/g) ?? []);
    for (const w of words) if (!STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const themes = [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([term, count]) => ({ term, count }));

  return {
    total: n,
    planAdherence: rate((t) => t.followedPlan),
    riskRuleAdherence: rate((t) => t.riskRespected),
    impulsiveRate: rate((t) => t.impulsive),
    pressuredRate: rate((t) => t.pressured),
    unplannedCount: trades.filter((t) => !t.followedPlan).length,
    weekly,
    overtradingWeeks,
    lossChasing: chase,
    planned: group((t) => t.followedPlan),
    unplanned: group((t) => !t.followedPlan),
    confidence,
    emotions,
    themes,
  };
}
