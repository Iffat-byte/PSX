"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Delta, Field, Input, Notice, NumberInput, Slider } from "@/components/ui";
import { SignedBarChart, SimpleLineChart, Legend, Donut, SERIES } from "@/components/charts";
import { CalcLayout, Disclaimer, HoldingPicker, ResultTile, SaveScenario } from "./common";
import { averageCost, compound, concentration, dividendIncome, portfolioVolatility, positionSize, profitTargets, rebalanceTrades, whatIf } from "@/lib/finance/calculators";
import { annualizedVol } from "@/lib/finance/indicators";
import { useApp } from "@/store/app-store";
import { useQuotes, useSnapshot } from "@/lib/hooks";
import { market } from "@/lib/market/demo-provider";
import { SYMBOL_MAP } from "@/lib/market/symbols";
import { fmtInt, fmtNum, pct, pkr, pkrCompact, pkrSigned } from "@/lib/format";
import { effectiveFeeRate } from "@/lib/finance/fees";

type Init = Record<string, number | string> | undefined;
const n = (v: unknown, d: number) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);

function useFeePct() {
  const fp = useApp((s) => s.settings.feeProfile);
  return Math.round(effectiveFeeRate(fp, 1000, 100) * 10000) / 100;
}

/* ===================================================================== A */
export function AverageCostCalc({ init }: { init?: Init }) {
  const feeDefault = useFeePct();
  const [symbol, setSymbol] = useState(String(init?.symbol ?? ""));
  const [qty, setQty] = useState(n(init?.existingQty, 500));
  const [avg, setAvg] = useState(n(init?.existingAvg, 250));
  const [price, setPrice] = useState(n(init?.newPrice, 200));
  const [amount, setAmount] = useState(n(init?.investAmount, 100000));
  const [fee, setFee] = useState(n(init?.feePct, feeDefault));
  const r = averageCost({ existingQty: qty, existingAvg: avg, newPrice: price, investAmount: amount, feePct: fee });
  const grid = useMemo(() => {
    const base = r.newAvg || price || 1;
    return [-30, -20, -10, -5, 0, 5, 10, 20, 30].map((m) => {
      const p = Math.round(base * (1 + m / 100) * 100) / 100;
      return { label: `${m > 0 ? "+" : ""}${m}%`, price: p, pnl: r.pnlAt(p) };
    });
  }, [r, price]);
  const inputs = { symbol, existingQty: qty, existingAvg: avg, newPrice: price, investAmount: amount, feePct: fee };
  return (
    <CalcLayout
      title="Average cost calculator"
      description="See how an additional purchase changes your average price and break-even."
      inputs={
        <>
          <HoldingPicker onPick={(h) => { setSymbol(h.symbol); setQty(h.quantity); setAvg(Math.round(h.avgCost * 100) / 100); if (h.price) setPrice(h.price); }} />
          <Field label="Symbol (optional)" htmlFor="ac-s"><Input id="ac-s" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. LUCK" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Existing quantity" htmlFor="ac-q"><NumberInput id="ac-q" value={qty} min={0} step={1} onChange={setQty} /></Field>
            <Field label="Existing avg price" htmlFor="ac-a"><NumberInput id="ac-a" value={avg} min={0} onChange={setAvg} prefix="Rs" /></Field>
            <Field label="New purchase price" htmlFor="ac-p"><NumberInput id="ac-p" value={price} min={0} onChange={setPrice} prefix="Rs" /></Field>
            <Field label="Fee rate (one-way)" htmlFor="ac-f"><NumberInput id="ac-f" value={fee} min={0} step={0.01} onChange={setFee} suffix="%" /></Field>
          </div>
          <Field label="Additional investment" htmlFor="ac-i"><NumberInput id="ac-i" value={amount} min={0} step={1000} onChange={setAmount} prefix="Rs" /></Field>
          <Slider label="Adjust investment" value={amount} min={0} max={Math.max(1_000_000, amount)} step={5000} onChange={setAmount} format={pkrCompact} />
        </>
      }
      actions={<SaveScenario calculator="Average cost" inputs={inputs} summary={`${symbol || "Position"}: +${fmtInt(r.addQty)} @ ${fmtNum(price)} → avg ${fmtNum(r.newAvg)}, break-even ${fmtNum(r.breakEven)}`} />}
      results={
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <ResultTile label="Additional shares you can buy" value={fmtInt(r.addQty)} sub={`Cost ${pkr(r.addCost, 2)} · unspent ${pkr(r.unspent, 2)}`} />
            <ResultTile label="New total quantity" value={fmtInt(r.totalQty)} />
            <ResultTile emphasis label="New average price" value={`Rs ${fmtNum(r.newAvg)}`} sub={r.avgChangePct !== null ? <span className="num">{pct(r.avgChangePct, 2, true)} vs. current average</span> : "No existing position"} />
            <ResultTile label="Total investment" value={pkr(r.totalCost, 2)} />
            <ResultTile emphasis label="Break-even price" value={`Rs ${fmtNum(r.breakEven)}`} sub="After sell-side fees" />
            <ResultTile label="P/L at new purchase price" value={<Delta value={r.pnlAt(price)} icon={false}>{pkrSigned(r.pnlAt(price))}</Delta>} />
          </div>
          {price > avg && qty > 0 && <Notice tone="info" title="Averaging up">The new price is above your current average, so your average cost rises.</Notice>}
          <Card>
            <CardHeader title="Hypothetical P/L at different prices" subtitle="Relative to your new average price" />
            <div className="px-3"><SignedBarChart data={grid} xKey="label" yKey="pnl" label="Hypothetical P/L" height={200} /></div>
            <div className="overflow-x-auto px-2 pb-3">
              <table className="table-base"><thead><tr><th>Move</th><th className="text-right">Price</th><th className="text-right">Position value</th><th className="text-right">P/L</th></tr></thead>
                <tbody className="num">{grid.map((g) => <tr key={g.label}><td>{g.label}</td><td className="text-right">{fmtNum(g.price)}</td><td className="text-right">{pkr(g.price * r.totalQty)}</td><td className="text-right"><Delta value={g.pnl} icon={false}>{pkrSigned(g.pnl)}</Delta></td></tr>)}</tbody>
              </table>
            </div>
          </Card>
          <Disclaimer />
        </>
      }
    />
  );
}

