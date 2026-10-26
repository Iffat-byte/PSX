"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Cpu, Info, SendHorizonal, Sparkles, Trash2, UserRound } from "lucide-react";
import { Badge, Button, Card, Notice, PageHeader, Segmented } from "@/components/ui";
import { useApp, selectActivePortfolio } from "@/store/app-store";
import { useQuotes, usePortfolioTxs, useSnapshot } from "@/lib/hooks";
import { answer, type AssistantContext } from "@/lib/assistant/engine";
import { effectiveFeeRate } from "@/lib/finance/fees";
import { SYMBOLS } from "@/lib/market/symbols";
import { market } from "@/lib/market/demo-provider";
import { journalStats } from "@/lib/finance/journal";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; basis?: string[]; mode?: "demo" | "ai"; error?: boolean }

const SUGGESTIONS = [
  "Which holdings have the highest portfolio concentration?",
  "What was my realized profit last month?",
  "What changed since my previous portfolio review?",
  "If I invest another Rs 100,000, how would my average cost change?",
  "Which upcoming corporate actions concern my holdings?",
  "Explain the valuation ratios of a company.",
  "Help me understand the downside scenarios of this allocation.",
  "Pichle mahine ka munafa kitna tha?",
];

/** Minimal, safe markdown: **bold**, _italic_, "- " bullets. No HTML injection. */
function Rich({ text }: { text: string }) {
  const inline = (s: string, k: number) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={`${k}-${i}`} className="font-semibold text-fg">{p.slice(2, -2)}</strong> : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? <em key={`${k}-${i}`} className="text-subtle">{p.slice(1, -1)}</em> : <span key={`${k}-${i}`}>{p}</span>,
    );
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed">
      {text.split("\n").map((line, i) =>
        /^\s*[-•*]\s+/.test(line) ? <div key={i} className="flex gap-2 pl-1"><span className="text-accent">•</span><span>{inline(line.replace(/^\s*[-•*]\s+/, ""), i)}</span></div> : line.trim() === "" ? <div key={i} className="h-1" /> : <p key={i}>{inline(line.replace(/^#+\s*/, ""), i)}</p>,
      )}
    </div>
  );
}

export default function AssistantPage() {
  const snap = useSnapshot();
  const pf = useApp(selectActivePortfolio);
  const quotes = useQuotes();
  const txs = usePortfolioTxs();
  const events = useApp((s) => s.events);
  const journal = useApp((s) => s.journal);
  const reviews = useApp((s) => s.reviews);
  const theses = useApp((s) => s.theses);
  const fees = useApp((s) => s.settings.feeProfile);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ configured: boolean; model: string | null } | null>(null);
  const [mode, setMode] = useState<"demo" | "ai">("demo");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/assistant").then((r) => r.json()).then((d) => { setAi(d); if (d.configured) setMode("ai"); }).catch(() => setAi({ configured: false, model: null }));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const ctx: AssistantContext = useMemo(() => ({
    snap, portfolioName: pf.name, quotes, events, journal, reviews, theses,
    transactions: txs, knownSymbols: [...new Set([...SYMBOLS.map((s) => s.symbol), ...snap.holdings.map((h) => h.symbol)])],
    feePct: Math.round(effectiveFeeRate(fees, 1000, 100) * 10000) / 100,
  }), [snap, pf.name, quotes, events, journal, reviews, theses, txs, fees]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    const history = msgs.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    if (mode === "demo" || !ai?.configured) {
      setBusy(true);
      await new Promise((r) => setTimeout(r, 250));
      const a = answer(question, ctx);
      setMsgs((m) => [...m, { role: "assistant", content: a.text, basis: a.basis, mode: "demo" }]);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const js = journalStats(journal);
      const context = {
        dataSource: market.label + " — synthetic, not live PSX data",
        asOf: market.asOf(),
        portfolio: { name: pf.name, kind: pf.kind, totals: { totalValue: snap.totalValue, marketValue: snap.marketValue, cash: snap.cash, unrealized: snap.unrealized, realized: snap.realized, dividends: snap.dividends, fees: snap.feesPaid, netContributions: snap.netContributions, returnPct: snap.returnPct, dayChange: snap.dayChange } },
        holdings: snap.holdings.map((h) => ({ symbol: h.symbol, qty: h.quantity, avgCost: +h.avgCost.toFixed(2), price: h.price, marketValue: h.marketValue, unrealized: h.unrealized, weightPct: +(h.weight * 100).toFixed(2), realized: h.realized })),
        realizedSales: snap.realizedEvents.slice(-40),
        recentTransactions: txs.slice(-40).map((t) => ({ date: t.date, type: t.type, symbol: t.symbol, qty: t.quantity, price: t.price, fees: t.fees, amount: t.amount })),
        upcomingEvents: events.filter((e) => e.date >= market.asOf()).slice(0, 20).map((e) => ({ date: e.date, symbol: e.symbol, type: e.type, sample: e.origin === "demo" })),
        journalSummary: { closed: js.closed, winRate: js.winRate, net: js.net, profitFactor: js.ratiosReliable ? js.profitFactor : "insufficient sample" },
        theses: Object.values(theses).slice(0, 5),
        feeAssumptionPct: ctx.feePct,
      };
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, context, history }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Request failed");
      setMsgs((m) => [...m, { role: "assistant", content: d.answer, mode: "ai", basis: ["Your portfolio records sent with this question"] }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `${(e as Error).message}. You can switch to the demo assistant, which works offline.`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Portfolio Research Assistant"
        description="Ask questions about your own portfolio in English or Roman Urdu."
        badge={mode === "ai" && ai?.configured ? <Badge tone="accent"><Cpu className="h-3 w-3" />AI connected</Badge> : <Badge tone="amber"><Info className="h-3 w-3" />Demo · rule-based</Badge>}
        actions={<>
          {ai?.configured && <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "ai", label: "AI" }, { value: "demo", label: "Demo (offline)" }]} />}
          {msgs.length > 0 && <Button size="sm" variant="ghost" onClick={() => setMsgs([])}><Trash2 className="h-4 w-4" />Clear</Button>}
        </>}
      />
      {ai && !ai.configured && (
        <Notice tone="amber" className="mb-4" title="Demo assistant — not an AI model">
          Answers are computed by deterministic rules from your own records (holdings, ledger, calendar, journal). To enable the AI assistant, set <code className="rounded bg-surface-3 px-1">ANTHROPIC_API_KEY</code> on the server; your API key is never sent to the browser.
        </Notice>
      )}
      <Card className="flex h-[calc(100dvh-280px)] min-h-[440px] flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {msgs.length === 0 ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent"><Sparkles className="h-7 w-7" /></div>
              <h2 className="text-lg font-semibold">What would you like to know about {pf.name}?</h2>
              <p className="mt-1 text-sm text-muted">Answers use your recorded data. Nothing here is investment advice.</p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-left text-[13px] text-muted transition hover:border-accent/40 hover:text-fg">{s}</button>)}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                  <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", m.role === "user" ? "bg-surface-3" : "bg-accent/15 text-accent")}>{m.role === "user" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "bg-accent/12 text-fg" : m.error ? "border border-loss/30 bg-loss/[.06]" : "border border-border bg-surface-2 text-muted")}>
                    {m.role === "user" ? <p className="text-[13.5px]">{m.content}</p> : <Rich text={m.content} />}
                    {m.role === "assistant" && !m.error && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2 text-[10.5px] text-subtle">
                        <Badge tone={m.mode === "ai" ? "accent" : "amber"}>{m.mode === "ai" ? "AI" : "Demo rules"}</Badge>
                        {m.basis?.length ? <>Based on: {m.basis.join(" · ")}</> : null}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <div className="flex gap-3"><div className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent"><Bot className="h-4 w-4" /></div><div className="flex items-center gap-1 rounded-2xl border border-border bg-surface-2 px-4 py-3">{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${d * 120}ms` }} />)}</div></div>}
              <div ref={endRef} />
            </div>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={1} maxLength={2000} placeholder="Ask about your holdings, P/L, events… (Enter to send)" className="field max-h-32 min-h-[44px] flex-1 resize-none py-2.5" aria-label="Your question" />
            <Button type="submit" variant="primary" className="h-11 w-11 p-0" disabled={!input.trim() || busy} aria-label="Send"><SendHorizonal className="h-4 w-4" /></Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10.5px] text-subtle">Educational information about your own records — not licensed financial advice. Prices are synthetic demo data.</p>
        </form>
      </Card>
    </>
  );
}
