"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BellRing, Brain, CalendarDays, CheckCircle2, Lightbulb, ListChecks, PieChart as PieIcon, Shield, Sparkles, Star, TrendingUp } from "lucide-react";
import { Badge, Card, CardHeader, Delta, EmptyState, Progress, Segmented, SourceNote, Stat } from "@/components/ui";
import { Donut, Legend, SERIES, Sparkline, TimeSeriesChart, PlainBarChart } from "@/components/charts";
import { useApp, selectActivePortfolio } from "@/store/app-store";
import { useQuotes, usePortfolioTxs } from "@/lib/hooks";
import type { PortfolioSnapshot } from "@/lib/finance/types";
import { market } from "@/lib/market/demo-provider";
import { valueSeries } from "@/lib/finance/portfolio";
import { concentration, portfolioVolatility } from "@/lib/finance/calculators";
import { annualizedVol } from "@/lib/finance/indicators";
import { behaviorAnalytics } from "@/lib/finance/behavior";
import { portfolioInsights, sectorAllocation } from "@/lib/insights";
import { describeAlert, observedLabel } from "@/lib/alerts";
import { fmtDate, fmtDateTime, fmtNum, pct, pkr, pkrCompact, pkrSigned, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const SRC = market.label;

export function KpiWidget({ snap }: { snap: PortfolioSnapshot }) {
  const items = [
    { label: "Total portfolio value", value: pkr(snap.totalValue), sub: <span className="text-muted">Holdings {pkrCompact(snap.marketValue)} + cash</span>, info: "Market value of open positions (at latest available price) plus cash balance." },
    { label: "Net invested capital", value: pkr(snap.netContributions > 0 ? snap.netContributions : snap.costBasis), sub: <span className="text-muted">{snap.netContributions > 0 ? "Deposits − withdrawals" : "Cost of open positions"}</span>, info: "Recorded deposits minus withdrawals. If you haven't recorded deposits, the cost of open positions is shown." },
    { label: "Unrealized P/L", value: <Delta value={snap.unrealized} icon={false}>{pkrSigned(snap.unrealized)}</Delta>, sub: <Delta value={snap.unrealized}>{pct(snap.costBasis ? snap.unrealized / snap.costBasis : 0, 2, true)}</Delta>, info: "Market value minus weighted-average cost of shares still held (fees included in cost)." },
    { label: "Realized P/L", value: <Delta value={snap.realized} icon={false}>{pkrSigned(snap.realized)}</Delta>, sub: <span className="text-muted">+ {pkr(snap.dividends)} dividends</span>, info: "Sum of (sale proceeds after fees − average cost of shares sold)." },
    { label: "Today's change", value: <Delta value={snap.dayChange} icon={false}>{pkrSigned(snap.dayChange)}</Delta>, sub: <span className="flex items-center gap-1.5"><Delta value={snap.dayChangePct}>{pct(snap.dayChangePct, 2, true)}</Delta><Badge tone="amber">demo</Badge></span>, info: "Change versus previous close. Computed from synthetic demo prices until a licensed feed is connected." },
    { label: "Available cash", value: <span className={snap.cash < 0 ? "text-loss" : ""}>{pkr(snap.cash)}</span>, sub: snap.cash < 0 ? <Link href="/portfolio?tab=reconcile" className="text-amber hover:underline">Reconcile cash →</Link> : <span className="text-muted">From recorded cash flows</span> },
    { label: "Total return", value: <Delta value={snap.returnPct} icon={false}>{pct(snap.returnPct, 2, true)}</Delta>, sub: <span className="text-muted">{pkrSigned(snap.totalGain)} total gain</span>, info: "(Unrealized + realized + dividends − standalone fees) ÷ net contributions. Simple return, not time-weighted." },
    { label: "Fees paid", value: pkr(snap.feesPaid), sub: <span className="text-muted">Brokerage & charges recorded</span> },
  ];
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
        {items.map((i) => <Stat key={i.label} label={i.label} value={i.value} sub={i.sub} info={i.info} />)}
      </div>
    </Card>
  );
}

const RANGES = { "1M": 22, "3M": 66, "6M": 130, "1Y": 252, All: 10_000 } as const;

