"use client";

import { useState } from "react";
import { CheckCircle2, Scale } from "lucide-react";
import { Badge, Button, Card, CardHeader, NumberInput, Notice } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import type { PortfolioSnapshot } from "@/lib/finance/types";
import { useApp } from "@/store/app-store";
import { fmtInt, pkr, todayISO } from "@/lib/format";

export function ReconcilePanel({ snap, portfolioId }: { snap: PortfolioSnapshot; portfolioId: string }) {
  const add = useApp((s) => s.addTransactions);
  const [brokerCash, setBrokerCash] = useState<number>(Math.round(snap.cash));
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(snap.holdings.map((h) => [h.symbol, h.quantity])));
  const cashDiff = Math.round((brokerCash - snap.cash) * 100) / 100;
  const qtyDiffs = snap.holdings.filter((h) => (qty[h.symbol] ?? h.quantity) !== h.quantity);

  const adjustCash = () => {
    if (!cashDiff) return;
    add([{ portfolioId, date: todayISO(), type: cashDiff > 0 ? "DEPOSIT" : "WITHDRAWAL", amount: Math.abs(cashDiff), quantity: 0, price: 0, fees: 0, note: "Reconciliation adjustment to match broker cash balance", source: "manual" }]);
    toast.success("Cash reconciled", `${cashDiff > 0 ? "Deposit" : "Withdrawal"} of ${pkr(Math.abs(cashDiff), 2)} recorded.`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader icon={<Scale className="h-4 w-4" />} title="Cash reconciliation" subtitle="Compare with the cash balance on your broker statement" />
        <div className="space-y-4 px-5 pb-5">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="label">PSX Pilot cash (from ledger)</p><p className="num text-lg font-semibold">{pkr(snap.cash, 2)}</p></div>
            <div><label className="label" htmlFor="bcash">Broker-reported cash</label><NumberInput id="bcash" value={brokerCash} onChange={setBrokerCash} prefix="Rs" /></div>
          </div>
          {cashDiff === 0 ? (
            <Notice tone="accent" title="Balanced">Your ledger cash matches the broker figure.</Notice>
          ) : (
            <Notice tone="amber" title={`Difference: ${pkr(cashDiff, 2)}`} action={<Button size="sm" variant="primary" onClick={adjustCash}>Record adjustment</Button>}>
              Usually caused by unrecorded deposits, withdrawals, dividends or charges. Prefer recording the actual missing entries; use an adjustment only if you can&apos;t identify them.
            </Notice>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Holdings reconciliation" subtitle="Enter the share counts from your CDC / broker statement" />
        <div className="px-5 pb-5">
          {snap.holdings.length === 0 ? <p className="text-sm text-muted">No open positions to reconcile.</p> : (
            <table className="table-base">
              <thead><tr><th>Symbol</th><th className="text-right">Ledger</th><th className="text-right">Statement</th><th className="text-right">Diff</th></tr></thead>
              <tbody className="num">
                {snap.holdings.map((h) => {
                  const d = (qty[h.symbol] ?? h.quantity) - h.quantity;
                  return (
                    <tr key={h.symbol}>
                      <td className="font-medium">{h.symbol}</td>
                      <td className="text-right">{fmtInt(h.quantity)}</td>
                      <td className="w-32"><NumberInput aria-label={`Statement quantity for ${h.symbol}`} value={qty[h.symbol] ?? h.quantity} step={1} onChange={(n) => setQty((q) => ({ ...q, [h.symbol]: n }))} className="h-8 text-right" /></td>
                      <td className="text-right">{d === 0 ? <Badge tone="gain">match</Badge> : <Badge tone="loss">{d > 0 ? "+" : ""}{fmtInt(d)}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {qtyDiffs.length > 0 && <p className="mt-3 text-xs text-muted">Differences usually mean a missing buy, sell or bonus entry. Record the missing transaction with its actual date and price so cost and P/L stay accurate.</p>}
        </div>
      </Card>
    </div>
  );
}
