"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpenText, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, Delta, DemoBadge, EmptyState, Input, Notice, PageHeader, Segmented, Select, Stat } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { TradeForm } from "@/components/journal/trade-form";
import { SignedBarChart, TimeSeriesChart, Legend } from "@/components/charts";
import { useApp } from "@/store/app-store";
import type { JournalTrade } from "@/lib/finance/types";
import { holdingDays, isClosed, journalStats, MIN_SAMPLE_FOR_EXPECTANCY, MIN_SAMPLE_FOR_RATIOS, rMultiple, tradePnl, tradeReturnPct } from "@/lib/finance/journal";
import { downloadFile, toCSV } from "@/lib/utils";
import { fmtDate, fmtInt, fmtNum, pct, pkr, pkrSigned, todayISO } from "@/lib/format";

export default function JournalPage() {
  const journal = useApp((s) => s.journal);
  const del = useApp((s) => s.deleteTrade);
  const upsert = useApp((s) => s.upsertTrade);
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalTrade | null>(null);
  const [view, setView] = useState<"entries" | "analytics">("entries");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "win" | "loss">("all");
  const [tag, setTag] = useState("");
  const [from, setFrom] = useState("");

  useEffect(() => {
    if (params.get("new")) { setEditing(null); setOpen(true); router.replace("/journal"); }
  }, [params, router]);

  const tags = useMemo(() => [...new Set(journal.flatMap((t) => t.tags))].sort(), [journal]);
  const filtered = useMemo(
    () =>
      journal
        .filter((t) => {
          const p = tradePnl(t);
          if (status === "open" && isClosed(t)) return false;
          if (status === "win" && !(p !== null && p > 0)) return false;
          if (status === "loss" && !(p !== null && p < 0)) return false;
          if (tag && !t.tags.includes(tag)) return false;
          if (from && t.entryDate < from) return false;
          const hay = `${t.symbol} ${t.strategy ?? ""} ${t.entryReason} ${t.lessons ?? ""} ${t.notes ?? ""}`.toLowerCase();
          return !q || hay.includes(q.toLowerCase());
        })
        .sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1)),
    [journal, q, status, tag, from],
  );
  const stats = useMemo(() => journalStats(filtered), [filtered]);

  const exportCsv = () => {
    downloadFile(`psx-pilot-journal-${todayISO()}.csv`, toCSV(filtered.map((t) => ({ symbol: t.symbol, side: t.side, entry_date: t.entryDate, entry_price: t.entryPrice, quantity: t.quantity, exit_date: t.exitDate ?? "", exit_price: t.exitPrice ?? "", fees: t.fees, net_pnl: tradePnl(t)?.toFixed(2) ?? "", r_multiple: rMultiple(t)?.toFixed(2) ?? "", strategy: t.strategy ?? "", tags: t.tags.join(" "), confidence: t.confidence, emotion_entry: t.emotionEntry, followed_plan: t.followedPlan, risk_respected: t.riskRespected, impulsive: t.impulsive, entry_reason: t.entryReason, exit_reason: t.exitReason ?? "", lessons: t.lessons ?? "" }))));
    toast.success(`Exported ${filtered.length} entries`);
  };

  return (
    <>
      <PageHeader
        title="Trade Journal"
        description="Record entries, exits, reasoning and lessons. Metrics only appear when there is enough data to be meaningful."
        badge={journal.some((t) => t.id.startsWith("jr-demo-")) ? <DemoBadge /> : undefined}
        actions={<><Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4" />Export</Button><Button variant="primary" size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" />New entry</Button></>}
      />

      <Card className="mb-4 grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Closed / open" value={`${stats.closed} / ${stats.open}`} />
        <Stat label="Net P/L (closed)" value={<Delta value={stats.net} icon={false}>{pkrSigned(stats.net)}</Delta>} />
        <Stat label="Win rate" value={stats.closed ? pct(stats.winRate, 0) : "—"} sub={<span className="text-muted">{stats.wins}W · {stats.losses}L</span>} />
        <Stat label="Profit factor" value={stats.ratiosReliable ? (stats.profitFactor === null ? "∞ (no losses)" : fmtNum(stats.profitFactor, 2)) : "—"} sub={!stats.ratiosReliable ? <span className="text-subtle">Needs {MIN_SAMPLE_FOR_RATIOS}+ closed trades</span> : undefined} info="Gross profits ÷ gross losses of closed trades." />
        <Stat label="Expectancy / trade" value={stats.expectancyReliable ? <Delta value={stats.expectancy} icon={false}>{pkrSigned(stats.expectancy)}</Delta> : "—"} sub={!stats.expectancyReliable ? <span className="text-subtle">Needs {MIN_SAMPLE_FOR_EXPECTANCY}+ closed trades ({stats.closed} now)</span> : undefined} info="Average net result per closed trade. Small samples are dominated by luck, so it is hidden until the sample is larger." />
        <Stat label="Max drawdown" value={stats.closed ? <span className="text-loss">{pkr(stats.maxDrawdown)}</span> : "—"} info="Largest fall of cumulative closed-trade P/L from its previous peak." />
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={setView} options={[{ value: "entries", label: "Entries" }, { value: "analytics", label: "Analytics" }]} />
        <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_140px_150px_150px]">
          <Input placeholder="Search symbol, strategy, notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search journal" />
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status"><option value="all">All trades</option><option value="open">Open</option><option value="win">Winners</option><option value="loss">Losers</option></Select>
          <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag"><option value="">All tags</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}</Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Entries from date" />
        </div>
      </div>

      {view === "entries" ? (
        <Card>
          {filtered.length === 0 ? (
            <EmptyState icon={<BookOpenText className="h-5 w-5" />} title={journal.length ? "No entries match your filters" : "Your journal is empty"} body="Journal each trade: what you saw, why you acted and how you felt." action={!journal.length ? <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />First entry</Button> : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Symbol</th><th>Entry</th><th>Exit</th><th className="text-right">Qty</th><th className="text-right">Net P/L</th><th className="text-right">R</th><th className="text-right">Days</th><th>Setup & tags</th><th>Mindset</th><th className="text-right">Actions</th></tr></thead>
                <tbody className="num">
                  {filtered.map((t) => {
                    const p = tradePnl(t);
                    const r = rMultiple(t);
                    return (
                      <tr key={t.id}>
                        <td><span className="font-semibold">{t.symbol}</span> {t.side === "SHORT" && <Badge>short</Badge>}</td>
                        <td>{fmtDate(t.entryDate)}<span className="block text-[11px] text-subtle">@ {fmtNum(t.entryPrice)}</span></td>
                        <td>{isClosed(t) ? <>{fmtDate(t.exitDate)}<span className="block text-[11px] text-subtle">@ {fmtNum(t.exitPrice)}</span></> : <Badge tone="info">open</Badge>}</td>
                        <td className="text-right">{fmtInt(t.quantity)}</td>
                        <td className="text-right">{p === null ? "—" : <><Delta value={p} icon={false}>{pkrSigned(p)}</Delta><span className="block text-[11px] text-subtle">{pct(tradeReturnPct(t), 1, true)}</span></>}</td>
                        <td className="text-right">{r === null ? "—" : `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`}</td>
                        <td className="text-right">{holdingDays(t) ?? "—"}</td>
                        <td className="max-w-[220px]"><span className="block truncate text-xs">{t.strategy ?? "—"}</span><span className="block truncate text-[11px] text-subtle">{t.tags.map((x) => `#${x}`).join(" ")}</span></td>
                        <td><span className="text-xs">{t.emotionEntry} · {t.confidence}/5</span><span className="block text-[11px]">{t.followedPlan ? <span className="text-gain">planned</span> : <span className="text-amber">unplanned</span>}{t.impulsive && <span className="text-loss"> · impulsive</span>}</span></td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" aria-label="Edit entry" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <ConfirmButton size="icon" aria-label="Delete entry" title="Delete journal entry?" onConfirm={() => { del(t.id); toast.success("Entry deleted", undefined, { label: "Undo", run: () => upsert(t) }); }}><Trash2 className="h-4 w-4" /></ConfirmButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Analytics stats={stats} trades={filtered} />
      )}

      <TradeForm open={open} onClose={() => setOpen(false)} editing={editing} />
    </>
  );
}

function Analytics({ stats, trades }: { stats: ReturnType<typeof journalStats>; trades: JournalTrade[] }) {
  const byStrategy = useMemo(() => {
    const m = new Map<string, { strategy: string; n: number; net: number; wins: number }>();
    for (const t of trades.filter(isClosed)) {
      const k = t.strategy || "Unlabelled";
      const r = m.get(k) ?? { strategy: k, n: 0, net: 0, wins: 0 };
      const p = tradePnl(t)!;
      r.n++; r.net += p; if (p > 0) r.wins++;
      m.set(k, r);
    }
    return [...m.values()].sort((a, b) => b.net - a.net);
  }, [trades]);
  const rDist = useMemo(() => {
    const buckets = ["≤-2R", "-2..-1R", "-1..0R", "0..1R", "1..2R", "≥2R"];
    const counts = buckets.map((b) => ({ bucket: b, count: 0 }));
    for (const t of trades) {
      const r = rMultiple(t);
      if (r === null) continue;
      const i = r <= -2 ? 0 : r <= -1 ? 1 : r < 0 ? 2 : r < 1 ? 3 : r < 2 ? 4 : 5;
      counts[i].count++;
    }
    return counts.map((c) => ({ ...c, signed: c.bucket.startsWith("≤") || c.bucket.startsWith("-") ? -c.count : c.count }));
  }, [trades]);

  if (stats.closed < 2) return <Card><EmptyState title="Not enough closed trades" body="Analytics need at least two closed trades. Keep journaling!" /></Card>;
  return (
    <div className="grid gap-4">
      {!stats.ratiosReliable && <Notice tone="amber" title={`Small sample: ${stats.closed} closed trades`}>Ratios computed from fewer than {MIN_SAMPLE_FOR_RATIOS} trades are unreliable. Charts are shown for reflection only.</Notice>}
      <Card>
        <CardHeader title="Equity curve" subtitle="Cumulative net P/L of closed trades, ordered by exit date" />
        <div className="px-3"><TimeSeriesChart data={stats.curve} series={[{ key: "equity", label: "Cumulative P/L", color: "rgb(var(--accent))" }, { key: "drawdown", label: "Drawdown from peak", color: "rgb(var(--loss))", dashed: true }]} height={260} refY={0} /></div>
        <Legend className="px-5 pb-4" items={[{ label: "Cumulative P/L", color: "rgb(var(--accent))" }, { label: "Drawdown from peak", color: "rgb(var(--loss))", dashed: true }]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Monthly performance" subtitle="Net P/L of trades closed each month" />
          <div className="px-3 pb-4"><SignedBarChart data={stats.monthly} xKey="month" yKey="pnl" label="Net P/L" /></div>
        </Card>
        <Card>
          <CardHeader title="Risk-reward outcomes" subtitle={`R-multiple distribution · ${stats.rSample} trades with a stop-loss`} />
          <div className="px-3 pb-4">{stats.rSample ? <SignedBarChart data={rDist} xKey="bucket" yKey="signed" label="Trades" yFormat={(v) => String(Math.abs(v))} /> : <p className="px-2 py-6 text-sm text-muted">Record stop-losses to see R-multiples.</p>}</div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="By strategy" />
          <div className="overflow-x-auto px-2 pb-3">
            <table className="table-base"><thead><tr><th>Strategy</th><th className="text-right">Trades</th><th className="text-right">Win rate</th><th className="text-right">Net P/L</th><th className="text-right">Avg / trade</th></tr></thead>
              <tbody className="num">{byStrategy.map((s) => <tr key={s.strategy}><td>{s.strategy}</td><td className="text-right">{s.n}</td><td className="text-right">{pct(s.wins / s.n, 0)}</td><td className="text-right"><Delta value={s.net} icon={false}>{pkrSigned(s.net)}</Delta></td><td className="text-right">{s.n >= 5 ? pkrSigned(s.net / s.n) : <span className="text-subtle">n&lt;5</span>}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <Stat label="Average win" value={<span className="text-gain">{pkr(stats.avgWin)}</span>} />
          <Stat label="Average loss" value={<span className="text-loss">{stats.avgLoss !== null ? pkr(-stats.avgLoss) : "—"}</span>} />
          <Stat label="Largest win / loss" value={<span className="text-sm">{pkrSigned(stats.largestWin)} / {pkrSigned(stats.largestLoss)}</span>} />
          <Stat label="Average R" value={stats.avgR !== null && stats.rSample >= MIN_SAMPLE_FOR_RATIOS ? `${stats.avgR.toFixed(2)}R` : "—"} sub={stats.rSample < MIN_SAMPLE_FOR_RATIOS ? <span className="text-subtle">Needs {MIN_SAMPLE_FOR_RATIOS}+ trades with stops</span> : undefined} />
          <Stat label="Average holding period" value={stats.avgHoldDays !== null ? `${stats.avgHoldDays.toFixed(1)} days` : "—"} />
        </Card>
      </div>
    </div>
  );
}
