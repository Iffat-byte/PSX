"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, BookMarked, FileBarChart2, LineChart as LineIcon, Plus, Scale, Star, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, Delta, EmptyState, Field, Input, Notice, PageHeader, Segmented, Select, SourceNote, Stat, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { AlertForm } from "@/components/alert-form";
import { Legend, SERIES, SimpleLineChart } from "@/components/charts";
import { useApp } from "@/store/app-store";
import { useSnapshot } from "@/lib/hooks";
import { market } from "@/lib/market/demo-provider";
import { SYMBOL_MAP, SYMBOLS } from "@/lib/market/symbols";
import { annualizedVol, macd, maxDrawdownPct, rsi, sma } from "@/lib/finance/indicators";
import { fmtDate, fmtInt, fmtNum, pct, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES = { "3M": 66, "6M": 130, "1Y": 252, Max: 10_000 } as const;

export default function ResearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [symbol, setSymbol] = useState(params.get("s")?.toUpperCase() || "OGDC");
  const [tab, setTab] = useState<"overview" | "compare" | "notes">("overview");
  useEffect(() => {
    const s = params.get("s");
    if (s) setSymbol(s.toUpperCase());
  }, [params]);
  const choose = (s: string) => { setSymbol(s); router.replace(`/research?s=${s}`); };

  return (
    <>
      <PageHeader title="Stock Research" description="Look up PSX symbols, chart price history with indicators, compare companies and keep research notes." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Select value={SYMBOL_MAP[symbol] ? symbol : ""} onChange={(e) => choose(e.target.value)} aria-label="Symbol">
            {!SYMBOL_MAP[symbol] && <option value="">{symbol} (no reference data)</option>}
            {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>)}
          </Select>
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview & technicals" }, { value: "compare", label: "Compare" }, { value: "notes", label: "Notes & thesis" }]} />
      </div>
      {tab === "overview" && <Overview symbol={symbol} />}
      {tab === "compare" && <Compare base={symbol} />}
      {tab === "notes" && <Notes symbol={symbol} />}
    </>
  );
}

