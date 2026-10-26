"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Briefcase, Plus } from "lucide-react";
import { Badge, Button, Card, Delta, EmptyState, Input, SourceNote } from "@/components/ui";
import type { PortfolioSnapshot } from "@/lib/finance/types";
import { sectorOf } from "@/lib/market/symbols";
import { market } from "@/lib/market/demo-provider";
import { fmtDate, fmtInt, fmtNum, pct, pkr, pkrSigned } from "@/lib/format";

type Key = "symbol" | "marketValue" | "unrealized" | "unrealizedPct" | "weight" | "dayChangePct";

export function HoldingsTable({ snap, onAdd }: { snap: PortfolioSnapshot; onAdd: () => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "marketValue", dir: -1 });
  const rows = useMemo(() => {
    const f = snap.holdings.filter((h) => !q || h.symbol.includes(q.toUpperCase()) || sectorOf(h.symbol).toLowerCase().includes(q.toLowerCase()));
    return [...f].sort((a, b) => {
      const av = a[sort.k];
      const bv = b[sort.k];
      return (typeof av === "string" ? String(av).localeCompare(String(bv)) : (av as number) - (bv as number)) * sort.dir;
    });
  }, [snap.holdings, q, sort]);
  const th = (k: Key, label: string, right = true) => (
    <th className={right ? "text-right" : ""}>
      <button className="inline-flex items-center gap-1 uppercase hover:text-fg" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {label}<ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
  if (!snap.holdings.length)
    return (
      <Card><EmptyState icon={<Briefcase className="h-5 w-5" />} title="No open positions" body="Record a purchase or import your broker statement to see holdings, average cost and P/L." action={<Button variant="primary" onClick={onAdd}><Plus className="h-4 w-4" />Record transaction</Button>} /></Card>
    );
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <p className="text-sm font-semibold">{snap.holdings.length} open positions</p>
        <Input placeholder="Filter by symbol or sector" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" aria-label="Filter holdings" />
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              {th("symbol", "Symbol", false)}
              <th className="text-right">Qty</th>
              <th className="text-right">Avg cost</th>
              <th className="text-right">Price</th>
              {th("dayChangePct", "Day")}
              {th("marketValue", "Mkt value")}
              {th("unrealized", "Unrealized")}
              {th("unrealizedPct", "Return")}
              {th("weight", "Weight")}
              <th className="text-right">Realized</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((h) => (
              <tr key={h.symbol}>
                <td>
                  <Link href={`/research?s=${h.symbol}`} className="font-semibold hover:text-accent">{h.symbol}</Link>
                  <span className="block text-[11px] text-subtle">{sectorOf(h.symbol)}</span>
                </td>
                <td className="text-right">{fmtInt(h.quantity)}</td>
                <td className="text-right">{fmtNum(h.avgCost)}</td>
                <td className="text-right">{h.price !== null ? fmtNum(h.price) : <Badge tone="amber">no price</Badge>}</td>
                <td className="text-right"><Delta value={h.dayChangePct}>{pct(h.dayChangePct, 2, true)}</Delta></td>
                <td className="text-right font-medium">{pkr(h.marketValue)}</td>
                <td className="text-right"><Delta value={h.unrealized} icon={false}>{pkrSigned(h.unrealized)}</Delta></td>
                <td className="text-right"><Delta value={h.unrealizedPct}>{pct(h.unrealizedPct, 2, true)}</Delta></td>
                <td className="text-right">{pct(h.weight, 1)}</td>
                <td className="text-right"><Delta value={h.realized} icon={false}>{h.realized ? pkrSigned(h.realized) : "—"}</Delta></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="num">
            <tr className="border-t-2 border-border font-semibold">
              <td className="px-3 py-3">Total</td>
              <td colSpan={4} />
              <td className="px-3 py-3 text-right">{pkr(snap.marketValue)}</td>
              <td className="px-3 py-3 text-right"><Delta value={snap.unrealized} icon={false}>{pkrSigned(snap.unrealized)}</Delta></td>
              <td className="px-3 py-3 text-right"><Delta value={snap.unrealized}>{pct(snap.costBasis ? snap.unrealized / snap.costBasis : 0, 2, true)}</Delta></td>
              <td className="px-3 py-3 text-right">100%</td>
              <td className="px-3 py-3 text-right"><Delta value={snap.realized} icon={false}>{pkrSigned(snap.realized)}</Delta></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap justify-between gap-2 px-5 py-3">
        <p className="text-[11px] text-subtle">Average cost uses the weighted-average method and includes buy-side fees. Bonus shares are added at zero cost.</p>
        <SourceNote source={market.label} asOf={fmtDate(market.asOf())} />
      </div>
      {snap.closedSymbols.length > 0 && <p className="border-t border-border px-5 py-3 text-xs text-muted">Closed positions: {snap.closedSymbols.join(", ")}</p>}
    </Card>
  );
}
