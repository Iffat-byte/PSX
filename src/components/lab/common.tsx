"use client";

import { useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import { Button, Card, Field, Input, Modal, Select } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import { useSnapshot } from "@/lib/hooks";
import type { Holding } from "@/lib/finance/types";

export function CalcLayout({ inputs, results, title, description, actions }: { inputs: ReactNode; results: ReactNode; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit p-5 lg:sticky lg:top-20">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          </div>
        </div>
        <div className="space-y-4">{inputs}</div>
        {actions && <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">{actions}</div>}
      </Card>
      <div className="min-w-0 space-y-4">{results}</div>
    </div>
  );
}

export function ResultTile({ label, value, sub, emphasis }: { label: string; value: ReactNode; sub?: ReactNode; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? "border-accent/30 bg-accent/[.06]" : "border-border bg-surface"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function SaveScenario({ calculator, inputs, summary }: { calculator: string; inputs: Record<string, number | string>; summary: string }) {
  const save = useApp((s) => s.saveScenario);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setName(""); setOpen(true); }}><Save className="h-4 w-4" />Save scenario</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Save scenario" size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { save({ calculator, name: name.trim() || `${calculator} scenario`, inputs, summary }); setOpen(false); toast.success("Scenario saved", "Find it under Saved scenarios."); }}>Save</Button></>}>
        <Field label="Scenario name" htmlFor="sc-name"><Input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OGDC average-down at 190" maxLength={60} /></Field>
        <p className="mt-3 text-xs text-muted">{summary}</p>
      </Modal>
    </>
  );
}

export function HoldingPicker({ onPick }: { onPick: (h: Holding) => void }) {
  const snap = useSnapshot();
  if (!snap.holdings.length) return null;
  return (
    <Field label="Load from my holdings" htmlFor="hp">
      <Select id="hp" defaultValue="" onChange={(e) => { const h = snap.holdings.find((x) => x.symbol === e.target.value); if (h) onPick(h); }}>
        <option value="" disabled>Choose a holding…</option>
        {snap.holdings.map((h) => <option key={h.symbol} value={h.symbol}>{h.symbol} · {h.quantity} sh</option>)}
      </Select>
    </Field>
  );
}

export const Disclaimer = () => (
  <p className="text-[11px] leading-relaxed text-subtle">Hypothetical calculation based on your inputs. It is not a forecast, price target or recommendation. Actual results depend on execution prices, fees, taxes and market conditions.</p>
);
