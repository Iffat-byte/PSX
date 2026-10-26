"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, LayoutGrid, Maximize2, Minimize2, Plus, RotateCcw, Sparkles } from "lucide-react";
import { Button, Card, DemoBadge, Delta, Notice, PageHeader } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { TransactionForm } from "@/components/transaction-form";
import * as W from "@/components/dashboard/widgets";
import { DEFAULT_DASHBOARD, useApp, selectActivePortfolio } from "@/store/app-store";
import type { WidgetConfig, WidgetId } from "@/store/types";
import { useSnapshot } from "@/lib/hooks";
import { portfolioInsights } from "@/lib/insights";
import { behaviorAnalytics } from "@/lib/finance/behavior";
import { fmtDate, pct, pkrSigned } from "@/lib/format";
import { cn } from "@/lib/utils";

const TITLES: Record<WidgetId, string> = {
  kpis: "Key figures",
  "value-history": "Portfolio value history",
  allocation: "Allocation",
  movers: "Best & worst holdings",
  risk: "Risk summary",
  watchlist: "Watchlist",
  alerts: "Triggered alerts",
  events: "Dividends & corporate actions",
  today: "Today's plan",
  insights: "Portfolio insights",
  behavior: "Behavior snapshot",
};

export default function Dashboard() {
  const snap = useSnapshot();
  const pf = useApp(selectActivePortfolio);
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const hasDemo = useApp((s) => s.hasDemoData);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<WidgetId | null>(null);
  const layout = settings.dashboard;

  const setLayout = (l: WidgetConfig[]) => update({ dashboard: l });
  const move = (id: WidgetId, dir: -1 | 1) => {
    const i = layout.findIndex((w) => w.id === id);
    const j = i + dir;
    if (j < 0 || j >= layout.length) return;
    const next = [...layout];
    [next[i], next[j]] = [next[j], next[i]];
    setLayout(next);
  };
  const patch = (id: WidgetId, p: Partial<WidgetConfig>) => setLayout(layout.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const drop = (target: WidgetId) => {
    if (!dragId || dragId === target) return;
    const next = layout.filter((w) => w.id !== dragId);
    const idx = next.findIndex((w) => w.id === target);
    next.splice(idx, 0, layout.find((w) => w.id === dragId)!);
    setLayout(next);
    setDragId(null);
  };

  const render = (id: WidgetId) => {
    switch (id) {
      case "kpis": return <W.KpiWidget snap={snap} />;
      case "value-history": return <W.ValueHistoryWidget />;
      case "allocation": return <W.AllocationWidget snap={snap} />;
      case "movers": return <W.MoversWidget snap={snap} />;
      case "risk": return <W.RiskWidget snap={snap} />;
      case "watchlist": return <W.WatchlistWidget />;
      case "alerts": return <W.AlertsWidget />;
      case "events": return <W.EventsWidget snap={snap} />;
      case "today": return <W.TodayWidget />;
      case "insights": return <W.InsightsWidget snap={snap} />;
      case "behavior": return <W.BehaviorWidget />;
    }
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greet}, ${settings.userName}`}
        description={<>Command center for <span className="font-medium text-fg">{pf.name}</span>{pf.kind === "paper" && " (paper)"} · {fmtDate(new Date().toISOString())}</>}
        badge={hasDemo ? <DemoBadge /> : undefined}
        actions={
          <>
            <Button variant={editing ? "primary" : "outline"} size="sm" onClick={() => setEditing((e) => !e)}><LayoutGrid className="h-4 w-4" />{editing ? "Done" : "Customize"}</Button>
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Transaction</Button>
          </>
        }
      />

      {hasDemo && (
        <Notice tone="amber" className="mb-5" title="You're viewing demo data" action={<Link href="/settings#data"><Button size="sm" variant="outline">Manage demo data</Button></Link>}>
          Portfolios, events and journal entries are illustrative, and prices are synthetic — not PSX market data.
        </Notice>
      )}

      <ThreeQuestions snap={snap} />

      {editing && (
        <Card className="mb-4 flex flex-wrap items-center gap-2 border-dashed p-3 text-xs text-muted">
          <span className="mr-1">Drag widgets or use the arrows to reorder. Hidden:</span>
          {layout.filter((w) => !w.visible).length === 0 && <span className="text-subtle">none</span>}
          {layout.filter((w) => !w.visible).map((w) => (
            <Button key={w.id} size="sm" variant="secondary" onClick={() => patch(w.id, { visible: true })}><Eye className="h-3.5 w-3.5" />{TITLES[w.id]}</Button>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setLayout(DEFAULT_DASHBOARD); toast.success("Dashboard layout reset"); }}><RotateCcw className="h-3.5 w-3.5" />Reset layout</Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {layout.filter((w) => w.visible).map((w, i, arr) => (
          <section
            key={w.id}
            aria-label={TITLES[w.id]}
            className={cn("relative min-w-0", w.size === "full" && "xl:col-span-2", editing && "rounded-2xl ring-2 ring-dashed ring-accent/30", dragId === w.id && "opacity-50")}
            draggable={editing}
            onDragStart={() => setDragId(w.id)}
            onDragOver={(e) => editing && e.preventDefault()}
            onDrop={() => drop(w.id)}
            onDragEnd={() => setDragId(null)}
          >
            {editing && (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-xl border border-border bg-surface-2/95 p-1 shadow-pop backdrop-blur">
                <span className="cursor-grab px-1 text-subtle" title="Drag to reorder"><GripVertical className="h-4 w-4" /></span>
                <IconBtn label="Move up" onClick={() => move(w.id, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn label="Move down" onClick={() => move(w.id, 1)} disabled={i === arr.length - 1}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn label={w.size === "full" ? "Make half width" : "Make full width"} onClick={() => patch(w.id, { size: w.size === "full" ? "half" : "full" })}>{w.size === "full" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</IconBtn>
                <IconBtn label="Hide widget" onClick={() => patch(w.id, { visible: false })}><EyeOff className="h-3.5 w-3.5" /></IconBtn>
              </div>
            )}
            {render(w.id)}
          </section>
        ))}
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-subtle">
        PSX Pilot is an educational and record-keeping tool. Figures are calculated from the transactions you record and the configured data source. Nothing here is investment advice.
      </p>

      <TransactionForm open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30">
      {children}
    </button>
  );
}

function ThreeQuestions({ snap }: { snap: ReturnType<typeof useSnapshot> }) {
  const settings = useApp((s) => s.settings);
  const events = useApp((s) => s.events);
  const alerts = useApp((s) => s.alerts);
  const journal = useApp((s) => s.journal);
  const txs = useApp((s) => s.transactions);
  const pfId = useApp((s) => s.activePortfolioId);
  const insights = useMemo(() => portfolioInsights(snap, settings, events), [snap, settings, events]);
  const b = useMemo(() => behaviorAnalytics(journal, settings.behavior), [journal, settings.behavior]);
  const recentTx = txs.filter((t) => t.portfolioId === pfId).sort((a, b) => b.createdAt - a.createdAt)[0];
  const attention = insights.filter((i) => i.severity !== "info").length;
  const triggered = alerts.filter((a) => a.triggeredAt && Date.now() - a.triggeredAt < 7 * 864e5).length;
  const lesson = [...journal].filter((j) => j.lessons).sort((a, b) => b.createdAt - a.createdAt)[0];

  const cards = [
    {
      q: "What changed?",
      body: (
        <>
          Portfolio <Delta value={snap.dayChange}>{pkrSigned(snap.dayChange)} ({pct(snap.dayChangePct, 2, true)})</Delta> vs. previous close.{" "}
          {triggered > 0 ? `${triggered} alert${triggered > 1 ? "s" : ""} triggered this week.` : "No alerts triggered this week."}
          {recentTx && <> Last entry: {recentTx.type.toLowerCase()} {recentTx.symbol ?? ""} on {fmtDate(recentTx.date)}.</>}
        </>
      ),
      href: "/workspace?tab=after",
      cta: "Daily recap",
    },
    {
      q: "What needs my attention?",
      body: attention ? <>{attention} item{attention > 1 ? "s" : ""} flagged against your limits — top: <span className="text-fg">{insights[0].title}</span>.</> : <>Nothing flagged against your limits. {insights.length} informational note{insights.length === 1 ? "" : "s"}.</>,
      href: "/workspace",
      cta: "Before-market prep",
    },
    {
      q: "What can I learn?",
      body: b.total ? <>Plan adherence {pct(b.planAdherence, 0)}{b.planned.winRate !== null && b.unplanned.winRate !== null && <> — planned trades won {pct(b.planned.winRate, 0)} vs. {pct(b.unplanned.winRate, 0)} unplanned</>}. {lesson && <>Latest lesson: “{lesson.lessons}”</>}</> : <>Start journaling trades to surface patterns in your decisions.</>,
      href: "/behavior",
      cta: "Behavior Studio",
    },
  ];
  return (
    <div className="mb-4 grid gap-4 md:grid-cols-3">
      {cards.map((c, i) => (
        <Card key={c.q} className="group relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/5 blur-2xl transition group-hover:bg-accent/10" />
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent"><Sparkles className="h-3.5 w-3.5" />Question {i + 1}</p>
          <h2 className="mt-1.5 text-base font-semibold tracking-tight">{c.q}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.body}</p>
          <Link href={c.href} className="mt-3 inline-flex text-xs font-medium text-accent hover:underline">{c.cta} →</Link>
        </Card>
      ))}
    </div>
  );
}
