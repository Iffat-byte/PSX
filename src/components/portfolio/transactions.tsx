"use client";

import { useMemo, useState } from "react";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { Badge, Card, ConfirmButton, EmptyState, Input, Select, Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import type { Transaction, TxType } from "@/lib/finance/types";
import { sortTransactions } from "@/lib/finance/portfolio";
import { useApp } from "@/store/app-store";
import { fmtDate, fmtInt, fmtNum, pkr } from "@/lib/format";

const tone: Record<TxType, "gain" | "loss" | "info" | "accent" | "amber" | "neutral"> = { BUY: "info", SELL: "amber", DIVIDEND: "gain", BONUS: "accent", DEPOSIT: "neutral", WITHDRAWAL: "neutral", FEE: "loss" };

export function TransactionsTable({ txs, issues, onEdit }: { txs: Transaction[]; issues: Set<string>; onEdit: (t: Transaction) => void }) {
  const del = useApp((s) => s.deleteTransaction);
  const add = useApp((s) => s.addTransactions);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | TxType>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const PER = 25;
  const rows = useMemo(
    () =>
      sortTransactions(txs)
        .reverse()
        .filter((t) => (!type || t.type === type) && (!q || (t.symbol ?? "").includes(q.toUpperCase()) || (t.note ?? "").toLowerCase().includes(q.toLowerCase())) && (!from || t.date >= from) && (!to || t.date <= to)),
    [txs, q, type, from, to],
  );
  const pageRows = rows.slice(page * PER, page * PER + PER);

  return (
    <Card>
      <div className="grid gap-2 px-5 pt-4 pb-3 sm:grid-cols-[1fr_160px_150px_150px]">
        <Input placeholder="Search symbol or note" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search transactions" />
        <Select value={type} onChange={(e) => { setType(e.target.value as TxType | ""); setPage(0); }} aria-label="Filter type">
          <option value="">All types</option>
          {Object.keys(tone).map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<Receipt className="h-5 w-5" />} title={txs.length ? "No transactions match your filters" : "No transactions yet"} body="Every holding and P/L figure is derived from this ledger." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Date</th><th>Type</th><th>Symbol</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Fees</th><th className="text-right">Cash impact</th><th>Note</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody className="num">
              {pageRows.map((t) => {
                const impact = t.type === "BUY" ? -(t.quantity * t.price + t.fees) : t.type === "SELL" ? t.quantity * t.price - t.fees : t.type === "DEPOSIT" || t.type === "DIVIDEND" ? t.amount : t.type === "BONUS" ? 0 : -t.amount;
                return (
                  <tr key={t.id} className={issues.has(t.id) ? "bg-loss/5" : ""}>
                    <td>{fmtDate(t.date)}</td>
                    <td><Badge tone={tone[t.type]}>{t.type}</Badge>{issues.has(t.id) && <Badge tone="loss" className="ml-1">ignored</Badge>}</td>
                    <td className="font-medium">{t.symbol ?? "—"}</td>
                    <td className="text-right">{t.quantity ? fmtInt(t.quantity) : "—"}</td>
                    <td className="text-right">{t.price ? fmtNum(t.price) : "—"}</td>
                    <td className="text-right">{t.fees ? fmtNum(t.fees) : "—"}</td>
                    <td className={`text-right ${impact > 0 ? "text-gain" : impact < 0 ? "text-fg" : "text-subtle"}`}>{impact ? pkr(impact, 2) : "—"}</td>
                    <td className="max-w-[220px] truncate text-xs text-muted" title={t.note}>{t.note ?? ""} {t.source !== "manual" && <Badge>{t.source}</Badge>}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Edit transaction" onClick={() => onEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <ConfirmButton
                          size="icon"
                          aria-label="Delete transaction"
                          title="Delete this transaction?"
                          body="Holdings, average cost and P/L will be recalculated. Deleting a buy may invalidate later sales."
                          onConfirm={() => {
                            del(t.id);
                            toast.success("Transaction deleted", undefined, { label: "Undo", run: () => add([{ portfolioId: t.portfolioId, date: t.date, type: t.type, symbol: t.symbol, quantity: t.quantity, price: t.price, fees: t.fees, amount: t.amount, note: t.note, source: t.source }]) });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </ConfirmButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between px-5 py-3 text-xs text-muted">
        <span>{rows.length} transaction{rows.length === 1 ? "" : "s"}</span>
        {rows.length > PER && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page + 1} / {Math.ceil(rows.length / PER)}</span>
            <Button size="sm" variant="ghost" disabled={(page + 1) * PER >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
