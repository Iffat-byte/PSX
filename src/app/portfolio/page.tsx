"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, MoreHorizontal, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, DemoBadge, Delta, Notice, PageHeader, Segmented, Stat, SourceNote } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { TransactionForm } from "@/components/transaction-form";
import { HoldingsTable } from "@/components/portfolio/holdings";
import { TransactionsTable } from "@/components/portfolio/transactions";
import { ImportPanel } from "@/components/portfolio/import";
import { ReconcilePanel } from "@/components/portfolio/reconcile";
import { PortfolioModal } from "@/components/portfolio/portfolio-manager";
import { AllocationWidget, ValueHistoryWidget } from "@/components/dashboard/widgets";
import { SignedBarChart, Donut, SERIES } from "@/components/charts";
import { useApp, selectActivePortfolio } from "@/store/app-store";
import { usePortfolioTxs, useSnapshot } from "@/lib/hooks";
import type { Transaction } from "@/lib/finance/types";
import { valueSeries } from "@/lib/finance/portfolio";
import { maxDrawdownPct } from "@/lib/finance/indicators";
import { sectorAllocation } from "@/lib/insights";
import { market } from "@/lib/market/demo-provider";
import { downloadFile, toCSV } from "@/lib/utils";
import { fmtDate, fmtInt, pct, pkr, pkrSigned, todayISO } from "@/lib/format";

type Tab = "holdings" | "transactions" | "allocation" | "performance" | "import" | "reconcile";