/* ===================================================================== B */
interface Scenario { name: string; move: number; addQty: number; addPrice: number }
export function WhatIfCalc({ init }: { init?: Init }) {
  const quotes = useQuotes();
  const [symbol, setSymbol] = useState(String(init?.symbol ?? "OGDC"));
  const [qty, setQty] = useState(n(init?.qty, 1000));
  const [avg, setAvg] = useState(n(init?.avg, quotes.OGDC?.price ?? 200));
  const [cur, setCur] = useState(n(init?.cur, quotes.OGDC?.price ?? 200));
  const [scenarios, setScenarios] = useState<Scenario[]>(() => init?.scenarios ? JSON.parse(String(init.scenarios)) : [
    { name: "Bear case", move: -20, addQty: 0, addPrice: 0 },
    { name: "Base case", move: 0, addQty: 0, addPrice: 0 },
    { name: "Bull case", move: 20, addQty: 0, addPrice: 0 },
  ]);
  const upd = (i: number, p: Partial<Scenario>) => setScenarios((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const results = scenarios.map((s) => ({ ...s, r: whatIf(qty, avg, cur, s.move, s.addQty, s.addPrice || cur * (1 + s.move / 100)) }));
  const curve = Array.from({ length: 21 }, (_, i) => {
    const m = -50 + i * 5;
    return { move: `${m}%`, pnl: whatIf(qty, avg, cur, m, 0, 0).pnl };
  });
  return (
    <CalcLayout
      title="What-if simulator"
      description="Move the sliders to compare hypothetical scenarios side by side. Updates instantly."
      inputs={
        <>
          <HoldingPicker onPick={(h) => { setSymbol(h.symbol); setQty(h.quantity); setAvg(Math.round(h.avgCost * 100) / 100); if (h.price) setCur(h.price); }} />
          <Field label="Symbol" htmlFor="wi-s"><Input id="wi-s" value={symbol} onChange={(e) => { const s = e.target.value.toUpperCase(); setSymbol(s); if (quotes[s]) setCur(quotes[s].price); }} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantity" htmlFor="wi-q"><NumberInput id="wi-q" value={qty} min={0} step={1} onChange={setQty} /></Field>
            <Field label="Avg cost" htmlFor="wi-a"><NumberInput id="wi-a" value={avg} min={0} onChange={setAvg} /></Field>
            <Field label="Current" htmlFor="wi-c"><NumberInput id="wi-c" value={cur} min={0} onChange={setCur} /></Field>
          </div>
          {quotes[symbol] && <p className="text-[11px] text-subtle">Current price prefilled from demo data (synthetic).</p>}
        </>
      }
      actions={<SaveScenario calculator="What-if" inputs={{ symbol, qty, avg, cur, scenarios: JSON.stringify(scenarios) }} summary={`${symbol}: ${results.map((r) => `${r.name} ${pkrSigned(r.r.pnl)}`).join(" · ")}`} />}
      results={
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {results.map((s, i) => (
              <Card key={i} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i] }} />
                  <input value={s.name} onChange={(e) => upd(i, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" aria-label="Scenario name" />
                  {scenarios.length > 1 && <button aria-label="Remove scenario" onClick={() => setScenarios((x) => x.filter((_, j) => j !== i))} className="text-subtle hover:text-loss"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
                <div className="space-y-4">
                  <Slider label="Price move" value={s.move} min={-50} max={50} onChange={(v) => upd(i, { move: v })} format={(v) => `${v > 0 ? "+" : ""}${v}%`} />
                  <Slider label="Add shares at that price" value={s.addQty} min={0} max={Math.max(5000, qty)} step={50} onChange={(v) => upd(i, { addQty: v })} format={fmtInt} />
                </div>
                <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
                  <Row l="Hypothetical price" v={`Rs ${fmtNum(s.r.price)}`} />
                  <Row l="Shares" v={fmtInt(s.r.totalQty)} />
                  <Row l="Average cost" v={`Rs ${fmtNum(s.r.avg)}`} />
                  <Row l="Position value" v={pkr(s.r.value)} />
                  <Row l="P/L" v={<Delta value={s.r.pnl} icon={false}>{pkrSigned(s.r.pnl)} ({pct(s.r.pnlPct, 1, true)})</Delta>} />
                </div>
              </Card>
            ))}
          </div>
          {scenarios.length < 4 && <Button variant="outline" size="sm" onClick={() => setScenarios((s) => [...s, { name: `Scenario ${s.length + 1}`, move: 10, addQty: 0, addPrice: 0 }])}><Plus className="h-4 w-4" />Add scenario</Button>}
          <Card>
            <CardHeader title="P/L across price moves" subtitle="Current position only, before fees" />
            <div className="px-3 pb-3"><SignedBarChart data={curve} xKey="move" yKey="pnl" label="Hypothetical P/L" height={200} /></div>
          </Card>
          <Disclaimer />
        </>
      }
    />
  );
}
const Row = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="flex justify-between gap-2"><span className="text-muted">{l}</span><span className="num font-medium">{v}</span></div>;

/* ===================================================================== C */
export function PositionSizeCalc({ init }: { init?: Init }) {
  const feeDefault = useFeePct();
  const [capital, setCapital] = useState(n(init?.capital, 1_000_000));
  const [risk, setRisk] = useState(n(init?.riskPct, 1));
  const [entry, setEntry] = useState(n(init?.entry, 100));
  const [stop, setStop] = useState(n(init?.stop, 94));
  const [fee, setFee] = useState(n(init?.feePct, feeDefault));
  const r = positionSize({ capital, riskPct: risk, entry, stop, feePct: fee });
  return (
    <CalcLayout
      title="Risk & position sizing"
      description="Size a position so that hitting your stop-loss loses no more than your chosen % of capital."
      inputs={
        <>
          <Field label="Trading capital" htmlFor="ps-c"><NumberInput id="ps-c" value={capital} min={0} step={10000} onChange={setCapital} prefix="Rs" /></Field>
          <Slider label="Max risk per trade" value={risk} min={0.25} max={5} step={0.25} onChange={setRisk} format={(v) => `${v}%`} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entry price" htmlFor="ps-e"><NumberInput id="ps-e" value={entry} min={0} onChange={setEntry} prefix="Rs" /></Field>
            <Field label="Stop-loss price" htmlFor="ps-s"><NumberInput id="ps-s" value={stop} min={0} onChange={setStop} prefix="Rs" /></Field>
          </div>
          <Field label="Fee rate (one-way)" htmlFor="ps-f"><NumberInput id="ps-f" value={fee} min={0} step={0.01} onChange={setFee} suffix="%" /></Field>
        </>
      }
      actions={r.valid ? <SaveScenario calculator="Position size" inputs={{ capital, riskPct: risk, entry, stop, feePct: fee }} summary={`${fmtInt(r.quantity)} shares @ ${fmtNum(entry)}, stop ${fmtNum(stop)}, max loss ${pkr(r.potentialLoss)}`} /> : undefined}
      results={
        !r.valid ? (
          <Notice tone="loss" title="Check your inputs">{r.errors.map((e) => <p key={e}>{e}</p>)}</Notice>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              <ResultTile emphasis label="Illustrative position size" value={`${fmtInt(r.quantity)} shares`} sub={r.cappedByCapital ? "Limited by available capital" : "Limited by risk budget"} />
              <ResultTile label="Position value" value={pkr(r.positionValue)} sub={`${pct(r.pctOfCapital, 1)} of capital`} />
              <ResultTile label="Risk budget" value={pkr(r.riskBudget)} sub={`${risk}% of capital`} />
              <ResultTile emphasis label="Potential loss at stop" value={<span className="text-loss">{pkr(-r.potentialLoss)}</span>} sub="Including entry & exit fees" />
              <ResultTile label="Stop distance" value={pct(r.stopDistancePct, 2)} sub={`Rs ${fmtNum(entry - stop)} per share`} />
              <ResultTile label="Loss per share incl. fees" value={`Rs ${fmtNum(r.perShareRisk)}`} />
            </div>
            <Card>
              <CardHeader title="Reward-to-risk levels" subtitle="Price levels at multiples of your initial risk (R)" />
              <div className="overflow-x-auto px-2 pb-3">
                <table className="table-base"><thead><tr><th>Multiple</th><th className="text-right">Price</th><th className="text-right">Move</th><th className="text-right">Gross P/L</th></tr></thead>
                  <tbody className="num">{[1, 1.5, 2, 3].map((m) => { const p = r.rTarget(m); return <tr key={m}><td>{m}R</td><td className="text-right">{fmtNum(p)}</td><td className="text-right">{pct((p - entry) / entry, 1, true)}</td><td className="text-right text-gain">{pkrSigned((p - entry) * r.quantity)}</td></tr>; })}</tbody>
                </table>
              </div>
            </Card>
            {r.pctOfCapital > 0.25 && <Notice tone="amber" title="Large single position">This position would be {pct(r.pctOfCapital, 0)} of your capital. Check against your concentration limit.</Notice>}
            <Disclaimer />
          </>
        )
      }
    />
  );
}

/* ===================================================================== D */
export function ProfitTargetCalc({ init }: { init?: Init }) {
  const feeDefault = useFeePct();
  const [qty, setQty] = useState(n(init?.qty, 1000));
  const [entry, setEntry] = useState(n(init?.entry, 150));
  const [fee, setFee] = useState(n(init?.feePct, feeDefault));
  const [targets, setTargets] = useState<number[]>(() => (init?.targets ? String(init.targets).split(",").map(Number) : [160, 170, 180, 195]));
  const [newT, setNewT] = useState(0);
  const rows = profitTargets(qty, entry, fee, [...targets].sort((a, b) => a - b));
  return (
    <CalcLayout
      title="Profit target planner"
      description="Compare hypothetical outcomes across the exit prices you are considering."
      inputs={
        <>
          <HoldingPicker onPick={(h) => { setQty(h.quantity); setEntry(Math.round(h.avgCost * 100) / 100); }} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" htmlFor="pt-q"><NumberInput id="pt-q" value={qty} min={0} step={1} onChange={setQty} /></Field>
            <Field label="Entry / avg price" htmlFor="pt-e"><NumberInput id="pt-e" value={entry} min={0} onChange={setEntry} prefix="Rs" /></Field>
          </div>
          <Field label="Fee rate (one-way)" htmlFor="pt-f"><NumberInput id="pt-f" value={fee} min={0} step={0.01} onChange={setFee} suffix="%" /></Field>
          <div>
            <p className="label">Target prices</p>
            <div className="flex flex-wrap gap-1.5">
              {targets.map((t, i) => <button key={i} onClick={() => setTargets((x) => x.filter((_, j) => j !== i))} className="num rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs hover:border-loss/50 hover:text-loss" aria-label={`Remove target ${t}`}>{fmtNum(t)} ×</button>)}
            </div>
            <div className="mt-2 flex gap-2">
              <NumberInput value={newT} min={0} onChange={setNewT} aria-label="New target price" />
              <Button variant="secondary" onClick={() => { if (newT > 0 && targets.length < 10) { setTargets((t) => [...t, newT]); setNewT(0); } }}>Add</Button>
            </div>
          </div>
        </>
      }
      actions={<SaveScenario calculator="Profit targets" inputs={{ qty, entry, feePct: fee, targets: targets.join(",") }} summary={`${fmtInt(qty)} @ ${fmtNum(entry)} → targets ${targets.join(", ")}`} />}
      results={
        <>
          <Card>
            <CardHeader title="Outcome by target" subtitle={`Cost incl. fees: ${pkr(qty * entry * (1 + fee / 100))}`} />
            <div className="px-3"><SignedBarChart data={rows.map((r) => ({ t: fmtNum(r.target), pnl: r.pnl }))} xKey="t" yKey="pnl" label="Hypothetical net P/L" height={200} /></div>
            <div className="overflow-x-auto px-2 pb-3">
              <table className="table-base"><thead><tr><th>Target</th><th className="text-right">Move</th><th className="text-right">Net proceeds</th><th className="text-right">Net P/L</th><th className="text-right">Return</th></tr></thead>
                <tbody className="num">{rows.map((r) => <tr key={r.target}><td>Rs {fmtNum(r.target)}</td><td className="text-right">{pct(r.movePct, 1, true)}</td><td className="text-right">{pkr(r.proceeds)}</td><td className="text-right"><Delta value={r.pnl} icon={false}>{pkrSigned(r.pnl)}</Delta></td><td className="text-right"><Delta value={r.returnPct}>{pct(r.returnPct, 2, true)}</Delta></td></tr>)}</tbody>
              </table>
            </div>
          </Card>
          <Disclaimer />
        </>
      }
    />
  );
}

/* ===================================================================== E */
export function RebalanceCalc() {
  const snap = useSnapshot();
  const [rho, setRho] = useState(0.5);
  const [targets, setTargets] = useState<Record<string, number>>(() => Object.fromEntries(snap.holdings.map((h) => [h.symbol, Math.round(h.weight * 1000) / 10])));
  const rows = snap.holdings.map((h) => ({ symbol: h.symbol, value: h.marketValue, price: h.price ?? h.avgCost, current: h.weight * 100, target: targets[h.symbol] ?? h.weight * 100, vol: annualizedVol(market.history(h.symbol).slice(-252).map((p) => p.close)) }));
  const totalTarget = rows.reduce((a, r) => a + r.target, 0);
  const curC = concentration(rows.map((r) => r.current));
  const newC = concentration(rows.map((r) => r.target));
  const curVol = portfolioVolatility(rows.map((r) => r.current), rows.map((r) => r.vol), rho);
  const newVol = portfolioVolatility(rows.map((r) => r.target), rows.map((r) => r.vol), rho);
  const trades = rebalanceTrades(rows.map((r) => ({ symbol: r.symbol, value: r.value, price: r.price, targetWeight: totalTarget > 0 ? r.target / totalTarget : 0 })), snap.marketValue);
  if (!snap.holdings.length) return <Notice tone="info" title="No holdings in the active portfolio">Record transactions or switch portfolio to simulate rebalancing.</Notice>;
  return (
    <CalcLayout
      title="Rebalancing simulator"
      description="Adjust target weights and see how concentration and illustrative volatility change."
      inputs={
        <>
          <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {rows.map((r) => <Slider key={r.symbol} label={`${r.symbol} (now ${r.current.toFixed(1)}%)`} value={r.target} min={0} max={60} step={0.5} onChange={(v) => setTargets((t) => ({ ...t, [r.symbol]: v }))} format={(v) => `${v.toFixed(1)}%`} />)}
          </div>
          <div className={`flex justify-between rounded-xl px-3 py-2 text-xs ${Math.abs(totalTarget - 100) > 0.5 ? "bg-amber/10 text-amber" : "bg-surface-2 text-muted"}`}>
            <span>Sum of targets</span><span className="num font-semibold">{totalTarget.toFixed(1)}%{Math.abs(totalTarget - 100) > 0.5 && " (normalised to 100%)"}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { const eq = 100 / rows.length; setTargets(Object.fromEntries(rows.map((r) => [r.symbol, Math.round(eq * 10) / 10]))); }}>Set equal weights</Button>
          <Slider label="Assumed pairwise correlation" value={rho} min={0} max={1} step={0.05} onChange={setRho} format={(v) => v.toFixed(2)} />
        </>
      }
      results={
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <ResultTile label="Largest position" value={`${pct(curC.top1, 1)} → ${pct(newC.top1, 1)}`} />
            <ResultTile label="Top 3 weight" value={`${pct(curC.top3, 0)} → ${pct(newC.top3, 0)}`} />
            <ResultTile emphasis label="Effective N" value={`${curC.effectiveN.toFixed(1)} → ${newC.effectiveN.toFixed(1)}`} sub="1 ÷ HHI" />
            <ResultTile emphasis label="Illustrative volatility" value={`${pct(curVol, 1)} → ${pct(newVol, 1)}`} sub="Annualised, synthetic history" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader title="Current" /><div className="px-4 pb-4"><Donut height={180} data={rows.map((r, i) => ({ name: r.symbol, value: r.current, color: SERIES[i % 8] }))} format={(v) => `${v.toFixed(1)}%`} /></div></Card>
            <Card><CardHeader title="Target" /><div className="px-4 pb-4"><Donut height={180} data={rows.map((r, i) => ({ name: r.symbol, value: r.target, color: SERIES[i % 8] }))} format={(v) => `${v.toFixed(1)}%`} /></div></Card>
          </div>
          <Card>
            <CardHeader title="Trades to reach target" subtitle="At latest demo prices, whole shares, before fees" />
            <div className="overflow-x-auto px-2 pb-3">
              <table className="table-base"><thead><tr><th>Symbol</th><th className="text-right">Current value</th><th className="text-right">Target value</th><th className="text-right">Change</th><th className="text-right">Shares</th><th className="text-right">Ann. vol</th></tr></thead>
                <tbody className="num">{trades.map((t, i) => <tr key={t.symbol}><td className="font-medium">{t.symbol}</td><td className="text-right">{pkr(rows[i].value)}</td><td className="text-right">{pkr(t.targetValue)}</td><td className="text-right"><Delta value={t.deltaValue} icon={false}>{pkrSigned(t.deltaValue)}</Delta></td><td className="text-right">{t.shares === 0 ? "—" : <Badge tone={t.shares > 0 ? "info" : "amber"}>{t.shares > 0 ? "Buy" : "Sell"} {fmtInt(Math.abs(t.shares))}</Badge>}</td><td className="text-right">{pct(rows[i].vol, 0)}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
          <p className="text-[11px] text-subtle">Volatility uses one constant correlation for all pairs and synthetic demo price history. It is a teaching illustration of diversification, not a risk forecast.</p>
        </>
      }
    />
  );
}

/* ===================================================================== F */
export function DividendCalc({ init }: { init?: Init }) {
  const snap = useSnapshot();
  const dividends = useApp((s) => s.dividends);
  const taxDefault = useApp((s) => s.settings.dividendTaxPct);
  const [tax, setTax] = useState(n(init?.taxPct, taxDefault));
  const [dps, setDps] = useState<Record<string, number>>({});
  const declared = dividends.filter((d) => d.status === "declared");
  const rows = snap.holdings.map((h) => {
    const per = dps[h.symbol] ?? 0;
    const r = dividendIncome(h.quantity, per, tax);
    return { h, per, r, yieldOnCost: h.avgCost > 0 ? per / h.avgCost : 0 };
  });
  const hyp = rows.reduce((a, r) => a + r.r.net, 0);
  const decl = declared.reduce((a, d) => a + dividendIncome(d.quantity, d.dps, d.taxPct).net, 0);
  return (
    <CalcLayout
      title="Dividend income planner"
      description="Estimate income from your own per-share assumptions, shown separately from declared dividends you've recorded."
      inputs={
        <>
          <Field label="Withholding tax rate" htmlFor="dv-t" hint="Use the rate that applies to you; it varies by filer status and company."><NumberInput id="dv-t" value={tax} min={0} step={0.5} onChange={setTax} suffix="%" /></Field>
          <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
            {snap.holdings.map((h) => (
              <Field key={h.symbol} label={`${h.symbol} — your assumed DPS (Rs)`} htmlFor={`dps-${h.symbol}`}>
                <NumberInput id={`dps-${h.symbol}`} value={dps[h.symbol] ?? 0} min={0} step={0.5} onChange={(v) => setDps((d) => ({ ...d, [h.symbol]: v }))} />
              </Field>
            ))}
            {!snap.holdings.length && <p className="text-xs text-muted">No holdings in the active portfolio.</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDps(Object.fromEntries(snap.holdings.map((h) => [h.symbol, SYMBOL_MAP[h.symbol]?.demoDps ?? 0])))}>Fill with demo placeholder values</Button>
        </>
      }
      results={
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultTile emphasis label="Hypothetical annual income (net)" value={pkr(hyp)} sub={<Badge tone="amber">Based on your assumptions</Badge>} />
            <ResultTile label="Declared & recorded (net)" value={pkr(decl)} sub={<Badge tone="info">{declared.length} declared record(s) in Calendar</Badge>} />
          </div>
          <Card>
            <CardHeader title="Hypothetical income by holding" />
            <div className="overflow-x-auto px-2 pb-3">
              <table className="table-base"><thead><tr><th>Symbol</th><th className="text-right">Shares</th><th className="text-right">Assumed DPS</th><th className="text-right">Gross</th><th className="text-right">Tax</th><th className="text-right">Net</th><th className="text-right">Yield on cost</th></tr></thead>
                <tbody className="num">{rows.map(({ h, per, r, yieldOnCost }) => <tr key={h.symbol}><td className="font-medium">{h.symbol}</td><td className="text-right">{fmtInt(h.quantity)}</td><td className="text-right">{fmtNum(per)}</td><td className="text-right">{pkr(r.gross)}</td><td className="text-right">{pkr(r.tax)}</td><td className="text-right font-medium">{pkr(r.net)}</td><td className="text-right">{pct(yieldOnCost, 2)}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
          <p className="text-[11px] text-subtle">Hypothetical figures use per-share amounts you enter. Declared amounts come only from dividend records you add in the Corporate Calendar. Nothing here is a dividend forecast.</p>
        </>
      }
    />
  );
}

/* ===================================================================== G */
export function CompoundCalc({ init }: { init?: Init }) {
  const [initial, setInitial] = useState(n(init?.initial, 500_000));
  const [monthly, setMonthly] = useState(n(init?.monthly, 25_000));
  const [years, setYears] = useState(n(init?.years, 15));
  const [stepUp, setStepUp] = useState(n(init?.stepUpPct, 5));
  const [infl, setInfl] = useState(n(init?.inflationPct, 8));
  const [rates, setRates] = useState<[number, number, number]>([n(init?.r1, 8), n(init?.r2, 12), n(init?.r3, 16)]);
  const runs = rates.map((r) => compound({ initial, monthly, annualReturnPct: r, years, stepUpPct: stepUp, inflationPct: infl }));
  const data = runs[0].map((row, i) => ({ date: String(row.year), year: `Y${row.year}`, contributed: row.contributed, a: runs[0][i].balance, b: runs[1][i].balance, c: runs[2][i].balance }));
  const last = runs.map((r) => r[r.length - 1]);
  return (
    <CalcLayout
      title="Compounding calculator"
      description="Illustrate how contributions and different assumed annual returns compound over time."
      inputs={
        <>
          <Field label="Starting amount" htmlFor="cp-i"><NumberInput id="cp-i" value={initial} min={0} step={10000} onChange={setInitial} prefix="Rs" /></Field>
          <Slider label="Monthly contribution" value={monthly} min={0} max={500000} step={5000} onChange={setMonthly} format={pkrCompact} />
          <Slider label="Years" value={years} min={1} max={40} onChange={setYears} />
          <Slider label="Yearly contribution step-up" value={stepUp} min={0} max={20} onChange={setStepUp} format={(v) => `${v}%`} />
          <Slider label="Inflation (for real value)" value={infl} min={0} max={25} step={0.5} onChange={setInfl} format={(v) => `${v}%`} />
          <div className="grid grid-cols-3 gap-2">
            {rates.map((r, i) => (
              <Field key={i} label={`Return ${i + 1}`} htmlFor={`cp-r${i}`}><NumberInput id={`cp-r${i}`} value={r} step={0.5} onChange={(v) => setRates((x) => x.map((y, j) => (j === i ? v : y)) as [number, number, number])} suffix="%" /></Field>
            ))}
          </div>
        </>
      }
      actions={<SaveScenario calculator="Compounding" inputs={{ initial, monthly, years, stepUpPct: stepUp, inflationPct: infl, r1: rates[0], r2: rates[1], r3: rates[2] }} summary={`${years}y, ${pkrCompact(monthly)}/mo → ${last.map((l, i) => `${rates[i]}%: ${pkrCompact(l.balance)}`).join(" · ")}`} />}
      results={
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {last.map((l, i) => <ResultTile key={i} emphasis={i === 1} label={`At ${rates[i]}% assumed return`} value={pkrCompact(l.balance)} sub={`Real (today's Rs): ${pkrCompact(l.real)} · contributed ${pkrCompact(l.contributed)}`} />)}
          </div>
          <Card>
            <CardHeader title="Growth paths" subtitle="Nominal balance by year" />
            <div className="px-3"><SimpleLineChart data={data} xKey="year" yFormat={(v) => pkrCompact(v).replace("Rs ", "")} lines={[{ key: "a", label: `${rates[0]}%`, color: SERIES[0] }, { key: "b", label: `${rates[1]}%`, color: SERIES[2] }, { key: "c", label: `${rates[2]}%`, color: SERIES[6] }, { key: "contributed", label: "Contributed", color: "rgb(var(--subtle))", dashed: true }]} height={260} /></div>
            <Legend className="px-5 pb-4" items={[{ label: `${rates[0]}% assumed`, color: SERIES[0] }, { label: `${rates[1]}% assumed`, color: SERIES[2] }, { label: `${rates[2]}% assumed`, color: SERIES[6] }, { label: "Total contributed", color: "rgb(var(--subtle))", dashed: true }]} />
          </Card>
          <p className="text-[11px] text-subtle">Returns are constant illustrative assumptions compounded monthly. Real markets do not deliver steady returns; sequences of gains and losses matter.</p>
        </>
      }
    />
  );
}