export function ValueHistoryWidget() {
  const txs = usePortfolioTxs();
  const pf = useApp(selectActivePortfolio);
  const [range, setRange] = useState<keyof typeof RANGES>("6M");
  const data = useMemo(() => {
    const days = market.tradingDays();
    const first = txs.length ? [...txs].sort((a, b) => (a.date < b.date ? -1 : 1))[0].date : days[days.length - 1];
    const sliced = days.filter((d) => d >= first).slice(-RANGES[range]);
    const series = valueSeries(txs, sliced, (s, d) => market.closeOn(s, d));
    const benchKey = pf.benchmark !== "none" ? pf.benchmark : null;
    const b0 = benchKey && sliced.length ? market.closeOn(benchKey, sliced[0]) : null;
    const v0 = series[0]?.value || 0;
    return series.map((p) => ({ ...p, benchmark: benchKey && b0 && v0 ? (market.closeOn(benchKey, p.date)! / b0) * v0 : undefined }));
  }, [txs, range, pf.benchmark]);

  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const lines = [
    { key: "value" as const, label: "Portfolio value", color: "rgb(var(--accent))" },
    { key: "invested" as const, label: "Net invested", color: "rgb(var(--subtle))", dashed: true },
    ...(pf.benchmark !== "none" ? [{ key: "benchmark" as const, label: `${pf.benchmark} (rebased, synthetic)`, color: "var(--c1)", dashed: true }] : []),
  ];
  return (
    <Card>
      <CardHeader
        icon={<TrendingUp className="h-4 w-4" />}
        title="Portfolio value history"
        subtitle={<>Change over period: <Delta value={last - first}>{pkrSigned(last - first)}</Delta></>}
        action={<Segmented size="sm" value={range} onChange={setRange} options={Object.keys(RANGES).map((r) => ({ value: r as keyof typeof RANGES, label: r }))} />}
      />
      <div className="px-3 pb-2">
        {data.length < 2 ? (
          <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="Not enough history yet" body="Record transactions to build your portfolio value history." />
        ) : (
          <TimeSeriesChart data={data} series={lines} height={270} />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4">
        <Legend items={lines} />
        <SourceNote source={`Your ledger × ${SRC}`} asOf={fmtDate(market.asOf())} />
      </div>
    </Card>
  );
}

export function AllocationWidget({ snap }: { snap: PortfolioSnapshot }) {
  const [mode, setMode] = useState<"sector" | "holding">("sector");
  const rows = useMemo(() => {
    const base = mode === "sector" ? sectorAllocation(snap).map((s) => ({ name: s.sector, value: s.value })) : snap.holdings.map((h) => ({ name: h.symbol, value: h.marketValue }));
    // Fixed slot order; anything beyond 7 folds into "Other".
    const top = base.slice(0, 7);
    const other = base.slice(7).reduce((a, r) => a + r.value, 0);
    const all = other > 0 ? [...top, { name: "Other", value: other }] : top;
    return all.map((r, i) => ({ ...r, color: r.name === "Other" ? "var(--c8)" : SERIES[i] }));
  }, [snap, mode]);
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <Card className="h-full">
      <CardHeader icon={<PieIcon className="h-4 w-4" />} title="Allocation" subtitle="By market value" action={<Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "sector", label: "Sector" }, { value: "holding", label: "Holding" }]} />} />
      {rows.length === 0 ? (
        <EmptyState title="No open positions" body="Your allocation appears once you record a purchase." />
      ) : (
        <div className="grid items-center gap-4 px-5 pb-5 sm:grid-cols-[180px_1fr]">
          <Donut data={rows} height={180} center={<div><p className="text-[10px] uppercase tracking-wider text-subtle">Invested</p><p className="num text-sm font-semibold">{pkrCompact(total)}</p></div>} />
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center gap-2.5 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                <span className="min-w-0 flex-1 truncate text-muted">{r.name}</span>
                <span className="num font-medium">{pct(r.value / total, 1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function MoversWidget({ snap }: { snap: PortfolioSnapshot }) {
  const [by, setBy] = useState<"total" | "day">("total");
  const sorted = [...snap.holdings].sort((a, b) => (by === "total" ? b.unrealizedPct - a.unrealizedPct : b.dayChangePct - a.dayChangePct));
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse().filter((h) => !best.includes(h));
  const row = (h: (typeof sorted)[number]) => {
    const v = by === "total" ? h.unrealizedPct : h.dayChangePct;
    const hist = market.history(h.symbol).slice(-30).map((p) => p.close);
    return (
      <Link key={h.symbol} href={`/research?s=${h.symbol}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-[10px] font-bold">{h.symbol.slice(0, 4)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{h.symbol}</span>
          <span className="num block truncate text-[11px] text-muted">{by === "total" ? pkrSigned(h.unrealized) : pkrSigned(h.dayChange)}</span>
        </span>
        <Sparkline values={hist} className="hidden w-14 sm:block xl:hidden 2xl:block" />
        <Delta value={v} className="w-16 justify-end text-xs">{pct(v, 1, true)}</Delta>
      </Link>
    );
  };
  return (
    <Card className="h-full">
      <CardHeader icon={<TrendingUp className="h-4 w-4" />} title="Best & worst holdings" subtitle={by === "total" ? "Unrealized return vs. average cost" : "Change vs. previous close (demo)"} action={<Segmented size="sm" value={by} onChange={setBy} options={[{ value: "total", label: "Total" }, { value: "day", label: "Today" }]} />} />
      {snap.holdings.length === 0 ? <EmptyState title="No holdings yet" /> : (
        <div className="grid gap-x-4 px-3 pb-4 sm:grid-cols-2">
          <div><p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gain">Best</p>{best.map(row)}</div>
          <div><p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-loss">Worst</p>{worst.length ? worst.map(row) : <p className="px-2 text-xs text-muted">Add more holdings to compare.</p>}</div>
        </div>
      )}
    </Card>
  );
}

export function RiskWidget({ snap }: { snap: PortfolioSnapshot }) {
  const settings = useApp((s) => s.settings);
  const c = concentration(snap.holdings.map((h) => h.marketValue));
  const vols = snap.holdings.map((h) => annualizedVol(market.history(h.symbol).slice(-252).map((p) => p.close)));
  const vol = portfolioVolatility(snap.holdings.map((h) => h.marketValue), vols, 0.5);
  const breaches = snap.holdings.filter((h) => h.weight * 100 > settings.maxPositionPct).length + sectorAllocation(snap).filter((s) => s.weight * 100 > settings.maxSectorPct).length;
  const meter = (label: string, v: number, limit: number) => (
    <div>
      <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">{label}</span><span className="num font-medium">{pct(v, 1)} <span className="text-subtle">/ {limit}% limit</span></span></div>
      <Progress value={v / Math.max(limit / 100, 0.01) / 1.5} tone={v * 100 > limit ? "loss" : v * 100 > limit * 0.8 ? "amber" : "accent"} />
    </div>
  );
  const topSector = sectorAllocation(snap)[0];
  return (
    <Card className="h-full">
      <CardHeader icon={<Shield className="h-4 w-4" />} title="Risk summary" subtitle="Against your own limits in Settings" action={breaches ? <Badge tone="loss"><AlertTriangle className="h-3 w-3" />{breaches} limit{breaches > 1 ? "s" : ""}</Badge> : <Badge tone="gain"><CheckCircle2 className="h-3 w-3" />Within limits</Badge>} />
      <div className="space-y-4 px-5 pb-5">
        {meter("Largest position", c.top1, settings.maxPositionPct)}
        {topSector && meter(`Largest sector · ${topSector.sector}`, topSector.weight, settings.maxSectorPct)}
        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
          <Stat label="Top 3 weight" value={pct(c.top3, 0)} />
          <Stat label="Effective N" value={c.effectiveN ? c.effectiveN.toFixed(1) : "—"} info="1 ÷ Herfindahl index of position weights — the number of equal-sized positions with the same concentration." />
          <Stat label="Illustr. volatility" value={pct(vol, 0)} info="Annualised, from 1-year synthetic demo price history with an assumed 0.5 pairwise correlation. Educational illustration only." />
        </div>
      </div>
    </Card>
  );
}

export function WatchlistWidget() {
  const wl = useApp((s) => s.watchlists[0]);
  const quotes = useQuotes();
  return (
    <Card className="h-full">
      <CardHeader icon={<Star className="h-4 w-4" />} title={wl?.name ?? "Watchlist"} subtitle="Latest demo close" action={<Link href="/watchlists" className="text-xs font-medium text-accent hover:underline">Manage</Link>} />
      {!wl || wl.items.length === 0 ? (
        <EmptyState title="Your watchlist is empty" action={<Link href="/watchlists" className="text-xs font-medium text-accent">Add symbols →</Link>} />
      ) : (
        <ul className="px-3 pb-3">
          {wl.items.slice(0, 6).map((i) => {
            const q = quotes[i.symbol];
            const chg = q ? (q.price - q.prevClose) / q.prevClose : null;
            return (
              <li key={i.symbol}>
                <Link href={`/research?s=${i.symbol}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                  <span className="w-16 text-sm font-semibold">{i.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted">{i.note ?? ""}</span>
                  <Sparkline values={market.history(i.symbol).slice(-30).map((p) => p.close)} />
                  <span className="num w-20 text-right text-sm">{q ? fmtNum(q.price) : "—"}</span>
                  <Delta value={chg} className="w-16 justify-end text-xs">{pct(chg, 2, true)}</Delta>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function AlertsWidget() {
  const alerts = useApp((s) => s.alerts);
  const triggered = alerts.filter((a) => a.triggeredAt).sort((a, b) => b.triggeredAt! - a.triggeredAt!).slice(0, 4);
  const active = alerts.filter((a) => a.active).length;
  return (
    <Card className="h-full">
      <CardHeader icon={<BellRing className="h-4 w-4" />} title="Triggered alerts" subtitle={`${active} active · evaluated in-app against demo data`} action={<Link href="/watchlists" className="text-xs font-medium text-accent hover:underline">All alerts</Link>} />
      {triggered.length === 0 ? (
        <EmptyState title="No alerts triggered" body="Create price, % change, volume or concentration alerts in Watchlists." />
      ) : (
        <ul className="space-y-1 px-3 pb-4">
          {triggered.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-xl px-2 py-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{describeAlert(a)}</span>
                <span className="block text-[11px] text-muted">Observed {observedLabel(a, a.triggeredValue ?? 0)} · {fmtDateTime(a.triggeredAt!)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function EventsWidget({ snap }: { snap: PortfolioSnapshot }) {
  const events = useApp((s) => s.events);
  const dividends = useApp((s) => s.dividends);
  const held = new Set(snap.holdings.map((h) => h.symbol));
  const today = todayISO();
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 5);
  const declared = dividends.filter((d) => d.status !== "received");
  return (
    <Card className="h-full">
      <CardHeader icon={<CalendarDays className="h-4 w-4" />} title="Upcoming dividends & corporate actions" action={<Link href="/calendar" className="text-xs font-medium text-accent hover:underline">Calendar</Link>} />
      {upcoming.length === 0 && declared.length === 0 ? <EmptyState title="Nothing scheduled" body="Add events or dividend records in the Corporate Calendar." /> : (
        <ul className="space-y-1 px-3 pb-3">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="grid w-11 shrink-0 place-items-center rounded-lg border border-border py-1 text-center leading-tight">
                <span className="text-[9px] uppercase text-subtle">{fmtDate(e.date, { month: "short" })}</span>
                <span className="num text-sm font-semibold">{fmtDate(e.date, { day: "2-digit" })}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.symbol} · {e.type}</span>
                <span className="block truncate text-[11px] text-muted">{e.title}</span>
              </span>
              {e.symbol && held.has(e.symbol) && <Badge tone="accent">Held</Badge>}
              {e.origin === "demo" && <Badge tone="amber">Sample</Badge>}
            </li>
          ))}
          {declared.slice(0, 2).map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs">
              <span><span className="font-medium">{d.symbol}</span> <span className="text-muted">dividend · </span><Badge tone={d.status === "declared" ? "info" : "neutral"}>{d.status}</Badge></span>
              <span className="num font-medium">{pkr(d.dps * d.quantity * (1 - d.taxPct / 100))} net</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TodayWidget() {
  const today = todayISO();
  const plan = useApp((s) => s.plans[today]);
  const template = useApp((s) => s.settings.checklistTemplate);
  const updatePlan = useApp((s) => s.updatePlan);
  const checklist = plan?.checklist ?? template.map((t, i) => ({ id: `tmp-${i}`, text: t, done: false }));
  const tasks = plan?.tasks ?? [];
  const all = [...checklist, ...tasks];
  const done = all.filter((c) => c.done).length;
  const toggle = (id: string) => {
    const cur = useApp.getState().plans[today];
    if (!cur) {
      updatePlan(today, {});
      const fresh = useApp.getState().plans[today]!;
      const idx = checklist.findIndex((c) => c.id === id);
      updatePlan(today, { checklist: fresh.checklist.map((c, i) => (i === idx ? { ...c, done: !c.done } : c)) });
      return;
    }
    updatePlan(today, { checklist: cur.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)), tasks: cur.tasks.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  };
  return (
    <Card className="h-full">
      <CardHeader icon={<ListChecks className="h-4 w-4" />} title="Today's plan" subtitle={`${done} of ${all.length} complete`} action={<Link href="/workspace" className="text-xs font-medium text-accent hover:underline">Open workspace</Link>} />
      <div className="px-5"><Progress value={all.length ? done / all.length : 0} /></div>
      <ul className="space-y-0.5 px-3 py-3">
        {all.slice(0, 6).map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <input type="checkbox" checked={c.done} onChange={() => toggle(c.id)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" />
              <span className={cn("text-[13px]", c.done && "text-subtle line-through")}>{c.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function InsightsWidget({ snap }: { snap: PortfolioSnapshot }) {
  const settings = useApp((s) => s.settings);
  const events = useApp((s) => s.events);
  const items = portfolioInsights(snap, settings, events).slice(0, 5);
  return (
    <Card className="h-full">
      <CardHeader icon={<Lightbulb className="h-4 w-4" />} title="Portfolio insights" subtitle="Rule-based checks on your own records" action={<Link href="/assistant" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Sparkles className="h-3.5 w-3.5" /> Ask assistant</Link>} />
      {items.length === 0 ? <EmptyState title="No issues detected" body="Everything is within your configured limits." /> : (
        <ul className="space-y-1 px-3 pb-4">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={i.href ?? "#"} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.severity === "high" ? "bg-loss" : i.severity === "medium" ? "bg-amber" : "bg-info")} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{i.title}</span>
                  <span className="block text-[11px] leading-relaxed text-muted">{i.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function BehaviorWidget() {
  const journal = useApp((s) => s.journal);
  const opts = useApp((s) => s.settings.behavior);
  const b = useMemo(() => behaviorAnalytics(journal, opts), [journal, opts]);
  const weeks = b.weekly.slice(-10).map((w) => ({ week: w.week.slice(5), planned: w.trades - w.unplanned, unplanned: w.unplanned }));
  return (
    <Card>
      <CardHeader icon={<Brain className="h-4 w-4" />} title="Trading behavior snapshot" subtitle="From your trade journal — for self-reflection, not diagnosis" action={<Link href="/behavior" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">Behavior Studio <ArrowRight className="h-3 w-3" /></Link>} />
      {b.total === 0 ? <EmptyState title="No journal entries yet" body="Log trades in the journal to see plan adherence and patterns." /> : (
        <div className="grid gap-6 px-5 pb-5 md:grid-cols-[280px_1fr]">
          <div className="grid grid-cols-2 gap-4 self-start">
            <Stat label="Plan adherence" value={pct(b.planAdherence, 0)} />
            <Stat label="Risk rules kept" value={pct(b.riskRuleAdherence, 0)} />
            <Stat label="Impulsive entries" value={pct(b.impulsiveRate, 0)} />
            <Stat label="Possible loss-chasing" value={b.lossChasing.length} sub={<span className="text-muted">instances</span>} />
          </div>
          <div>
            <PlainBarChart data={weeks} xKey="week" stacked height={170} bars={[{ key: "planned", label: "Planned", color: "var(--c3)" }, { key: "unplanned", label: "Unplanned", color: "var(--c4)" }]} />
            <Legend className="mt-2" items={[{ label: "Planned trades", color: "var(--c3)" }, { label: "Unplanned trades", color: "var(--c4)" }]} />
          </div>
        </div>
      )}
    </Card>
  );
}
