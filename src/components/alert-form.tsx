"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Modal, NumberInput, Select, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import type { AlertKind } from "@/store/types";
import { ALERT_LABELS } from "@/lib/alerts";
import { getQuotes } from "@/lib/hooks";
import { SYMBOLS } from "@/lib/market/symbols";
import { SYMBOL_RE } from "./transaction-form";
import { fmtInt, fmtNum } from "@/lib/format";

export function AlertForm({ open, onClose, symbol: initial }: { open: boolean; onClose: () => void; symbol?: string }) {
  const add = useApp((s) => s.addAlert);
  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<AlertKind>("above");
  const [value, setValue] = useState(0);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setSymbol(initial ?? "");
    setKind("above");
    setValue(initial ? Math.round((getQuotes()[initial]?.price ?? 0) * 1.05) : 0);
    setNote("");
    setErr({});
  }, [open, initial]);
  const q = getQuotes()[symbol];
  const save = () => {
    const e: Record<string, string> = {};
    if (!SYMBOL_RE.test(symbol)) e.symbol = "Enter a valid symbol.";
    if (!(value > 0)) e.value = "Enter a value above zero.";
    if ((kind === "pctUp" || kind === "pctDown" || kind === "positionWeight") && value > 100) e.value = "Percent must be 100 or less.";
    setErr(e);
    if (Object.keys(e).length) return;
    add({ symbol, kind, value, note: note.trim() || undefined });
    toast.success("Alert created", "Evaluated in-app against the current data source.");
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Create alert" size="sm" description="Alerts are checked while PSX Pilot is open, against demo data until a licensed feed is connected." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Create alert</Button></>}>
      <div className="space-y-4">
        <Field label="Symbol" error={err.symbol} htmlFor="al-s" hint={q ? `Latest demo close Rs ${fmtNum(q.price)} · volume ${fmtInt(q.volume)}` : undefined}>
          <Input id="al-s" list="al-syms" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          <datalist id="al-syms">{SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol} />)}</datalist>
        </Field>
        <Field label="Condition" htmlFor="al-k"><Select id="al-k" value={kind} onChange={(e) => setKind(e.target.value as AlertKind)}>{Object.entries(ALERT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Value" error={err.value} htmlFor="al-v"><NumberInput id="al-v" value={value} min={0} onChange={setValue} suffix={kind === "above" || kind === "below" ? "Rs" : kind === "volumeAbove" ? "sh" : "%"} /></Field>
        <Field label="Note (optional)" htmlFor="al-n"><Textarea id="al-n" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
      </div>
    </Modal>
  );
}
