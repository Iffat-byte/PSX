"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, CalendarCheck, HeartPulse, Repeat, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, Delta, EmptyState, Field, Modal, Notice, PageHeader, Progress, Segmented, Slider, Stat, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { Legend, PlainBarChart, ScatterPlot } from "@/components/charts";
import { useApp } from "@/store/app-store";
import { behaviorAnalytics, isoWeek } from "@/lib/finance/behavior";
import { isClosed, tradePnl } from "@/lib/finance/journal";
import { fmtDate, pct, pkrCompact, pkrSigned, todayISO, addDays } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function BehaviorPage() {
  const journal = useApp((s) => s.journal);
  const reviews = useApp((s) => s.reviews);
  const opts = useApp((s) => s.settings.behavior);
  const update = useApp((s) => s.updateSettings);
  const delReview = useApp((s) => s.deleteReview);
  const params = useSearchParams();
  const router = useRouter();
  const [period, setPeriod] = useState<"4w" | "12w" | "all">("all");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [view, setView] = useState<"insights" | "timeline">("insights");

  useEffect(() => {
    if (params.get("review")) { setReviewOpen(true); router.replace("/behavior"); }
  }, [params, router]);

  const scoped = useMemo(() => {
    if (period === "all") return journal;
    const from = addDays(todayISO(), period === "4w" ? -28 : -84);
    return journal.filter((t) => t.entryDate >= from);
  }, [journal, period]);
  const b = useMemo(() => behaviorAnalytics(scoped, opts), [scoped, opts]);

  return (
    <>
      <PageHeader
        title="Trading Behavior Studio"
        description="A private, nonjudgmental space to notice patterns in how you make decisions. Educational self-reflection — not a diagnostic tool."
        actions={<Button variant="primary" size="sm" onClick={() => setReviewOpen(true)}><CalendarCheck className="h-4 w-4" />Weekly review</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={setView} options={[{ value: "insights", label: "Insights" }, { value: "timeline", label: "Reflection timeline" }]} />
        {view === "insights" && <Segmented value={period} onChange={setPeriod} options={[{ value: "4w", label: "4 weeks" }, { value: "12w", label: "12 weeks" }, { value: "all", label: "All time" }]} />}
      </div>

      {view === "timeline" ? <Timeline onDeleteReview={delReview} reviews={reviews} /> : b.total === 0 ? (
        <Card><EmptyState icon={<Brain className="h-5 w-5" />} title="No journal entries in this period" body="Behavioral insights are built from your trade journal. Log a few trades with honest notes to begin." /></Card>
      ) : (
        <div className="grid gap-4">
          <Card className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-4">
            <Meter label="Plan adherence" v={b.planAdherence} good />
            <Meter label="Risk rules respected" v={b.riskRuleAdherence} good />
            <Meter label="Impulsive entries" v={b.impulsiveRate} />
            <Meter label="Felt pressured" v={b.pressuredRate} />
          </Card>

          <ObservationCards b={b} />

          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <Card>
              <CardHeader icon={<Repeat className="h-4 w-4" />} title="Trading frequency by week" subtitle={`Planned vs. unplanned · ${b.overtradingWeeks.length} week(s) above your review threshold of ${opts.maxTradesPerWeek}`} />
              <div className="px-3">
                <PlainBarChart data={b.weekly.map((w) => ({ week: w.week.slice(5), planned: w.trades - w.unplanned, unplanned: w.unplanned }))} xKey="week" stacked height={220} bars={[{ key: "planned", label: "Planned", color: "var(--c3)" }, { key: "unplanned", label: "Unplanned", color: "var(--c4)" }]} />
              </div>
              <Legend className="px-5 pb-4 pt-2" items={[{ label: "Planned", color: "var(--c3)" }, { label: "Unplanned", color: "var(--c4)" }]} />
            </Card>
            <Card>
              <CardHeader title="Planned vs. actual outcomes" subtitle="Closed trades only" />
              <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                {([["Followed plan", b.planned], ["Unplanned", b.unplanned]] as const).map(([l, g]) => (
                  <div key={l} className="rounded-xl border border-border p-3">
                    <p className="text-xs font-medium text-muted">{l}</p>
                    <p className="num mt-2 text-lg font-semibold">{g.count ? pct(g.winRate, 0) : "—"}</p>
                    <p className="text-[11px] text-subtle">win rate · {g.count} trades</p>
                    <p className="num mt-2 text-sm"><Delta value={g.avgPnl} icon={false}>{g.count ? pkrSigned(g.avgPnl) : "—"}</Delta></p>
                    <p className="text-[11px] text-subtle">avg per trade</p>
                  </div>
                ))}
                {(b.planned.count < 5 || b.unplanned.count < 5) && <p className="col-span-2 text-[11px] text-subtle">Small groups (&lt;5 trades) can differ by chance alone.</p>}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Confidence vs. realized outcome" subtitle="Each dot is a closed trade" />
              <div className="px-3 pb-2">
                <ScatterPlot data={scoped.filter(isClosed).map((t) => ({ x: t.confidence, y: tradePnl(t)!, label: `${t.symbol} · ${fmtDate(t.exitDate)}` }))} xLabel="Confidence (1–5)" yLabel="Net P/L" xDomain={[0.5, 5.5]} yFormat={(v) => pkrCompact(v).replace("Rs ", "")} />
              </div>
              <div className="grid grid-cols-5 gap-1 px-5 pb-4 text-center text-[11px]">
                {b.confidence.map((c) => <div key={c.confidence} className="rounded-lg bg-surface-2 py-1.5"><p className="text-subtle">Level {c.confidence}</p><p className="num font-medium">{c.count ? pct(c.winRate, 0) : "—"}</p><p className="text-subtle">{c.count} tr.</p></div>)}
              </div>
            </Card>
            <Card>
              <CardHeader icon={<HeartPulse className="h-4 w-4" />} title="Emotional state at entry" subtitle="How results differed by recorded feeling" />
              <div className="overflow-x-auto px-2 pb-3">
                <table className="table-base"><thead><tr><th>Feeling</th><th className="text-right">Entries</th><th className="text-right">Closed</th><th className="text-right">Win rate</th><th className="text-right">Net P/L</th></tr></thead>
                  <tbody className="num">{b.emotions.map((e) => <tr key={e.emotion}><td>{e.emotion}</td><td className="text-right">{e.total}</td><td className="text-right">{e.count}</td><td className="text-right">{e.count ? pct(e.winRate, 0) : "—"}</td><td className="text-right"><Delta value={e.net} icon={false}>{e.count ? pkrSigned(e.net) : "—"}</Delta></td></tr>)}</tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Possible loss-chasing" subtitle={`New entries within ${opts.chaseWindowDays} day(s) of a losing exit that were ≥${opts.chaseSizeMultiplier}× larger or marked impulsive`} />
              {b.lossChasing.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No instances detected with your current settings.</p> : (
                <ul className="space-y-2 px-5 pb-5">
                  {b.lossChasing.map(({ trade, after }) => (
                    <li key={trade.id} className="rounded-xl border border-amber/25 bg-amber/[.05] px-3 py-2 text-xs">
                      <span className="font-medium">{trade.symbol}</span> entered {fmtDate(trade.entryDate)} — {fmtDate(after.exitDate)} loss on {after.symbol} ({pkrSigned(tradePnl(after))})
                      {trade.impulsive && <Badge tone="loss" className="ml-1">impulsive</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Recurring themes" subtitle="Words and tags that appear across your lessons and exit reasons" />
              <div className="flex flex-wrap gap-2 px-5 pb-5">
                {b.themes.length === 0 && <p className="text-sm text-muted">Write lessons in your journal entries to surface themes.</p>}
                {b.themes.map((t) => <span key={t.term} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs" style={{ fontSize: `${Math.min(15, 11 + t.count)}px` }}>{t.term} <span className="text-subtle">×{t.count}</span></span>)}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Detection settings" subtitle="Tune how patterns are flagged. These are your own review thresholds." />
            <div className="grid gap-6 px-5 pb-5 md:grid-cols-3">
              <Slider label="Weekly trades before overtrading review" value={opts.maxTradesPerWeek} min={1} max={30} onChange={(v) => update({ behavior: { ...opts, maxTradesPerWeek: v } })} />
              <Slider label="Loss-chasing window (days)" value={opts.chaseWindowDays} min={0} max={7} onChange={(v) => update({ behavior: { ...opts, chaseWindowDays: v } })} />
              <Slider label="Larger-size multiplier" value={opts.chaseSizeMultiplier} min={1} max={3} step={0.05} onChange={(v) => update({ behavior: { ...opts, chaseSizeMultiplier: v } })} format={(v) => `${v.toFixed(2)}×`} />
            </div>
          </Card>
          <p className="text-center text-[11px] text-subtle">These patterns describe your recorded behavior and are meant for reflection. If trading is causing you distress, consider talking to someone you trust or a qualified professional.</p>
        </div>
      )}

      <WeeklyReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
    </>
  );
}

function Meter({ label, v, good }: { label: string; v: number | null; good?: boolean }) {
  const tone = v === null ? "accent" : good ? (v >= 0.8 ? "gain" : v >= 0.6 ? "amber" : "loss") : v <= 0.1 ? "gain" : v <= 0.25 ? "amber" : "loss";
  return (
    <div>
      <Stat label={label} value={pct(v, 0)} />
      <Progress className="mt-2" value={v ?? 0} tone={tone} />
    </div>
  );
}

function ObservationCards({ b }: { b: ReturnType<typeof behaviorAnalytics> }) {
  const obs: { t: string; d: string; tone: "accent" | "amber" | "info" }[] = [];
  if (b.planned.winRate !== null && b.unplanned.winRate !== null && b.planned.count >= 3 && b.unplanned.count >= 3) {
    const diff = b.planned.winRate - b.unplanned.winRate;
    obs.push({ t: diff >= 0 ? "Your planned trades have fared better" : "Unplanned trades have fared better so far", d: `Planned ${pct(b.planned.winRate, 0)} vs. unplanned ${pct(b.unplanned.winRate, 0)} win rate. Worth reflecting on what your plan captures — or misses.`, tone: diff >= 0 ? "accent" : "info" });
  }
  if (b.overtradingWeeks.length) obs.push({ t: `${b.overtradingWeeks.length} high-activity week(s)`, d: `Weeks like ${b.overtradingWeeks.slice(-2).map((w) => w.week).join(", ")} exceeded your threshold. What was happening those weeks?`, tone: "amber" });
  if (b.lossChasing.length) obs.push({ t: `${b.lossChasing.length} possible loss-chasing entr${b.lossChasing.length > 1 ? "ies" : "y"}`, d: "A larger or impulsive entry soon after a loss. A cooling-off rule could be something to consider.", tone: "amber" });
  const top = b.emotions.find((e) => e.count >= 3 && e.winRate !== null);
  if (top) obs.push({ t: `Most common feeling: ${b.emotions[0].emotion}`, d: `${b.emotions[0].total} entries were made feeling ${b.emotions[0].emotion.toLowerCase()}.`, tone: "info" });
  if (!obs.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {obs.slice(0, 3).map((o) => (
        <Notice key={o.t} tone={o.tone} title={o.t}>{o.d}</Notice>
      ))}
    </div>
  );
}

function Timeline({ reviews, onDeleteReview }: { reviews: ReturnType<typeof useApp.getState>["reviews"]; onDeleteReview: (id: string) => void }) {
  const journal = useApp((s) => s.journal);
  const items = useMemo(() => {
    const a = journal.filter((t) => t.lessons || t.exitReason).map((t) => ({ kind: "trade" as const, date: t.exitDate ?? t.entryDate, t }));
    const r = reviews.map((rv) => ({ kind: "review" as const, date: rv.week, rv }));
    return [...a, ...r].sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 60);
  }, [journal, reviews]);
  if (!items.length) return <Card><EmptyState title="Your reflection timeline is empty" body="Lessons from journal entries and weekly reviews will appear here." /></Card>;
  return (
    <Card className="p-5">
      <ol className="relative space-y-5 border-l border-border pl-6">
        {items.map((it) =>
          it.kind === "trade" ? (
            <li key={it.t.id} className="relative">
              <span className={cn("absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-surface", (tradePnl(it.t) ?? 0) >= 0 ? "bg-gain" : "bg-loss")} />
              <p className="text-[11px] text-subtle">{fmtDate(it.date)} · trade</p>
              <p className="text-sm font-medium">{it.t.symbol} — {it.t.strategy ?? "trade"} {tradePnl(it.t) !== null && <Delta value={tradePnl(it.t)} icon={false} className="ml-1 text-xs">{pkrSigned(tradePnl(it.t))}</Delta>}</p>
              {it.t.lessons && <p className="mt-1 text-[13px] text-muted">“{it.t.lessons}”</p>}
              <p className="mt-1 text-[11px] text-subtle">Felt {it.t.emotionEntry.toLowerCase()} · confidence {it.t.confidence}/5 · {it.t.followedPlan ? "planned" : "unplanned"}</p>
            </li>
          ) : (
            <li key={it.rv.id} className="relative">
              <span className="absolute -left-[32px] top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-surface bg-accent" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-subtle">{it.rv.week} · weekly review · rated {it.rv.rating}/5</p>
                  {it.rv.wentWell && <p className="mt-1 text-[13px]"><span className="text-gain">Went well:</span> <span className="text-muted">{it.rv.wentWell}</span></p>}
                  {it.rv.improve && <p className="text-[13px]"><span className="text-amber">Improve:</span> <span className="text-muted">{it.rv.improve}</span></p>}
                  {it.rv.focus && <p className="text-[13px]"><span className="text-accent">Focus:</span> <span className="text-muted">{it.rv.focus}</span></p>}
                </div>
                <ConfirmButton size="icon" title="Delete this review?" onConfirm={() => onDeleteReview(it.rv.id)} aria-label="Delete review"><Trash2 className="h-4 w-4" /></ConfirmButton>
              </div>
            </li>
          ),
        )}
      </ol>
    </Card>
  );
}

function WeeklyReviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const journal = useApp((s) => s.journal);
  const reviews = useApp((s) => s.reviews);
  const upsert = useApp((s) => s.upsertReview);
  const week = isoWeek(todayISO());
  const existing = reviews.find((r) => r.week === week);
  const [wentWell, setWentWell] = useState("");
  const [improve, setImprove] = useState("");
  const [focus, setFocus] = useState("");
  const [rating, setRating] = useState(3);
  useEffect(() => {
    if (!open) return;
    setWentWell(existing?.wentWell ?? "");
    setImprove(existing?.improve ?? "");
    setFocus(existing?.focus ?? "");
    setRating(existing?.rating ?? 3);
  }, [open, existing]);
  const thisWeek = journal.filter((t) => isoWeek(t.entryDate) === week || (t.exitDate && isoWeek(t.exitDate) === week));
  const b = behaviorAnalytics(thisWeek);
  const net = thisWeek.reduce((a, t) => a + (tradePnl(t) ?? 0), 0);
  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Weekly review · ${week}`} description="Five minutes of honest reflection compounds over time."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { upsert({ week, wentWell, improve, focus, rating }); toast.success("Weekly review saved", "Added to your reflection timeline."); onClose(); }}>{existing ? "Update review" : "Save review"}</Button></>}>
      <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface-2 p-4 sm:grid-cols-4">
        <Stat label="Trades this week" value={thisWeek.length} />
        <Stat label="Net closed P/L" value={<Delta value={net} icon={false}>{pkrSigned(net)}</Delta>} />
        <Stat label="Plan adherence" value={pct(b.planAdherence, 0)} />
        <Stat label="Impulsive" value={thisWeek.filter((t) => t.impulsive).length} />
      </div>
      <div className="space-y-4">
        <Field label="What went well this week?" htmlFor="wr-1"><Textarea id="wr-1" value={wentWell} onChange={(e) => setWentWell(e.target.value)} maxLength={800} /></Field>
        <Field label="What would you do differently?" htmlFor="wr-2"><Textarea id="wr-2" value={improve} onChange={(e) => setImprove(e.target.value)} maxLength={800} /></Field>
        <Field label="One focus for next week" htmlFor="wr-3"><Textarea id="wr-3" rows={2} value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={300} /></Field>
        <div>
          <p className="label">How disciplined did you feel overall?</p>
          <div className="flex gap-2">{[1, 2, 3, 4, 5].map((r) => <button key={r} onClick={() => setRating(r)} aria-pressed={rating === r} className={cn("h-10 flex-1 rounded-xl border text-sm font-semibold", rating === r ? "border-accent bg-accent/10 text-accent" : "border-border text-muted")}>{r}</button>)}</div>
        </div>
      </div>
    </Modal>
  );
}

