"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { Badge, Button, Card, CardHeader, Notice, Switch } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { CSV_TEMPLATE, parseBrokerCSV, type ParsedRow } from "@/lib/import/csv";
import { findDuplicates, replayLedger } from "@/lib/finance/portfolio";
import { useApp } from "@/store/app-store";
import { downloadFile } from "@/lib/utils";
import { fmtDate, fmtInt, fmtNum, pkr } from "@/lib/format";
import type { Transaction } from "@/lib/finance/types";

export function ImportPanel({ portfolioId, existing }: { portfolioId: string; existing: Transaction[] }) {
  const add = useApp((s) => s.addTransactions);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [cols, setCols] = useState<Record<string, string | undefined>>({});
  const [skipDupes, setSkipDupes] = useState(true);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const dupes = useMemo(() => {
    if (!rows) return new Set<number>();
    const valid = rows.map((r) => r.tx ?? { date: "", type: "FEE" as const, quantity: -1, price: -1, amount: -1 });
    return findDuplicates(valid, existing);
  }, [rows, existing]);

  const toImport = useMemo(() => (rows ? rows.filter((r, i) => r.tx && !(skipDupes && dupes.has(i))) : []), [rows, skipDupes, dupes]);
  const ledgerCheck = useMemo(() => {
    const cand = toImport.map((r, i) => ({ ...r.tx!, id: `c${i}`, createdAt: i, portfolioId, source: "import" as const }));
    return replayLedger([...existing, ...cand]).issues.length - replayLedger(existing).issues.length;
  }, [toImport, existing, portfolioId]);

  async function handleFile(f: File) {
    if (f.size > 5_000_000) return toast.error("File too large", "Maximum 5 MB.");
    if (!/\.(csv|txt)$/i.test(f.name)) {
      toast.warning("Please upload a CSV file", "Excel users: File → Save As → CSV, then upload here.");
      return;
    }
    const text = await f.text();
    const parsed = parseBrokerCSV(text);
    if (!parsed.columns.date || !parsed.columns.type) {
      toast.error("Missing required columns", "The file needs at least date and type columns. Download the template to see the format.");
      return;
    }
    setFileName(f.name);
    setCols(parsed.columns);
    setRows(parsed.rows);
  }

  function commit() {
    if (!toImport.length) return;
    add(toImport.map((r) => ({ ...r.tx!, portfolioId, source: "import" as const })));
    toast.success(`Imported ${toImport.length} transactions`, `${fileName}${dupes.size && skipDupes ? ` · ${dupes.size} duplicates skipped` : ""}`);
    setRows(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader icon={<Upload className="h-4 w-4" />} title="Import broker statement" subtitle="Read-only CSV import. PSX Pilot never asks for or stores broker credentials." />
        <div className="px-5 pb-5">
          {!rows ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${drag ? "border-accent bg-accent/5" : "border-border"}`}
            >
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent"><FileUp className="h-6 w-6" /></div>
              <p className="text-sm font-semibold">Drop a CSV file here</p>
              <p className="mt-1 text-xs text-muted">Columns are matched automatically (date, type/side, symbol/scrip, qty, price/rate, commission…)</p>
              <Button className="mt-4" variant="primary" onClick={() => input.current?.click()}>Choose file</Button>
              <input ref={input} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="info">{fileName}</Badge>
                <Badge tone="gain">{rows.filter((r) => r.tx).length} valid</Badge>
                {rows.some((r) => r.error) && <Badge tone="loss">{rows.filter((r) => r.error).length} errors</Badge>}
                {dupes.size > 0 && <Badge tone="amber">{dupes.size} possible duplicates</Badge>}
                <span className="text-subtle">Matched: {Object.entries(cols).filter(([, v]) => v).map(([k, v]) => `${k}←"${v}"`).join(", ")}</span>
              </div>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                <table className="table-base">
                  <thead className="sticky top-0 bg-surface"><tr><th>Line</th><th>Status</th><th>Date</th><th>Type</th><th>Symbol</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Fees</th><th className="text-right">Amount</th></tr></thead>
                  <tbody className="num">
                    {rows.map((r, i) => (
                      <tr key={r.line} className={r.error ? "bg-loss/5" : dupes.has(i) ? "bg-amber/5" : ""}>
                        <td className="text-subtle">{r.line}</td>
                        <td>{r.error ? <span className="text-xs text-loss">{r.error}</span> : dupes.has(i) ? <Badge tone="amber">duplicate</Badge> : <Badge tone="gain">ok</Badge>}</td>
                        <td>{r.tx ? fmtDate(r.tx.date) : "—"}</td>
                        <td>{r.tx?.type ?? "—"}</td>
                        <td>{r.tx?.symbol ?? "—"}</td>
                        <td className="text-right">{r.tx?.quantity ? fmtInt(r.tx.quantity) : "—"}</td>
                        <td className="text-right">{r.tx?.price ? fmtNum(r.tx.price) : "—"}</td>
                        <td className="text-right">{r.tx?.fees ? fmtNum(r.tx.fees) : "—"}</td>
                        <td className="text-right">{r.tx?.amount ? pkr(r.tx.amount) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ledgerCheck > 0 && <Notice tone="loss" className="mt-3" title="Some sales exceed holdings">After import, {ledgerCheck} sale(s) would exceed the shares held and will be ignored in calculations. Check that the statement includes the earlier purchases.</Notice>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Switch checked={skipDupes} onChange={setSkipDupes} label="Skip possible duplicates" description="Same date, type, symbol, quantity, price and amount." />
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setRows(null)}>Cancel</Button>
                  <Button variant="primary" onClick={commit} disabled={!toImport.length}>Import {toImport.length} rows</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
      <Card className="p-5 text-xs leading-relaxed text-muted">
        <p className="mb-2 text-sm font-semibold text-fg">Format</p>
        <p>One row per transaction. Supported types: BUY, SELL, DIVIDEND, BONUS, DEPOSIT, WITHDRAWAL, FEE. Dates as YYYY-MM-DD, DD/MM/YYYY or 05-Jan-2026.</p>
        <p className="mt-2">Excel (.xlsx) statements: save as CSV first. Direct Excel parsing is planned.</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={() => downloadFile("psx-pilot-import-template.csv", CSV_TEMPLATE)}><Download className="h-4 w-4" />Download template</Button>
      </Card>
    </div>
  );
}