export default function PortfolioPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "holdings");
  const [txOpen, setTxOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pfModal, setPfModal] = useState<"new" | "edit" | null>(null);
  const [menu, setMenu] = useState(false);
  const pf = useApp(selectActivePortfolio);
  const portfolios = useApp((s) => s.portfolios);
  const setActive = useApp((s) => s.setActivePortfolio);
  const delPf = useApp((s) => s.deletePortfolio);
  const txs = usePortfolioTxs();
  const snap = useSnapshot();
  const issueIds = useMemo(() => new Set(snap.issues.map((i) => i.txId)), [snap.issues]);

  useEffect(() => {
    if (params.get("new") === "tx") {
      setTxOpen(true);
      router.replace("/portfolio");
    }
    const t = params.get("tab") as Tab | null;
    if (t) setTab(t);
  }, [params, router]);

  const exportHoldings = () => {
    downloadFile(`${pf.name}-holdings-${todayISO()}.csv`, toCSV(snap.holdings.map((h) => ({ symbol: h.symbol, quantity: h.quantity, avg_cost: h.avgCost.toFixed(4), cost_basis: h.costBasis, price: h.price ?? "", market_value: h.marketValue, unrealized_pl: h.unrealized, unrealized_pct: (h.unrealizedPct * 100).toFixed(2), weight_pct: (h.weight * 100).toFixed(2), realized_pl: h.realized, dividends: h.dividends, price_source: market.label }))));
    toast.success("Holdings exported");
  };
  const exportTx = () => {
    downloadFile(`${pf.name}-transactions-${todayISO()}.csv`, toCSV(txs.map((t) => ({ date: t.date, type: t.type, symbol: t.symbol ?? "", quantity: t.quantity, price: t.price, fees: t.fees, amount: t.amount, note: t.note ?? "", source: t.source }))));
    toast.success("Transactions exported");
  };

  return (
    <>
      <PageHeader
        title="Portfolios"
        badge={<>{pf.kind === "paper" && <Badge tone="info">Paper</Badge>}{txs.some((t) => t.source === "demo") && <DemoBadge />}</>}
        description="Transaction-based tracking with weighted-average cost, realized and unrealized P/L, fees and cash."
        actions={
          <>
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setMenu((m) => !m)} aria-expanded={menu}><MoreHorizontal className="h-4 w-4" />Portfolio</Button>
              {menu && (
                <div className="absolute right-0 top-10 z-30 w-56 animate-scale-in rounded-xl border border-border bg-surface p-1 shadow-pop" onMouseLeave={() => setMenu(false)}>
                  {[
                    { l: "New portfolio", i: Plus, f: () => setPfModal("new") },
                    { l: "Rename / settings", i: Pencil, f: () => setPfModal("edit") },
                    { l: "Export holdings (CSV)", i: Download, f: exportHoldings },
                    { l: "Export transactions (CSV)", i: FileText, f: exportTx },
                    { l: "Print report / save PDF", i: Printer, f: () => { setTab("holdings"); setTimeout(() => window.print(), 100); } },
                  ].map((m) => (
                    <button key={m.l} onClick={() => { setMenu(false); m.f(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg"><m.i className="h-4 w-4" />{m.l}</button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={() => { setEditing(null); setTxOpen(true); }}><Plus className="h-4 w-4" />Transaction</Button>
          </>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {portfolios.map((p) => (
          <button key={p.id} onClick={() => setActive(p.id)} className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition ${p.id === pf.id ? "border-accent/50 bg-accent/10" : "border-border bg-surface hover:border-accent/30"}`}>
            <span className="block text-sm font-semibold">{p.name}</span>
            <span className="block text-[11px] text-muted">{p.kind === "paper" ? "Paper · virtual money" : p.description || "Real portfolio"}</span>
          </button>
        ))}
        <button onClick={() => setPfModal("new")} className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-border px-4 text-sm text-muted hover:border-accent/40 hover:text-fg"><Plus className="h-4 w-4" />New</button>
      </div>

      <Card className="mb-4 grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total value" value={pkr(snap.totalValue)} />
        <Stat label="Holdings" value={pkr(snap.marketValue)} sub={<span className="text-muted">{snap.holdings.length} positions</span>} />
        <Stat label="Cash" value={<span className={snap.cash < 0 ? "text-loss" : ""}>{pkr(snap.cash)}</span>} />
        <Stat label="Unrealized" value={<Delta value={snap.unrealized} icon={false}>{pkrSigned(snap.unrealized)}</Delta>} />
        <Stat label="Realized + dividends" value={<Delta value={snap.realized + snap.dividends} icon={false}>{pkrSigned(snap.realized + snap.dividends)}</Delta>} />
        <Stat label="Total return" value={<Delta value={snap.returnPct}>{pct(snap.returnPct, 2, true)}</Delta>} />
      </Card>

      {snap.issues.length > 0 && (
        <Notice tone="loss" className="mb-4" title={`${snap.issues.length} ledger issue${snap.issues.length > 1 ? "s" : ""}`} action={<Button size="sm" variant="outline" onClick={() => setTab("transactions")}>Review</Button>}>
          {snap.issues[0].message}
        </Notice>
      )}

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "holdings", label: "Holdings" },
          { value: "transactions", label: `Transactions (${txs.length})` },
          { value: "allocation", label: "Allocation" },
          { value: "performance", label: "Performance" },
          { value: "import", label: "Import" },
          { value: "reconcile", label: "Reconcile" },
        ]}
      />

      {tab === "holdings" && <HoldingsTable snap={snap} onAdd={() => setTxOpen(true)} />}
      {tab === "transactions" && <TransactionsTable txs={txs} issues={issueIds} onEdit={(t) => { setEditing(t); setTxOpen(true); }} />}
      {tab === "allocation" && <AllocationTab snap={snap} />}
      {tab === "performance" && <PerformanceTab snap={snap} txs={txs} />}
      {tab === "import" && <ImportPanel portfolioId={pf.id} existing={txs} />}
      {tab === "reconcile" && <ReconcilePanel key={pf.id} snap={snap} portfolioId={pf.id} />}

      {portfolios.length > 1 && (
        <div className="mt-8 flex justify-end">
          <ConfirmButton variant="ghost" size="sm" title={`Delete “${pf.name}”?`} body="This permanently deletes the portfolio and all of its transactions." onConfirm={() => { delPf(pf.id); toast.success("Portfolio deleted"); }}>
            <Trash2 className="h-4 w-4" />Delete this portfolio
          </ConfirmButton>
        </div>
      )}

      <TransactionForm open={txOpen} onClose={() => { setTxOpen(false); setEditing(null); }} editing={editing} />
      <PortfolioModal open={pfModal !== null} onClose={() => setPfModal(null)} editing={pfModal === "edit" ? pf : null} />
    </>
  );
}

function AllocationTab({ snap }: { snap: ReturnType<typeof useSnapshot> }) {
  const sectors = sectorAllocation(snap);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AllocationWidget snap={snap} />
      <Card>
        <CardHeader title="Sector exposure" subtitle="Market value and weight" />
        <div className="space-y-3 px-5 pb-5">
          {sectors.map((s, i) => (
            <div key={s.sector}>
              <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{s.sector}</span><span className="num font-medium">{pkr(s.value)} · {pct(s.weight, 1)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${s.weight * 100}%`, background: SERIES[Math.min(i, 7)] }} /></div>
            </div>
          ))}
          {!sectors.length && <p className="text-sm text-muted">No open positions.</p>}
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Cash vs. invested" />
        <div className="px-5 pb-5">
          <Donut height={180} data={[{ name: "Holdings", value: Math.max(0, snap.marketValue), color: "var(--c1)" }, { name: "Cash", value: Math.max(0, snap.cash), color: "var(--c3)" }]} center={<div><p className="text-[10px] uppercase text-subtle">Cash</p><p className="num text-sm font-semibold">{pct(snap.totalValue > 0 ? Math.max(0, snap.cash) / snap.totalValue : 0, 1)}</p></div>} />
        </div>
      </Card>
    </div>
  );
}

function PerformanceTab({ snap, txs }: { snap: ReturnType<typeof useSnapshot>; txs: Transaction[] }) {
  const pf = useApp(selectActivePortfolio);
  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of snap.realizedEvents) m.set(e.date.slice(0, 7), (m.get(e.date.slice(0, 7)) ?? 0) + e.pnl);
    return [...m.entries()].sort().map(([month, pnl]) => ({ month, pnl }));
  }, [snap.realizedEvents]);
  const stats = useMemo(() => {
    const days = market.tradingDays();
    const first = txs.length ? [...txs].sort((a, b) => (a.date < b.date ? -1 : 1))[0].date : null;
    if (!first) return null;
    const d = days.filter((x) => x >= first);
    const s = valueSeries(txs, d, (sym, dt) => market.closeOn(sym, dt));
    const bk = pf.benchmark !== "none" ? pf.benchmark : null;
    const bRet = bk && d.length > 1 ? market.closeOn(bk, d[d.length - 1])! / market.closeOn(bk, d[0])! - 1 : null;
    return { maxDD: maxDrawdownPct(s.map((p) => p.value - 0)), bRet };
  }, [txs, pf.benchmark]);
  return (
    <div className="grid gap-4">
      <ValueHistoryWidget />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Realized P/L by month" subtitle="Sales only, net of fees" />
          <div className="px-3 pb-4">{monthly.length ? <SignedBarChart data={monthly} xKey="month" yKey="pnl" label="Realized P/L" /> : <p className="px-2 pb-6 text-sm text-muted">No sales recorded yet.</p>}</div>
        </Card>
        <Card className="space-y-4 p-5">
          <Stat label="Simple return (since first entry)" value={<Delta value={snap.returnPct}>{pct(snap.returnPct, 2, true)}</Delta>} info="Total gain ÷ net contributions. Not time-weighted; deposits during the period affect it." />
          <Stat label={`${pf.benchmark} over same period`} value={stats?.bRet !== null && stats?.bRet !== undefined ? <Delta value={stats.bRet}>{pct(stats.bRet, 2, true)}</Delta> : "—"} sub={<Badge tone="amber">synthetic benchmark</Badge>} />
          <Stat label="Max drawdown of account value" value={stats ? pct(stats.maxDD, 1) : "—"} info="Largest peak-to-trough fall in total account value (holdings + cash). Deposits can mask drawdowns." />
          <Stat label="Dividends received" value={pkr(snap.dividends)} />
          <Stat label="Fees paid" value={pkr(snap.feesPaid)} />
          <SourceNote source={market.label} />
        </Card>
      </div>
      <Card>
        <CardHeader title="Realized trades" subtitle="Each sale and the average cost removed" />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Date</th><th>Symbol</th><th className="text-right">Qty</th><th className="text-right">Proceeds (net)</th><th className="text-right">Cost removed</th><th className="text-right">P/L</th></tr></thead>
            <tbody className="num">
              {[...snap.realizedEvents].reverse().map((e) => (
                <tr key={e.txId}><td>{fmtDate(e.date)}</td><td className="font-medium">{e.symbol}</td><td className="text-right">{fmtInt(e.quantity)}</td><td className="text-right">{pkr(e.proceeds, 2)}</td><td className="text-right">{pkr(e.costRemoved, 2)}</td><td className="text-right"><Delta value={e.pnl} icon={false}>{pkrSigned(e.pnl, 2)}</Delta></td></tr>
              ))}
              {!snap.realizedEvents.length && <tr><td colSpan={6} className="py-6 text-center text-muted">No realized trades yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