function Overview({ symbol }: { symbol: string }) {
  const info = SYMBOL_MAP[symbol];
  const hist = market.history(symbol);
  const [range, setRange] = useState<keyof typeof RANGES>("1Y");
  const [ind, setInd] = useState({ sma20: true, sma50: true, sma200: false });
  const [alertOpen, setAlertOpen] = useState(false);
  const snap = useSnapshot();
  const lists = useApp((s) => s.watchlists);
  const addTo = useApp((s) => s.addToWatchlist);
  const held = snap.holdings.find((h) => h.symbol === symbol);

  const data = useMemo(() => {
    const closes = hist.map((p) => p.close);
    const s20 = sma(closes, 20), s50 = sma(closes, 50), s200 = sma(closes, 200);
    const r = rsi(closes, 14);
    const m = macd(closes);
    return hist.map((p, i) => ({ date: p.date, close: p.close, volume: p.volume, sma20: s20[i], sma50: s50[i], sma200: s200[i], rsi: r[i], macd: m.line[i], signal: m.signal[i], hist: m.hist[i] })).slice(-RANGES[range]);
  }, [hist, range]);

  if (!info || hist.length < 2) {
    return <Card><EmptyState icon={<LineIcon className="h-5 w-5" />} title={`No data for ${symbol}`} body="This symbol isn't in the demo reference set. Connect a licensed data provider to research any PSX symbol." /></Card>;
  }
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  const year = hist.slice(-252);
  const hi = Math.max(...year.map((p) => p.close));
  const lo = Math.min(...year.map((p) => p.close));
  const avgVol = year.slice(-20).reduce((a, p) => a + p.volume, 0) / 20;
  const ret = (n: number) => { const s = hist[Math.max(0, hist.length - 1 - n)].close; return last.close / s - 1; };
  const lastRsi = data[data.length - 1].rsi;
  const fmtX = (d: string) => fmtDate(d, { day: "2-digit", month: "short" });

  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{symbol}</h2>
              <Badge>{info.sector}</Badge>
              {held && <Badge tone="accent">You hold {fmtInt(held.quantity)}</Badge>}
              <Badge tone="amber">Synthetic prices</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{info.name}</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="num text-3xl font-semibold">Rs {fmtNum(last.close)}</span>
              <Delta value={last.close - prev.close} className="text-sm">{fmtNum(last.close - prev.close)} ({pct((last.close - prev.close) / prev.close, 2, true)})</Delta>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAlertOpen(true)}><Bell className="h-4 w-4" />Alert</Button>
            <Select aria-label="Add to watchlist" value="" onChange={(e) => { if (e.target.value) { addTo(e.target.value, symbol); toast.success(`${symbol} added to watchlist`); } }} className="h-8 w-44 text-xs">
              <option value="">+ Add to watchlist…</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="52-week range" value={<span className="text-base">{fmtNum(lo)} – {fmtNum(hi)}</span>} />
          <Stat label="Avg volume (20d)" value={<span className="text-base">{fmtInt(avgVol)}</span>} />
          <Stat label="1M / 3M" value={<span className="text-base"><Delta value={ret(21)} icon={false}>{pct(ret(21), 1, true)}</Delta> / <Delta value={ret(63)} icon={false}>{pct(ret(63), 1, true)}</Delta></span>} />
          <Stat label="1Y return" value={<Delta value={ret(251)}>{pct(ret(251), 1, true)}</Delta>} />
          <Stat label="Volatility (1Y)" value={<span className="text-base">{pct(annualizedVol(year.map((p) => p.close)), 0)}</span>} />
          <Stat label="RSI (14)" value={<span className="text-base">{lastRsi?.toFixed(1) ?? "—"}</span>} />
        </div>
      </Card>

      <Card>
        <CardHeader icon={<LineIcon className="h-4 w-4" />} title="Price history" subtitle="Daily closes with simple moving averages"
          action={<Segmented size="sm" value={range} onChange={setRange} options={Object.keys(RANGES).map((r) => ({ value: r as keyof typeof RANGES, label: r }))} />} />
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {(["sma20", "sma50", "sma200"] as const).map((k, i) => (
            <button key={k} onClick={() => setInd((x) => ({ ...x, [k]: !x[k] }))} aria-pressed={ind[k]} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", ind[k] ? "border-transparent text-fg" : "border-border text-subtle")} style={ind[k] ? { background: `color-mix(in srgb, ${SERIES[[0, 1, 6][i]]} 18%, transparent)` } : undefined}>
              SMA {k.slice(3)}
            </button>
          ))}
        </div>
        <div className="px-3">
          <SimpleLineChart data={data} xKey="date" xFormat={fmtX} yFormat={(v) => fmtNum(v, 0)} height={300} lines={[{ key: "close", label: "Close", color: "rgb(var(--accent))" }, ...(ind.sma20 ? [{ key: "sma20", label: "SMA 20", color: SERIES[0], dashed: true }] : []), ...(ind.sma50 ? [{ key: "sma50", label: "SMA 50", color: SERIES[1], dashed: true }] : []), ...(ind.sma200 ? [{ key: "sma200", label: "SMA 200", color: SERIES[6], dashed: true }] : [])]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-4 pt-2">
          <Legend items={[{ label: "Close", color: "rgb(var(--accent))" }, ...(ind.sma20 ? [{ label: "SMA 20", color: SERIES[0], dashed: true }] : []), ...(ind.sma50 ? [{ label: "SMA 50", color: SERIES[1], dashed: true }] : []), ...(ind.sma200 ? [{ label: "SMA 200", color: SERIES[6], dashed: true }] : [])]} />
          <SourceNote source={market.label} asOf={fmtDate(market.asOf())} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="RSI (14)" subtitle="Wilder's relative strength index; 70 / 30 reference lines" />
          <div className="px-3 pb-4"><SimpleLineChart data={data} xKey="date" xFormat={fmtX} yFormat={(v) => v.toFixed(0)} domain={[0, 100]} refY={[30, 70]} height={180} lines={[{ key: "rsi", label: "RSI", color: SERIES[6] }]} /></div>
        </Card>
        <Card>
          <CardHeader title="MACD (12, 26, 9)" subtitle="MACD line vs. signal line" />
          <div className="px-3 pb-2"><SimpleLineChart data={data} xKey="date" xFormat={fmtX} yFormat={(v) => v.toFixed(1)} refY={[0]} height={180} lines={[{ key: "macd", label: "MACD", color: SERIES[0] }, { key: "signal", label: "Signal", color: SERIES[1], dashed: true }]} /></div>
          <Legend className="px-5 pb-4" items={[{ label: "MACD", color: SERIES[0] }, { label: "Signal", color: SERIES[1], dashed: true }]} />
        </Card>
      </div>
      <p className="text-[11px] text-subtle">Indicators are computed from the synthetic demo series for learning how they work. They describe past price behavior only and are not trading signals.</p>

      <Card>
        <CardHeader icon={<FileBarChart2 className="h-4 w-4" />} title="Fundamentals, earnings & dividend history" subtitle="Requires a verified financial-data source" />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          {["Valuation ratios (P/E, P/B, EV/EBITDA)", "Quarterly & annual earnings (EPS)", "Dividend history & payout ratio", "Income statement, balance sheet, cash flow"].map((t) => (
            <div key={t} className="rounded-xl border border-dashed border-border p-4">
              <p className="text-sm font-medium">{t}</p>
              <p className="mt-1 text-xs text-muted">Not available — no verified source connected. PSX Pilot does not estimate or invent financial statements.</p>
            </div>
          ))}
        </div>
      </Card>
      <AlertForm open={alertOpen} onClose={() => setAlertOpen(false)} symbol={symbol} />
    </div>
  );
}

