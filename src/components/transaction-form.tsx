"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Button, Field, Input, Modal, NumberInput, Select, Textarea } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import type { Transaction, TxType } from "@/lib/finance/types";
import { quantityHeld, replayLedger } from "@/lib/finance/portfolio";
import { estimateFees, isFeeProfileConfigured } from "@/lib/finance/fees";
import { SYMBOLS } from "@/lib/market/symbols";
import { getQuotes } from "@/lib/hooks";
import { fmtInt, pkr, todayISO } from "@/lib/format";

const TYPES: { value: TxType; label: string }[] = [
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "DIVIDEND", label: "Dividend received" },
  { value: "BONUS", label: "Bonus shares" },
  { value: "DEPOSIT", label: "Cash deposit" },
  { value: "WITHDRAWAL", label: "Cash withdrawal" },
  { value: "FEE", label: "Other fee / charge" },
];

export const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  defaults?: Partial<Transaction>;
  portfolioId?: string;
}

export function TransactionForm({ open, onClose, editing, defaults, portfolioId }: Props) {
  const portfolios = useApp((s) => s.portfolios);
  const active = useApp((s) => s.activePortfolioId);
  const allTx = useApp((s) => s.transactions);
  const fees = useApp((s) => s.settings.feeProfile);
  const add = useApp((s) => s.addTransactions);
  const update = useApp((s) => s.updateTransaction);

  const blank = (): Omit<Transaction, "id" | "createdAt"> => ({
    portfolioId: portfolioId ?? active,
    type: "BUY",
    date: todayISO(),
    symbol: "",
    quantity: 0,
    price: 0,
    fees: 0,
    amount: 0,
    note: "",
    source: "manual",
    ...defaults,
  });
  const [f, setF] = useState(blank);
  const [autoFee, setAutoFee] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setF({ ...editing });
      setAutoFee(false);
    } else {
      setF(blank());
      setAutoFee(isFeeProfileConfigured(fees));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const isTrade = f.type === "BUY" || f.type === "SELL";
  const needsSymbol = isTrade || f.type === "DIVIDEND" || f.type === "BONUS";
  const isCash = f.type === "DEPOSIT" || f.type === "WITHDRAWAL" || f.type === "FEE" || f.type === "DIVIDEND";

  useEffect(() => {
    if (autoFee && isTrade) set("fees", estimateFees(fees, f.quantity, f.price));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFee, f.quantity, f.price, f.type]);

  const held = useMemo(() => {
    if (!f.symbol) return null;
    const pfTx = allTx.filter((t) => t.portfolioId === f.portfolioId);
    return quantityHeld(pfTx, f.symbol.toUpperCase(), f.date, editing?.id);
  }, [allTx, f.portfolioId, f.symbol, f.date, editing]);

  const total = isTrade ? f.quantity * f.price + (f.type === "BUY" ? f.fees : -f.fees) : f.amount;
  const quote = f.symbol ? getQuotes()[f.symbol.toUpperCase()] : undefined;

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!f.date) e.date = "Date is required.";
    else if (f.date > todayISO()) e.date = "Date cannot be in the future.";
    const sym = (f.symbol ?? "").trim().toUpperCase();
    if (needsSymbol && !SYMBOL_RE.test(sym)) e.symbol = "Enter a valid PSX symbol (e.g. OGDC).";
    if (isTrade || f.type === "BONUS") {
      if (!Number.isInteger(f.quantity) || f.quantity <= 0) e.quantity = "Quantity must be a whole number above zero.";
    }
    if (isTrade && !(f.price > 0)) e.price = "Price must be greater than zero.";
    if (isTrade && f.fees < 0) e.fees = "Fees cannot be negative.";
    if (isCash && !(f.amount > 0)) e.amount = "Amount must be greater than zero.";
    if (f.type === "SELL" && held !== null && f.quantity > held + 1e-9) e.quantity = `You held ${fmtInt(held)} ${sym} on this date.`;
    if (!Object.keys(e).length) {
      // Make sure the change doesn't invalidate later sales.
      const pfTx = allTx.filter((t) => t.portfolioId === f.portfolioId && t.id !== editing?.id);
      const before = replayLedger(pfTx).issues.length;
      const candidate: Transaction = { ...(f as Transaction), id: editing?.id ?? "candidate", createdAt: editing?.createdAt ?? Date.now(), symbol: sym || undefined };
      const after = replayLedger([...pfTx, candidate]).issues.length;
      if (after > before) e.form = "This change would make a later sale exceed the shares held. Adjust or remove that sale first.";
    }
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const clean: Omit<Transaction, "id" | "createdAt"> = {
      ...f,
      symbol: needsSymbol ? f.symbol!.trim().toUpperCase() : undefined,
      quantity: isTrade || f.type === "BONUS" ? f.quantity : 0,
      price: isTrade ? f.price : 0,
      fees: isTrade ? f.fees : 0,
      amount: isCash ? f.amount : 0,
      note: f.note?.trim() || undefined,
    };
    if (editing) {
      update(editing.id, clean);
      toast.success("Transaction updated");
    } else {
      add([clean]);
      toast.success(`${TYPES.find((t) => t.value === f.type)?.label} recorded`, clean.symbol ? `${clean.symbol} · ${pkr(total, 2)}` : pkr(total, 2));
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit transaction" : "Record transaction"}
      description="Holdings, average cost and P/L are recalculated from your transaction ledger."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{editing ? "Save changes" : "Record"}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Portfolio" htmlFor="tx-pf">
          <Select id="tx-pf" value={f.portfolioId} onChange={(e) => set("portfolioId", e.target.value)} disabled={!!portfolioId}>
            {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}{p.kind === "paper" ? " (paper)" : ""}</option>)}
          </Select>
        </Field>
        <Field label="Type" htmlFor="tx-type">
          <Select id="tx-type" value={f.type} onChange={(e) => set("type", e.target.value as TxType)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Date" htmlFor="tx-date" error={errors.date}>
          <Input id="tx-date" type="date" value={f.date} max={todayISO()} onChange={(e) => set("date", e.target.value)} />
        </Field>
        {needsSymbol && (
          <Field label="Symbol" htmlFor="tx-sym" error={errors.symbol} hint={held !== null && f.symbol ? `Held on this date: ${fmtInt(held)} shares` : "Type or pick a PSX symbol"}>
            <Input id="tx-sym" list="psx-symbols" value={f.symbol ?? ""} onChange={(e) => set("symbol", e.target.value.toUpperCase())} placeholder="e.g. OGDC" autoComplete="off" />
            <datalist id="psx-symbols">{SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.name}</option>)}</datalist>
          </Field>
        )}
        {(isTrade || f.type === "BONUS") && (
          <Field label={f.type === "BONUS" ? "Bonus shares received" : "Quantity (shares)"} htmlFor="tx-qty" error={errors.quantity}>
            <NumberInput id="tx-qty" value={f.quantity} min={0} step={1} onChange={(n) => set("quantity", n)} />
          </Field>
        )}
        {isTrade && (
          <Field label="Price per share" htmlFor="tx-price" error={errors.price} hint={quote ? <button type="button" className="text-accent hover:underline" onClick={() => set("price", quote.price)}>Use latest demo close: Rs {quote.price}</button> : undefined}>
            <NumberInput id="tx-price" value={f.price} min={0} onChange={(n) => set("price", n)} prefix="Rs" />
          </Field>
        )}
        {isTrade && (
          <Field
            label="Fees & charges"
            htmlFor="tx-fees"
            error={errors.fees}
            hint={
              isFeeProfileConfigured(fees) ? (
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={autoFee} onChange={(e) => setAutoFee(e.target.checked)} /> Auto-estimate from my fee profile</label>
              ) : (
                <a href="/settings#fees" className="text-accent hover:underline">Set up your broker fee profile to auto-estimate</a>
              )
            }
          >
            <NumberInput id="tx-fees" value={f.fees} min={0} onChange={(n) => { setAutoFee(false); set("fees", n); }} prefix="Rs" />
          </Field>
        )}
        {isCash && (
          <Field label={f.type === "DIVIDEND" ? "Net amount received" : "Amount"} htmlFor="tx-amt" error={errors.amount} hint={f.type === "DIVIDEND" ? "Enter the amount actually credited, after withholding tax." : undefined}>
            <NumberInput id="tx-amt" value={f.amount} min={0} onChange={(n) => set("amount", n)} prefix="Rs" />
          </Field>
        )}
        <Field label="Note (optional)" className="sm:col-span-2" htmlFor="tx-note">
          <Textarea id="tx-note" rows={2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} maxLength={500} placeholder="Why did you make this transaction?" />
        </Field>
        {isTrade && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3 sm:col-span-2">
            <span className="flex items-center gap-2 text-xs text-muted"><Calculator className="h-4 w-4" /> {f.type === "BUY" ? "Total cost incl. fees" : "Net proceeds after fees"}</span>
            <span className="num text-base font-semibold">{pkr(total, 2)}</span>
          </div>
        )}
        {errors.form && <p className="text-xs text-loss sm:col-span-2">{errors.form}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
