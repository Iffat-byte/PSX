"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button, Field, Input, Modal, NumberInput, Select, Switch, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import { EMOTIONS, type Emotion, type JournalTrade } from "@/lib/finance/types";
import { plannedRewardRisk, tradePnl } from "@/lib/finance/journal";
import { SYMBOL_RE } from "@/components/transaction-form";
import { SYMBOLS } from "@/lib/market/symbols";
import { fmtNum, pkrSigned, todayISO } from "@/lib/format";
import { uid, cn } from "@/lib/utils";

const STEPS = ["Trade", "Plan & risk", "Mindset", "Review"];

const blank = (): JournalTrade => ({
  id: "",
  symbol: "",
  side: "LONG",
  entryDate: todayISO(),
  entryPrice: 0,
  quantity: 0,
  fees: 0,
  tags: [],
  entryReason: "",
  confidence: 3,
  emotionEntry: "Calm",
  followedPlan: true,
  riskRespected: true,
  impulsive: false,
  pressured: false,
  createdAt: 0,
});

export function TradeForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: JournalTrade | null }) {
  const upsert = useApp((s) => s.upsertTrade);
  const [t, setT] = useState<JournalTrade>(blank);
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [tagText, setTagText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const base = editing ? { ...editing } : blank();
    setT(base);
    setClosed(!!(editing?.exitDate && editing.exitPrice !== undefined));
    setTagText(base.tags.join(", "));
    setStep(0);
    setErrors({});
  }, [open, editing]);

  const set = <K extends keyof JournalTrade>(k: K, v: JournalTrade[K]) => setT((p) => ({ ...p, [k]: v }));

  const validateStep = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!SYMBOL_RE.test(t.symbol)) e.symbol = "Enter a valid symbol.";
      if (!(t.entryPrice > 0)) e.entryPrice = "Required.";
      if (!Number.isInteger(t.quantity) || t.quantity <= 0) e.quantity = "Whole number above zero.";
      if (t.entryDate > todayISO()) e.entryDate = "Cannot be in the future.";
      if (t.fees < 0) e.fees = "Cannot be negative.";
      if (closed) {
        if (!t.exitDate) e.exitDate = "Required for a closed trade.";
        else if (t.exitDate < t.entryDate) e.exitDate = "Exit must be on/after entry.";
        else if (t.exitDate > todayISO()) e.exitDate = "Cannot be in the future.";
        if (!(t.exitPrice && t.exitPrice > 0)) e.exitPrice = "Required for a closed trade.";
      }
    }
    if (s === 1) {
      if (t.stopLoss !== undefined && t.stopLoss > 0 && t.side === "LONG" && t.stopLoss >= t.entryPrice) e.stopLoss = "For a long trade the stop should be below entry.";
      if (!t.entryReason.trim()) e.entryReason = "Write a short reason — it powers your behavioral insights.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    for (let s = 0; s < 2; s++) if (!validateStep(s)) return setStep(s);
    const final: JournalTrade = {
      ...t,
      id: t.id || uid("jr-"),
      createdAt: t.createdAt || Date.now(),
      symbol: t.symbol.toUpperCase(),
      tags: tagText.split(",").map((x) => x.trim().toLowerCase().replace(/^#/, "")).filter(Boolean).slice(0, 12),
      exitDate: closed ? t.exitDate : undefined,
      exitPrice: closed ? t.exitPrice : undefined,
      emotionExit: closed ? t.emotionExit : undefined,
      stopLoss: t.stopLoss || undefined,
      target: t.target || undefined,
    };
    upsert(final);
    const p = tradePnl(final);
    toast.success(editing ? "Journal entry updated" : "Trade journaled", p !== null ? `Net result ${pkrSigned(p)}` : "Open trade — close it later to record the outcome.");
    onClose();
  };

  const pnl = closed && t.exitPrice ? tradePnl({ ...t, exitDate: t.exitDate ?? todayISO() }) : null;
  const rr = plannedRewardRisk(t);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${editing.symbol} trade` : "New journal entry"}
      description="Record what you did and why. Honest notes make the Behavior Studio useful."
      footer={
        <>
          {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? <Button variant="primary" onClick={() => validateStep(step) && setStep((s) => s + 1)}>Continue</Button> : <Button variant="primary" onClick={save}>Save entry</Button>}
        </>
      }
    >
      <ol className="mb-5 flex items-center gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <button onClick={() => (i < step || validateStep(step)) && setStep(i)} className={cn("flex items-center gap-2 text-xs font-medium", i === step ? "text-fg" : "text-subtle")} aria-current={i === step ? "step" : undefined}>
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px]", i < step ? "border-accent bg-accent text-accent-fg" : i === step ? "border-accent text-accent" : "border-border")}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Symbol" error={errors.symbol} htmlFor="j-sym"><Input id="j-sym" list="j-syms" value={t.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="e.g. PPL" /><datalist id="j-syms">{SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol} />)}</datalist></Field>
          <Field label="Direction" htmlFor="j-side"><Select id="j-side" value={t.side} onChange={(e) => set("side", e.target.value as JournalTrade["side"])}><option value="LONG">Long (buy then sell)</option><option value="SHORT">Short</option></Select></Field>
          <Field label="Entry date" error={errors.entryDate} htmlFor="j-ed"><Input id="j-ed" type="date" max={todayISO()} value={t.entryDate} onChange={(e) => set("entryDate", e.target.value)} /></Field>
          <Field label="Entry price" error={errors.entryPrice} htmlFor="j-ep"><NumberInput id="j-ep" value={t.entryPrice} min={0} onChange={(v) => set("entryPrice", v)} prefix="Rs" /></Field>
          <Field label="Quantity" error={errors.quantity} htmlFor="j-q"><NumberInput id="j-q" value={t.quantity} min={0} step={1} onChange={(v) => set("quantity", v)} /></Field>
          <Field label="Total fees (entry + exit)" error={errors.fees} htmlFor="j-f"><NumberInput id="j-f" value={t.fees} min={0} onChange={(v) => set("fees", v)} prefix="Rs" /></Field>
          <div className="sm:col-span-2"><Switch checked={closed} onChange={setClosed} label="Trade is closed" description="Add the exit to record the realized result." /></div>
          {closed && (
            <>
              <Field label="Exit date" error={errors.exitDate} htmlFor="j-xd"><Input id="j-xd" type="date" max={todayISO()} value={t.exitDate ?? ""} onChange={(e) => set("exitDate", e.target.value)} /></Field>
              <Field label="Exit price" error={errors.exitPrice} htmlFor="j-xp"><NumberInput id="j-xp" value={t.exitPrice ?? 0} min={0} onChange={(v) => set("exitPrice", v)} prefix="Rs" /></Field>
            </>
          )}
          {pnl !== null && <p className="num text-sm sm:col-span-2">Net result: <span className={pnl >= 0 ? "text-gain" : "text-loss"}>{pkrSigned(pnl, 2)}</span></p>}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Planned stop-loss" error={errors.stopLoss} htmlFor="j-sl" hint="Enables R-multiple analysis"><NumberInput id="j-sl" value={t.stopLoss ?? 0} min={0} onChange={(v) => set("stopLoss", v || undefined)} prefix="Rs" /></Field>
          <Field label="Planned target" htmlFor="j-tg" hint={rr ? `Planned reward:risk ${fmtNum(rr, 2)} : 1` : undefined}><NumberInput id="j-tg" value={t.target ?? 0} min={0} onChange={(v) => set("target", v || undefined)} prefix="Rs" /></Field>
          <Field label="Strategy / setup" htmlFor="j-st"><Input id="j-st" value={t.strategy ?? ""} onChange={(e) => set("strategy", e.target.value)} placeholder="e.g. Breakout, Pullback, Results play" maxLength={40} /></Field>
          <Field label="Tags (comma separated)" htmlFor="j-tags"><Input id="j-tags" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="banking, swing, earnings" /></Field>
          <Field label="Why did you enter?" error={errors.entryReason} className="sm:col-span-2" htmlFor="j-er"><Textarea id="j-er" value={t.entryReason} onChange={(e) => set("entryReason", e.target.value)} maxLength={1000} /></Field>
          <div className="space-y-3 sm:col-span-2">
            <Switch checked={t.followedPlan} onChange={(v) => set("followedPlan", v)} label="This trade followed my written plan" />
            <Switch checked={t.riskRespected} onChange={(v) => set("riskRespected", v)} label="I respected my risk rules (size & stop)" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <p className="label">Confidence at entry</p>
            <div className="flex gap-2">{[1, 2, 3, 4, 5].map((c) => <button key={c} onClick={() => set("confidence", c)} className={cn("h-10 flex-1 rounded-xl border text-sm font-semibold", t.confidence === c ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-fg")} aria-pressed={t.confidence === c}>{c}</button>)}</div>
            <p className="mt-1 flex justify-between text-[11px] text-subtle"><span>Low</span><span>High</span></p>
          </div>
          <EmotionPicker label="How did you feel when entering?" value={t.emotionEntry} onChange={(e) => set("emotionEntry", e)} />
          {closed && <EmotionPicker label="How did you feel when exiting?" value={t.emotionExit} onChange={(e) => set("emotionExit", e)} />}
          <div className="space-y-3">
            <Switch checked={t.impulsive} onChange={(v) => set("impulsive", v)} label="The decision felt impulsive" />
            <Switch checked={t.pressured} onChange={(v) => set("pressured", v)} label="I felt pressured (news, tips, social media, others)" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4">
          {closed && <Field label="Why did you exit?" htmlFor="j-xr"><Textarea id="j-xr" value={t.exitReason ?? ""} onChange={(e) => set("exitReason", e.target.value)} maxLength={1000} /></Field>}
          <Field label="Lessons learned" htmlFor="j-ls" hint="What would you repeat or change next time?"><Textarea id="j-ls" value={t.lessons ?? ""} onChange={(e) => set("lessons", e.target.value)} maxLength={1500} /></Field>
          <Field label="Other notes" htmlFor="j-n"><Textarea id="j-n" value={t.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={1500} /></Field>
        </div>
      )}
    </Modal>
  );
}

function EmotionPicker({ label, value, onChange }: { label: string; value?: Emotion; onChange: (e: Emotion) => void }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {EMOTIONS.map((e) => <button key={e} onClick={() => onChange(e)} aria-pressed={value === e} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", value === e ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-fg")}>{e}</button>)}
      </div>
    </div>
  );
}