function Compare({ base }: { base: string }) {
  const [syms, setSyms] = useState<string[]>(() => [base, ...SYMBOLS.filter((s) => s.sector === SYMBOL_MAP[base]?.sector && s.symbol !== base).slice(0, 2).map((s) => s.symbol)]);
  const [range, setRange] = useState<keyof typeof RANGES>("1Y");
  const [add, setAdd] = useState("");
  const days = market.tradingDays().slice(-RANGES[range]);
  const data = days.map((d) => {
    const row: Record<string, number | string> = { date: d };
    for (const s of syms) {
      const b = market.closeOn(s, days[0]);
      const c = market.closeOn(s, d);
      if (b && c) row[s] = (c / b) * 100;
    }
    return row;
  });
  const rows = syms.map((s) => {
    const h = market.history(s).slice(-RANGES[range]).map((p) => p.close);
    return { s, ret: h.length ? h[h.length - 1] / h[0] - 1 : null, vol: annualizedVol(h), dd: maxDrawdownPct(h), last: h[h.length - 1], sector: SYMBOL_MAP[s]?.sector };
  });
  const sectorPeers = SYMBOLS.filter((x) => x.sector === SYMBOL_MAP[base]?.sector);
  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-center gap-2 p-4">
        {syms.map((s, i) => <span key={s} className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pl-2.5 pr-1.5 text-xs font-medium"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[i] }} />{s}{syms.length > 1 && <button aria-label={`Remove ${s}`} onClick={() => setSyms((x) => x.filter((y) => y !== s))} className="text-subtle hover:text-fg"><X className="h-3.5 w-3.5" /></button>}</span>)}
        {syms.length < 5 && (
          <Select aria-label="Add symbol to comparison" value={add} onChange={(e) => { if (e.target.value) { setSyms((x) => [...x, e.target.value]); setAdd(""); } }} className="h-8 w-48 text-xs">
            <option value="">+ Add symbol…</option>
            {SYMBOLS.filter((s) => !syms.includes(s.symbol)).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.sector}</option>)}
          </Select>
        )}
        <Button size="sm" variant="ghost" onClick={() => setSyms(sectorPeers.slice(0, 5).map((s) => s.symbol))}><Scale className="h-4 w-4" />Sector peers</Button>
        <Segmented className="ml-auto" size="sm" value={range} onChange={setRange} options={Object.keys(RANGES).map((r) => ({ value: r as keyof typeof RANGES, label: r }))} />
      </Card>
      <Card>
        <CardHeader title="Relative performance" subtitle="Rebased to 100 at the start of the period" />
        <div className="px-3"><SimpleLineChart data={data} xKey="date" xFormat={(d) => fmtDate(d, { day: "2-digit", month: "short" })} yFormat={(v) => v.toFixed(0)} refY={[100]} height={300} lines={syms.map((s, i) => ({ key: s, label: s, color: SERIES[i] }))} /></div>
        <Legend className="px-5 pb-4 pt-2" items={syms.map((s, i) => ({ label: s, color: SERIES[i] }))} />
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Symbol</th><th>Sector</th><th className="text-right">Last</th><th className="text-right">Return ({range})</th><th className="text-right">Ann. volatility</th><th className="text-right">Max drawdown</th><th className="text-right">P/E · Div. yield</th></tr></thead>
            <tbody className="num">{rows.map((r) => <tr key={r.s}><td className="font-semibold">{r.s}</td><td className="text-xs text-muted">{r.sector}</td><td className="text-right">{fmtNum(r.last)}</td><td className="text-right"><Delta value={r.ret}>{pct(r.ret, 1, true)}</Delta></td><td className="text-right">{pct(r.vol, 0)}</td><td className="text-right text-loss">{pct(r.dd, 1)}</td><td className="text-right text-subtle">Not verified</td></tr>)}</tbody>
          </table>
        </div>
        <div className="px-5 py-3"><SourceNote source={market.label} /></div>
      </Card>
    </div>
  );
}

