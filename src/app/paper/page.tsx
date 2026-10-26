"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, GraduationCap, History, Plus, RotateCcw } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, Delta, EmptyState, Field, Notice, NumberInput, PageHeader, Segmented, Select, Stat, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import { useQuotes } from "@/lib/hooks";
import { computePortfolio, sortTransactions } from "@/lib/finance/portfolio";
import { estimateFees } from "@/lib/finance/fees";
import { market } from "@/lib/market/demo-provider";
import { SYMBOLS } from "@/lib/market/symbols";
import { fmtDate, fmtInt, fmtNum, pct, pkr, pkrSigned, todayISO } from "@/lib/format";

export default function PaperPage() {
  const portfolios = useApp((s) => s.portfolios);
  const paper = portfolios.filter((p) => p.kind === "paper");
  const allTx = useApp((s) => s.transactions);
  const journal = useApp((s) => s.journal);
  const scenarios = useApp((s) => s.scenarios);
  const fees = useApp((s) => s.settings.feeProfile);
  const { addPortfolio, addTransactions, setActivePortfolio } = useApp.getState();
  const [pid, setPid] = useState(paper[0]?.id ?? "");
  const pf = paper.find((p) => p.id === pid) ?? paper[0];
  const quotes = useQuotes();
  const txs = useMemo(() => allTx.filter((t) => t.portfolioId === pf?.id), [allTx, pf]);
  const snap = useMemo(() => computePortfolio(txs, quotes), [txs, quotes]);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [symbol, setSymbol] = useState("OGDC");
  const [qty, setQty] = useState(100);
  const [reason, setReason] = useState("");
  const [startCash, setStartCash] = useState(1_000_000);

  const create = () => {
    const id = addPortfolio({ name: `Paper ${paper.length + 1}`, kind: "paper", benchmark: "KSE100", description: "Virtual money — educational only" });
    addTransactions([{ portfolioId: id, date: todayISO(), type: "DEPOSIT", amount: startCash, quantity: 0, price: 0, fees: 0, note: "Virtual starting balance", source: "paper" }]);
    setPid(id);
    toast.success("Paper portfolio created", `${pkr(startCash)} virtual cash.`);
  };

  if (!pf) {
    return (
      <>
        <PageHeader title="Paper Trading" description="Practice with virtual money. Nothing here places real orders." />
        <Card className="mx-auto max-w-lg p-6">
          <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="Create your first paper portfolio" body="Start with virtual cash and practise position sizing, entries and exits without risking real money." />
          <Field label="Virtual starting cash" htmlFor="pp-c"><NumberInput id="pp-c" value={startCash} min={10000} step={50000} onChange={setStartCash} prefix="Rs" /></Field>
          <Button className="mt-4 w-full" variant="primary" onClick={create}><Plus className="h-4 w-4" />Create paper portfolio</Button>
        </Card>
      </>
    );
  }

  const q = quotes[symbol];
  const price = q?.price ?? 0;
  const fee = estimateFees(fees, qty, price);
  const cost = qty * price + fee;
  const held = snap.holdings.find((h) => h.symbol === symbol)?.quantity ?? 0;
  const err = !q ? "No demo price for this symbol" : !Number.isInteger(qty) || qty <= 0 ? "Quantity must be a whole number" : side === "BUY" && cost > snap.cash + 1e-6 ? `Insufficient virtual cash (${pkr(snap.cash)})` : side === "SELL" && qty > held ? `You hold ${fmtInt(held)} ${symbol}` : null;

  const place = () => {
    if (err) return toast.error(err);
    addTransactions([{ portfolioId: pf.id, date: todayISO(), type: side, symbol, quantity: qty, price, fees: fee, amount: 0, note: reason.trim() || undefined, source: "paper" }]);
    toast.success(`Paper ${side.toLowerCase()} filled`, `${fmtInt(qty)} ${symbol} @ Rs ${fmtNum(price)} (simulated at latest demo close)`);
    setReason("");
  };

  const trades = txs.filter((t) => t.type === "BUY" || t.type === "SELL");
  const milestones = [
    { t: "Place your first paper trade", done: trades.length > 0 },
    { t: "Write a reason for every trade", done: trades.length > 0 && trades.every((t) => t.note) },
    { t: "Close a position (sell)", done: trades.some((t) => t.type === "SELL") },
    { t: "Save a position-sizing scenario", done: scenarios.some((sc) => sc.calculator === "Position size"), href: "/lab?tab=position" },
    { t: "Journal 5 trades with lessons", done: journal.filter((j) => j.lessons).length >= 5 },
    { t: "Complete 10 paper trades", done: trades.length >= 10 },
  ];

  return (
    <>
      <PageHeader title="Paper Trading" description="An educational simulator using virtual money. Orders fill instantly at the latest synthetic demo close." badge={<Badge tone="info">Simulation</Badge>}
        actions={<><Select value={pf.id} onChange={(e) => setPid(e.target.value)} className="h-9 w-44" aria-label="Paper portfolio">{paper.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><Button size="sm" variant="outline" onClick={create}><Plus className="h-4 w-4" />New</Button></>} />

      <Card className="mb-4 grid grid-cols-2 gap-x-6 gap-y-4 p-5 md:grid-cols-5">
        <Stat label="Virtual account value" value={pkr(snap.totalValue)} />
        <Stat label="Virtual cash" value={pkr(snap.cash)} />
        <Stat label="Unrealized" value={<Delta value={snap.unrealized} icon={false}>{pkrSigned(snap.unrealized)}</Delta>} />
        <Stat label="Realized" value={<Delta value={snap.realized} icon={false}>{pkrSigned(snap.realized)}</Delta>} />
        <Stat label="Return" value={<Delta value={snap.returnPct}>{pct(snap.returnPct, 2, true)}</Delta>} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <p className="mb-4 text-sm font-semibold">Order ticket</p>
          <Segmented className="mb-4 w-full" value={side} onChange={setSide} options={[{ value: "BUY", label: "Buy" }, { value: "SELL", label: "Sell" }]} />
          <div className="space-y-4">
            <Field label="Symbol" htmlFor="po-s"><Select id="po-s" value={symbol} onChange={(e) => setSymbol(e.target.value)}>{SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>)}</Select></Field>
            <Field label="Quantity" htmlFor="po-q" hint={side === "SELL" ? `Held: ${fmtInt(held)}` : `Max affordable: ${fmtInt(price ? Math.floor(snap.cash / (price * 1.01)) : 0)}`}><NumberInput id="po-q" value={qty} min={0} step={1} onChange={setQty} /></Field>
            <Field label="Why this trade?" htmlFor="po-r" hint="Practise writing your reasoning before acting."><Textarea id="po-r" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
            <div className="space-y-1.5 rounded-xl bg-surface-2 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted">Fill price (demo close)</span><span className="num">{fmtNum(price)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Estimated fees</span><span className="num">{pkr(fee, 2)}</span></div>
              <div className="flex justify-between font-semibold"><span>{side === "BUY" ? "Total cost" : "Net proceeds"}</span><span className="num">{pkr(side === "BUY" ? cost : qty * price - fee, 2)}</span></div>
            </div>
            {err && <p className="text-xs text-loss">{err}</p>}
            <Button className="w-full" variant="primary" onClick={place} disabled={!!err}>Place paper {side.toLowerCase()}</Button>
            <Link href="/lab?tab=position" className="block text-center text-xs text-accent hover:underline">Size this position with the risk calculator →</Link>
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Virtual positions" action={<Button size="sm" variant="ghost" onClick={() => { setActivePortfolio(pf.id); toast.info(`${pf.name} is now active`, "Dashboard and Portfolios show this paper portfolio."); }}>Analyze in Portfolios</Button>} />
            {snap.holdings.length === 0 ? <EmptyState title="No open paper positions" /> : (
              <div className="overflow-x-auto"><table className="table-base"><thead><tr><th>Symbol</th><th className="text-right">Qty</th><th className="text-right">Avg</th><th className="text-right">Last</th><th className="text-right">P/L</th></tr></thead>
                <tbody className="num">{snap.holdings.map((h) => <tr key={h.symbol}><td className="font-medium">{h.symbol}</td><td className="text-right">{fmtInt(h.quantity)}</td><td className="text-right">{fmtNum(h.avgCost)}</td><td className="text-right">{fmtNum(h.price)}</td><td className="text-right"><Delta value={h.unrealized} icon={false}>{pkrSigned(h.unrealized)} ({pct(h.unrealizedPct, 1, true)})</Delta></td></tr>)}</tbody></table></div>
            )}
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Decision log" subtitle="Review the reasons you wrote" />
              <ul className="max-h-72 space-y-2 overflow-y-auto px-5 pb-5">
                {sortTransactions(trades).reverse().map((t) => <li key={t.id} className="rounded-xl bg-surface-2 px-3 py-2 text-xs"><p><Badge tone={t.type === "BUY" ? "info" : "amber"}>{t.type}</Badge> <span className="font-medium">{fmtInt(t.quantity)} {t.symbol}</span> @ {fmtNum(t.price)} · {fmtDate(t.date)}</p><p className="mt-1 text-muted">{t.note ?? <span className="text-subtle">No reason recorded</span>}</p></li>)}
                {!trades.length && <li className="text-sm text-muted">No trades yet.</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader icon={<GraduationCap className="h-4 w-4" />} title="Learning progress" subtitle={`${milestones.filter((m) => m.done).length} of ${milestones.length} milestones`} />
              <ul className="space-y-2 px-5 pb-5">{milestones.map((m) => <li key={m.t} className="flex items-center gap-2 text-sm">{m.done ? <CheckCircle2 className="h-4 w-4 text-gain" /> : <Circle className="h-4 w-4 text-subtle" />}{m.href ? <Link href={m.href} className="hover:text-accent">{m.t}</Link> : m.t}</li>)}</ul>
            </Card>
          </div>
          <Card>
            <CardHeader icon={<History className="h-4 w-4" />} title="Historical replay" />
            <div className="px-5 pb-5"><Notice tone="info" title="Not available yet">Replaying past sessions requires appropriately licensed historical PSX data. When available, replay will reveal prices one bar at a time so decisions can’t use future information (no look-ahead bias).</Notice></div>
          </Card>
          <div className="flex justify-end">
            <ConfirmButton variant="ghost" size="sm" confirmLabel="Reset" title={`Reset ${pf.name}?`} body="Deletes all virtual trades and restores the starting balance." onConfirm={() => {
              const st = useApp.getState();
              const dep = st.transactions.find((t) => t.portfolioId === pf.id && t.type === "DEPOSIT");
              st.transactions.filter((t) => t.portfolioId === pf.id).forEach((t) => st.deleteTransaction(t.id));
              addTransactions([{ portfolioId: pf.id, date: todayISO(), type: "DEPOSIT", amount: dep?.amount ?? 1_000_000, quantity: 0, price: 0, fees: 0, note: "Virtual starting balance", source: "paper" }]);
              toast.success("Paper portfolio reset");
            }}><RotateCcw className="h-4 w-4" />Reset paper portfolio</ConfirmButton>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-[11px] text-subtle">Simulated fills ignore liquidity, spreads and slippage. {market.disclaimer}</p>
    </>
  );
}

