"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BellRing, CalendarDays, ClipboardCheck, Copy, Crosshair, ListTodo, Moon, NotebookPen, Plus, Sun, Sunrise, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, Delta, EmptyState, Input, Notice, NumberInput, PageHeader, Progress, SourceNote, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import type { ChecklistItem, DailyPlan } from "@/store/types";
import { useQuotes, useSnapshot } from "@/lib/hooks";
import { portfolioInsights } from "@/lib/insights";
import { describeAlert, observedLabel } from "@/lib/alerts";
import { market } from "@/lib/market/demo-provider";
import { tradePnl } from "@/lib/finance/journal";
import { addDays, fmtDate, fmtDateTime, fmtInt, fmtNum, pct, pkr, pkrSigned, todayISO } from "@/lib/format";
import { uid, cn } from "@/lib/utils";

type Phase = "before" | "during" | "after";

function usePlan(date: string): DailyPlan {
  const plan = useApp((s) => s.plans[date]);
  const template = useApp((s) => s.settings.checklistTemplate);
  return useMemo(() => plan ?? { date, checklist: template.map((text, i) => ({ id: `tpl-${i}`, text, done: false })), tasks: [], levels: [], plan: "", notes: "", recap: "", nextSession: [] }, [plan, template, date]);
}

export default function WorkspacePage() {
  const params = useSearchParams();
  const h = new Date().getHours();
  const [phase, setPhase] = useState<Phase>((params.get("tab") as Phase) || (h < 9 ? "before" : h < 16 ? "during" : "after"));
  const [date, setDate] = useState(todayISO());
  useEffect(() => { const t = params.get("tab") as Phase | null; if (t) setPhase(t); }, [params]);
  const plan = usePlan(date);
  const updatePlan = useApp((s) => s.updatePlan);
  const patch = (p: Partial<DailyPlan>) => {
    // Materialise template ids on first write.
    if (!useApp.getState().plans[date]) updatePlan(date, { ...plan, ...p });
    else updatePlan(date, p);
  };

  return (
    <>
      <PageHeader
        title="Daily Workspace"
        description="Your routine for each session: prepare, stay disciplined, review."
        actions={<div className="flex items-center gap-2"><Button size="icon" variant="ghost" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</Button><Input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 w-40" aria-label="Workspace date" /><Button size="icon" variant="ghost" aria-label="Next day" disabled={date >= todayISO()} onClick={() => setDate(addDays(date, 1))}>›</Button></div>}
      />
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-1.5 sm:w-fit">
        {([["before", "Before market", Sunrise], ["during", "During market", Sun], ["after", "After market", Moon]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setPhase(k)} aria-pressed={phase === k} className={cn("flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition", phase === k ? "bg-accent/12 text-fg ring-1 ring-accent/30" : "text-muted hover:text-fg")}>
            <I className={cn("h-4 w-4", phase === k && "text-accent")} /><span className="hidden sm:inline">{l}</span><span className="sm:hidden">{l.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      {phase === "before" && <Before plan={plan} patch={patch} />}
      {phase === "during" && <During plan={plan} patch={patch} />}
      {phase === "after" && <After plan={plan} patch={patch} date={date} />}
    </>
  );
}

function Checklist({ title, icon, items, onChange, placeholder }: { title: string; icon: React.ReactNode; items: ChecklistItem[]; onChange: (i: ChecklistItem[]) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const done = items.filter((i) => i.done).length;
  return (
    <Card className="h-full">
      <CardHeader icon={icon} title={title} subtitle={`${done}/${items.length} done`} />
      <div className="px-5"><Progress value={items.length ? done / items.length : 0} /></div>
      <ul className="space-y-0.5 px-3 py-3">
        {items.map((c) => (
          <li key={c.id} className="group flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
            <input type="checkbox" checked={c.done} onChange={() => onChange(items.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" aria-label={c.text} />
            <span className={cn("flex-1 text-[13px]", c.done && "text-subtle line-through")}>{c.text}</span>
            <button aria-label="Remove" onClick={() => onChange(items.filter((x) => x.id !== c.id))} className="text-subtle opacity-0 hover:text-loss group-hover:opacity-100 focus:opacity-100"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
        {!items.length && <li className="px-2 py-2 text-xs text-muted">Nothing yet.</li>}
      </ul>
      <form className="flex gap-2 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onChange([...items, { id: uid("c-"), text: text.trim(), done: false }]); setText(""); } }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={160} aria-label={placeholder} className="h-9" />
        <Button type="submit" size="sm" variant="secondary"><Plus className="h-4 w-4" /></Button>
      </form>
    </Card>
  );
}

function Before({ plan, patch }: { plan: DailyPlan; patch: (p: Partial<DailyPlan>) => void }) {
  const snap = useSnapshot();
  const settings = useApp((s) => s.settings);
  const events = useApp((s) => s.events);
  const lists = useApp((s) => s.watchlists);
  const quotes = useQuotes();
  const insights = portfolioInsights(snap, settings, events).filter((i) => i.severity !== "info");
  const relevant = new Set([...snap.holdings.map((h) => h.symbol), ...lists.flatMap((l) => l.items.map((i) => i.symbol))]);
  const today = todayISO();
  const upcoming = events.filter((e) => e.date >= today && e.date <= addDays(today, 7)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const [lv, setLv] = useState({ symbol: "", price: 0, note: "" });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-1"><Checklist title="Daily checklist" icon={<ClipboardCheck className="h-4 w-4" />} items={plan.checklist} onChange={(checklist) => patch({ checklist })} placeholder="Add checklist item" /></div>
      <div className="lg:col-span-1"><Checklist title="Planned research tasks" icon={<ListTodo className="h-4 w-4" />} items={plan.tasks} onChange={(tasks) => patch({ tasks })} placeholder="e.g. Read LUCK quarterly report" /></div>
      <Card className="lg:col-span-1">
        <CardHeader icon={<BellRing className="h-4 w-4" />} title="Concentration & risk warnings" />
        {insights.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No warnings against your limits.</p> : (
          <ul className="space-y-2 px-5 pb-5">{insights.slice(0, 5).map((i) => <li key={i.id} className={cn("rounded-xl border px-3 py-2 text-xs", i.severity === "high" ? "border-loss/25 bg-loss/[.05]" : "border-amber/25 bg-amber/[.05]")}><p className="font-medium text-fg">{i.title}</p><p className="mt-0.5 text-muted">{i.body}</p></li>)}</ul>
        )}
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader icon={<Crosshair className="h-4 w-4" />} title="Important price levels" subtitle="Your own levels, with distance from the latest (demo) close" />
        <form className="grid gap-2 px-5 pb-3 sm:grid-cols-[110px_130px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (!lv.symbol || !(lv.price > 0)) return toast.error("Symbol and price required"); patch({ levels: [...plan.levels, { id: uid("lv-"), symbol: lv.symbol.toUpperCase(), price: lv.price, note: lv.note }] }); setLv({ symbol: "", price: 0, note: "" }); }}>
          <Input value={lv.symbol} onChange={(e) => setLv({ ...lv, symbol: e.target.value.toUpperCase() })} placeholder="Symbol" aria-label="Level symbol" className="h-9" />
          <NumberInput value={lv.price} onChange={(v) => setLv({ ...lv, price: v })} aria-label="Level price" className="h-9" prefix="Rs" />
          <Input value={lv.note} onChange={(e) => setLv({ ...lv, note: e.target.value })} placeholder="Why this level matters" aria-label="Level note" className="h-9" />
          <Button type="submit" size="sm" variant="secondary"><Plus className="h-4 w-4" />Add</Button>
        </form>
        {plan.levels.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No levels for this day.</p> : (
          <div className="overflow-x-auto px-2 pb-3">
            <table className="table-base"><thead><tr><th>Symbol</th><th className="text-right">Level</th><th className="text-right">Last (demo)</th><th className="text-right">Distance</th><th>Note</th><th /></tr></thead>
              <tbody className="num">{plan.levels.map((l) => { const q = quotes[l.symbol]; const d = q ? (l.price - q.price) / q.price : null; return <tr key={l.id}><td className="font-medium">{l.symbol}</td><td className="text-right">{fmtNum(l.price)}</td><td className="text-right">{q ? fmtNum(q.price) : "—"}</td><td className="text-right">{d !== null ? pct(d, 2, true) : "—"}</td><td className="text-xs text-muted">{l.note}</td><td className="text-right"><button aria-label="Remove level" onClick={() => patch({ levels: plan.levels.filter((x) => x.id !== l.id) })} className="text-subtle hover:text-loss"><Trash2 className="h-4 w-4" /></button></td></tr>; })}</tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader icon={<CalendarDays className="h-4 w-4" />} title="Next 7 days" subtitle="Events for holdings & watchlists" action={<Link href="/calendar" className="text-xs text-accent hover:underline">Calendar</Link>} />
        {upcoming.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No events scheduled.</p> : (
          <ul className="space-y-1 px-3 pb-3">{upcoming.map((e) => <li key={e.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs"><span className="num w-14 text-subtle">{fmtDate(e.date, { day: "2-digit", month: "short" })}</span><span className="flex-1"><span className="font-medium">{e.symbol}</span> · {e.type}</span>{e.symbol && relevant.has(e.symbol) && <Badge tone="accent">relevant</Badge>}{e.origin === "demo" && <Badge tone="amber">sample</Badge>}</li>)}</ul>
        )}
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader title="Corporate announcements" subtitle="Official PSX announcements feed" />
        <div className="px-5 pb-5"><Notice tone="info" title="Not connected">PSX Pilot does not scrape announcement sources. An authorised announcements feed is needed to show filings for your holdings here. Meanwhile, add important announcements you read to the Corporate Calendar.</Notice></div>
      </Card>
    </div>
  );
}

function During({ plan, patch }: { plan: DailyPlan; patch: (p: Partial<DailyPlan>) => void }) {
  const snap = useSnapshot();
  const quotes = useQuotes();
  const lists = useApp((s) => s.watchlists);
  const alerts = useApp((s) => s.alerts);
  const watch = [...new Set(lists.flatMap((l) => l.items.map((i) => i.symbol)))].filter((s) => quotes[s]);
  const triggered = alerts.filter((a) => a.triggeredAt && Date.now() - a.triggeredAt < 864e5);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Watchlist movements" subtitle="Sorted by absolute change" action={<Badge tone="amber">Demo data · not live</Badge>} />
        <div className="overflow-x-auto px-2">
          <table className="table-base"><thead><tr><th>Symbol</th><th className="text-right">Last</th><th className="text-right">Change</th><th className="text-right">Volume</th></tr></thead>
            <tbody className="num">{watch.map((s) => quotes[s]).sort((a, b) => Math.abs((b.price - b.prevClose) / b.prevClose) - Math.abs((a.price - a.prevClose) / a.prevClose)).map((q) => <tr key={q.symbol}><td className="font-medium"><Link href={`/research?s=${q.symbol}`} className="hover:text-accent">{q.symbol}</Link></td><td className="text-right">{fmtNum(q.price)}</td><td className="text-right"><Delta value={q.price - q.prevClose}>{pct((q.price - q.prevClose) / q.prevClose, 2, true)}</Delta></td><td className="text-right">{fmtInt(q.volume)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="px-5 py-3"><SourceNote source={market.label} asOf={fmtDate(market.asOf())} /></div>
      </Card>
      <Card>
        <CardHeader icon={<BellRing className="h-4 w-4" />} title="Triggered alerts (24h)" />
        {triggered.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">None.</p> : <ul className="space-y-1 px-3 pb-3">{triggered.map((a) => <li key={a.id} className="rounded-xl px-2 py-2 text-xs"><p className="font-medium">{describeAlert(a)}</p><p className="text-subtle">Observed {observedLabel(a, a.triggeredValue ?? 0)} · {fmtDateTime(a.triggeredAt!)}</p></li>)}</ul>}
      </Card>
      <Card>
        <CardHeader icon={<NotebookPen className="h-4 w-4" />} title="Today's trading plan" subtitle="Saved automatically" />
        <div className="px-5 pb-5"><Textarea rows={7} value={plan.plan} onChange={(e) => patch({ plan: e.target.value })} placeholder="Setups I'm watching, max trades today, max loss for the day, conditions where I don't trade…" aria-label="Trading plan" /></div>
      </Card>
      <Card>
        <CardHeader icon={<NotebookPen className="h-4 w-4" />} title="Quick notes" subtitle="Saved automatically" />
        <div className="px-5 pb-5"><Textarea rows={7} value={plan.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Observations during the session…" aria-label="Quick notes" /></div>
      </Card>
      <Card>
        <CardHeader title="Portfolio changes" subtitle={<>Today: <Delta value={snap.dayChange}>{pkrSigned(snap.dayChange)}</Delta></>} />
        <ul className="px-3 pb-3">{[...snap.holdings].sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange)).slice(0, 7).map((h) => <li key={h.symbol} className="flex justify-between rounded-lg px-2 py-1.5 text-xs"><span className="font-medium">{h.symbol}</span><Delta value={h.dayChange} icon={false} className="num">{pkrSigned(h.dayChange)} ({pct(h.dayChangePct, 1, true)})</Delta></li>)}</ul>
      </Card>
    </div>
  );
}

function After({ plan, patch, date }: { plan: DailyPlan; patch: (p: Partial<DailyPlan>) => void; date: string }) {
  const snap = useSnapshot();
  const txs = useApp((s) => s.transactions);
  const pfId = useApp((s) => s.activePortfolioId);
  const journal = useApp((s) => s.journal);
  const updatePlan = useApp((s) => s.updatePlan);
  const dayTx = txs.filter((t) => t.portfolioId === pfId && t.date === date);
  const dayRealized = snap.realizedEvents.filter((e) => e.date === date).reduce((a, e) => a + e.pnl, 0);
  const dayJournal = journal.filter((j) => j.entryDate === date || j.exitDate === date);
  const ruleBreaks = dayJournal.filter((j) => !j.riskRespected || !j.followedPlan);
  const unjournaled = dayTx.filter((t) => (t.type === "BUY" || t.type === "SELL") && !journal.some((j) => j.symbol === t.symbol && (j.entryDate === date || j.exitDate === date)));
  const pending = [...plan.checklist, ...plan.tasks].filter((c) => !c.done);
  const recap = `Daily recap — ${fmtDate(date)}\nPortfolio change vs. previous close (demo prices): ${pkrSigned(snap.dayChange)} (${pct(snap.dayChangePct, 2, true)}).\nTransactions recorded: ${dayTx.length}. Realized P/L: ${pkrSigned(dayRealized)}.\nJournal entries: ${dayJournal.length}${ruleBreaks.length ? `, ${ruleBreaks.length} with a plan/risk-rule deviation` : ""}.\nChecklist: ${plan.checklist.filter((c) => c.done).length}/${plan.checklist.length}. Pending items: ${pending.length}.`;
  const carry = () => {
    const tomorrow = addDays(date, 1);
    const st = useApp.getState();
    if (!st.plans[tomorrow]) updatePlan(tomorrow, {});
    const t = useApp.getState().plans[tomorrow]!;
    const add = [...plan.nextSession.filter((c) => !c.done), ...plan.tasks.filter((c) => !c.done)].map((c) => ({ ...c, id: uid("c-"), done: false }));
    updatePlan(tomorrow, { tasks: [...t.tasks, ...add] });
    toast.success(`${add.length} item(s) carried to ${fmtDate(tomorrow)}`);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Daily portfolio recap" action={<Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(recap); toast.success("Recap copied"); }}><Copy className="h-4 w-4" />Copy</Button>} />
        <div className="grid grid-cols-2 gap-4 px-5 pb-4 sm:grid-cols-4">
          <div><p className="text-xs text-muted">Day change</p><p className="num mt-1 text-lg font-semibold"><Delta value={snap.dayChange} icon={false}>{pkrSigned(snap.dayChange)}</Delta></p><Badge tone="amber">demo</Badge></div>
          <div><p className="text-xs text-muted">Realized today</p><p className="num mt-1 text-lg font-semibold"><Delta value={dayRealized} icon={false}>{pkrSigned(dayRealized)}</Delta></p></div>
          <div><p className="text-xs text-muted">Portfolio value</p><p className="num mt-1 text-lg font-semibold">{pkr(snap.totalValue)}</p></div>
          <div><p className="text-xs text-muted">Transactions</p><p className="num mt-1 text-lg font-semibold">{dayTx.length}</p></div>
        </div>
        <pre className="mx-5 mb-5 whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-sans text-[13px] leading-relaxed text-muted">{recap}</pre>
      </Card>
      <Card>
        <CardHeader title="Risk-rule review" />
        <div className="space-y-2 px-5 pb-5 text-sm">
          {dayJournal.length === 0 ? <p className="text-muted">No journal entries for this day.</p> : dayJournal.map((j) => <div key={j.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs"><span className="font-medium">{j.symbol}</span><span className="flex gap-1">{j.followedPlan ? <Badge tone="gain">plan ✓</Badge> : <Badge tone="amber">unplanned</Badge>}{j.riskRespected ? <Badge tone="gain">risk ✓</Badge> : <Badge tone="loss">risk ✗</Badge>}</span><span className="num">{tradePnl(j) !== null ? pkrSigned(tradePnl(j)) : "open"}</span></div>)}
          {unjournaled.length > 0 && <Notice tone="amber" title={`${unjournaled.length} trade(s) not journaled`} action={<Link href="/journal?new=1"><Button size="sm" variant="outline">Journal now</Button></Link>}>{unjournaled.map((t) => `${t.type} ${t.symbol}`).join(", ")}</Notice>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Trades recorded" />
        {dayTx.length === 0 ? <EmptyState title="No transactions on this day" /> : <ul className="px-3 pb-3">{dayTx.map((t) => <li key={t.id} className="flex justify-between rounded-lg px-2 py-1.5 text-xs"><span><Badge>{t.type}</Badge> <span className="font-medium">{t.symbol}</span></span><span className="num">{t.quantity ? `${fmtInt(t.quantity)} @ ${fmtNum(t.price)}` : pkr(t.amount)}</span></li>)}</ul>}
      </Card>
      <Card>
        <CardHeader title="Pending tasks" subtitle={`${pending.length} unfinished`} />
        <ul className="space-y-1 px-5 pb-5 text-xs text-muted">{pending.slice(0, 8).map((p) => <li key={p.id}>• {p.text}</li>)}{!pending.length && <li>All done 🎉</li>}</ul>
      </Card>
      <div>
        <Checklist title="Next-session preparation" icon={<ArrowRight className="h-4 w-4" />} items={plan.nextSession} onChange={(nextSession) => patch({ nextSession })} placeholder="Prepare for tomorrow…" />
        <Button className="mt-3 w-full" size="sm" variant="outline" onClick={carry}>Carry unfinished items to next day</Button>
      </div>
      <Card className="lg:col-span-3">
        <CardHeader title="Session reflection" subtitle="How did today go? Saved automatically" />
        <div className="px-5 pb-5"><Textarea rows={4} value={plan.recap} onChange={(e) => patch({ recap: e.target.value })} placeholder="What did I do well? Where did I deviate from my plan? What will I do differently next session?" aria-label="Session reflection" /></div>
      </Card>
    </div>
  );
}