function Notes({ symbol }: { symbol: string }) {
  const allNotes = useApp((s) => s.notes);
  const notes = useMemo(() => allNotes.filter((n) => n.symbol === symbol), [allNotes, symbol]);
  const thesis = useApp((s) => s.theses[symbol]);
  const { addNote, deleteNote, saveThesis } = useApp.getState();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [stance, setStance] = useState<"bull" | "bear" | "neutral">("neutral");
  const [t, setT] = useState({ summary: "", evidenceFor: [] as string[], evidenceAgainst: [] as string[], invalidation: "", reviewDate: "" });
  const [ef, setEf] = useState("");
  const [ea, setEa] = useState("");
  useEffect(() => {
    setT(thesis ? { summary: thesis.summary, evidenceFor: thesis.evidenceFor, evidenceAgainst: thesis.evidenceAgainst, invalidation: thesis.invalidation, reviewDate: thesis.reviewDate } : { summary: "", evidenceFor: [], evidenceAgainst: [], invalidation: "", reviewDate: "" });
  }, [symbol, thesis]);

  const list = (items: string[], key: "evidenceFor" | "evidenceAgainst", tone: string) => (
    <ul className="space-y-1.5">
      {items.map((x, i) => <li key={i} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]"><span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone)} /><span className="flex-1">{x}</span><button aria-label="Remove" onClick={() => setT((p) => ({ ...p, [key]: p[key].filter((_, j) => j !== i) }))} className="text-subtle hover:text-loss"><X className="h-3.5 w-3.5" /></button></li>)}
    </ul>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader icon={<BookMarked className="h-4 w-4" />} title={`Investment thesis — ${symbol}`} subtitle={thesis ? `Last updated ${fmtDate(new Date(thesis.updatedAt).toISOString())}` : "Write down why you own (or would own) this company"} />
        <div className="space-y-4 px-5 pb-5">
          <Field label="Thesis summary" htmlFor="th-s"><Textarea id="th-s" value={t.summary} onChange={(e) => setT({ ...t, summary: e.target.value })} maxLength={1200} placeholder="In 2–3 sentences, what must be true for this investment to work?" /></Field>
          <div>
            <p className="label">Evidence for</p>
            {list(t.evidenceFor, "evidenceFor", "bg-gain")}
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ef.trim()) { setT({ ...t, evidenceFor: [...t.evidenceFor, ef.trim()] }); setEf(""); } }}><Input value={ef} onChange={(e) => setEf(e.target.value)} placeholder="Add supporting evidence + source" aria-label="Evidence for" /><Button type="submit" variant="secondary"><Plus className="h-4 w-4" /></Button></form>
          </div>
          <div>
            <p className="label">Evidence against / risks</p>
            {list(t.evidenceAgainst, "evidenceAgainst", "bg-loss")}
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ea.trim()) { setT({ ...t, evidenceAgainst: [...t.evidenceAgainst, ea.trim()] }); setEa(""); } }}><Input value={ea} onChange={(e) => setEa(e.target.value)} placeholder="Add a risk or counter-argument" aria-label="Evidence against" /><Button type="submit" variant="secondary"><Plus className="h-4 w-4" /></Button></form>
          </div>
          <Field label="What would prove me wrong?" htmlFor="th-i"><Textarea id="th-i" rows={2} value={t.invalidation} onChange={(e) => setT({ ...t, invalidation: e.target.value })} maxLength={600} /></Field>
          <Field label="Next review date" htmlFor="th-d"><Input id="th-d" type="date" value={t.reviewDate} min={todayISO()} onChange={(e) => setT({ ...t, reviewDate: e.target.value })} /></Field>
          <Button variant="primary" onClick={() => { saveThesis({ symbol, ...t }); toast.success("Thesis saved"); }}>Save thesis</Button>
        </div>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Add research note" />
          <div className="space-y-3 px-5 pb-5">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={80} aria-label="Note title" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Observations, sources, questions…" maxLength={4000} rows={4} aria-label="Note body" />
            <div className="flex items-center justify-between gap-2">
              <Segmented size="sm" value={stance} onChange={setStance} options={[{ value: "bull", label: "Bullish" }, { value: "neutral", label: "Neutral" }, { value: "bear", label: "Bearish" }]} />
              <Button variant="primary" size="sm" onClick={() => { if (!title.trim() && !body.trim()) return toast.error("Write something first"); addNote({ symbol, title: title.trim() || "Untitled note", body: body.trim(), stance }); setTitle(""); setBody(""); toast.success("Note saved"); }}>Save note</Button>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title={`Notes on ${symbol}`} subtitle={`${notes.length} saved`} />
          {notes.length === 0 ? <EmptyState icon={<Star className="h-5 w-5" />} title="No notes yet" /> : (
            <ul className="divide-y divide-border">
              {notes.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-sm font-medium">{n.title} <Badge tone={n.stance === "bull" ? "gain" : n.stance === "bear" ? "loss" : "neutral"}>{n.stance}</Badge></p><p className="text-[11px] text-subtle">{fmtDate(new Date(n.createdAt).toISOString())}</p></div>
                    <ConfirmButton size="icon" title="Delete note?" onConfirm={() => deleteNote(n.id)} aria-label="Delete note"><Trash2 className="h-4 w-4" /></ConfirmButton>
                  </div>
                  {n.body && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-muted">{n.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Notice tone="info">Notes and theses are private to this browser. Cite your sources so you can verify them later.</Notice>
      </div>
    </div>
  );
}

