"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, BookOpen, ExternalLink, HelpCircle, Moon, Plus, ShieldQuestion, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, Field, Input, Modal, Notice, NumberInput, PageHeader, Select } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { SimpleLineChart } from "@/components/charts";
import { useApp } from "@/store/app-store";
import type { ShariahRecord } from "@/store/types";
import { useSnapshot } from "@/lib/hooks";
import { market } from "@/lib/market/demo-provider";
import { SYMBOL_MAP, SYMBOLS } from "@/lib/market/symbols";
import { fmtDate, pkr, todayISO } from "@/lib/format";

const CRITERIA = [
  { t: "Business activity screen", d: "The company's core business must not be in prohibited activities (e.g. conventional interest-based finance, alcohol, gambling, pork). Many screens also cap the share of revenue from non-compliant sources." },
  { t: "Interest-bearing debt", d: "Interest-bearing debt relative to total assets must stay below a threshold set by the methodology." },
  { t: "Non-compliant investments", d: "Investments in non-Shariah-compliant instruments relative to total assets must stay below a threshold." },
  { t: "Non-compliant income", d: "Income from non-compliant sources as a share of total revenue must be below a threshold; this portion is typically purified." },
  { t: "Illiquid assets", d: "A minimum share of total assets is generally required to be illiquid (real assets), so that shares are not equivalent to trading money." },
  { t: "Net liquid assets vs. price", d: "The market price per share should generally exceed net liquid assets per share." },
];

export default function ShariahPage() {
  const records = useApp((s) => s.shariah);
  const lists = useApp((s) => s.watchlists);
  const del = useApp((s) => s.deleteShariahRecord);
  const snap = useSnapshot();
  const [open, setOpen] = useState(false);
  const [purify, setPurify] = useState({ symbol: "", ratio: 0, dividend: 0, capitalGain: 0 });

  const latest = useMemo(() => {
    const m = new Map<string, ShariahRecord>();
    for (const r of [...records].sort((a, b) => (a.publishedOn < b.publishedOn ? -1 : 1))) m.set(r.symbol, r);
    return m;
  }, [records]);
  const universe = [...new Set([...snap.holdings.map((h) => h.symbol), ...lists.filter((l) => l.kind === "shariah").flatMap((l) => l.items.map((i) => i.symbol))])];
  const kmi = market.history("KMI30").slice(-252).map((p) => ({ date: p.date, v: p.close }));

  return (
    <>
      <PageHeader title="Shariah-Compliant Investing Center" description="Track officially published compliance classifications, understand screening criteria and keep Shariah research lists."
        actions={<Button variant="primary" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Record official status</Button>} />
      <Notice tone="info" className="mb-4" title="PSX Pilot does not certify compliance">Every symbol shows <strong>Status Not Verified</strong> unless you record a classification from an official published source (for example, the index provider&apos;s or a Shariah board&apos;s published list) with its publication date. We do not run our own screening or issue rulings. Consult a qualified Shariah scholar for personal guidance.</Notice>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader icon={<Moon className="h-4 w-4" />} title="Your holdings & Shariah lists" subtitle="Latest recorded status from official sources" />
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Symbol</th><th>Status</th><th>Source</th><th>Published</th><th>Recorded</th></tr></thead>
              <tbody>
                {universe.map((s) => {
                  const r = latest.get(s);
                  return (
                    <tr key={s}>
                      <td><span className="font-semibold">{s}</span><span className="block text-[11px] text-subtle">{SYMBOL_MAP[s]?.name}</span></td>
                      <td>{r ? <Badge tone={r.status === "Compliant" ? "gain" : "loss"}><BadgeCheck className="h-3 w-3" />{r.status}</Badge> : <Badge><ShieldQuestion className="h-3 w-3" />Status Not Verified</Badge>}</td>
                      <td className="max-w-[200px] truncate text-xs">{r ? (r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-accent hover:underline">{r.sourceName}<ExternalLink className="h-3 w-3" /></a> : r.sourceName) : <span className="text-subtle">—</span>}</td>
                      <td className="text-xs">{r ? fmtDate(r.publishedOn) : "—"}</td>
                      <td className="text-xs text-subtle">{r ? fmtDate(new Date(r.recordedAt).toISOString()) : "—"}</td>
                    </tr>
                  );
                })}
                {!universe.length && <tr><td colSpan={5} className="py-6 text-center text-sm text-muted">Add holdings or create a Shariah-type watchlist.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="KMI-30 index" subtitle="Shariah-compliant benchmark index of the PSX" />
            <div className="px-3"><SimpleLineChart data={kmi} xKey="date" xFormat={(d) => fmtDate(d, { month: "short" })} yFormat={(v) => (v / 1000).toFixed(0) + "k"} lines={[{ key: "v", label: "KMI-30 (synthetic)", color: "var(--c3)" }]} height={160} /></div>
            <p className="px-5 pb-4 text-[11px] text-subtle">Index levels shown are synthetic demo values, not actual KMI-30 data. Constituents and methodology are published by the index provider.</p>
          </Card>
          <Card>
            <CardHeader title="Status-change alerts" />
            <div className="px-5 pb-5 text-xs text-muted">
              <Badge>Requires official data feed</Badge>
              <p className="mt-2">Automatic alerts on newly published compliance changes need an authorised feed of the official lists. Until then, record changes manually — the history below keeps every classification you enter.</p>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<BookOpen className="h-4 w-4" />} title="How Shariah screening typically works" subtitle="General education — exact thresholds depend on the published methodology" />
          <ul className="space-y-3 px-5 pb-5">
            {CRITERIA.map((c) => <li key={c.t} className="rounded-xl border border-border p-3"><p className="text-sm font-medium">{c.t}</p><p className="mt-1 text-xs leading-relaxed text-muted">{c.d}</p></li>)}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader icon={<HelpCircle className="h-4 w-4" />} title="Purification calculator" subtitle="Uses a purification ratio you take from an official source" />
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              <Field label="Symbol" htmlFor="pu-s"><Select id="pu-s" value={purify.symbol} onChange={(e) => setPurify({ ...purify, symbol: e.target.value })}><option value="">Select…</option>{snap.holdings.map((h) => <option key={h.symbol}>{h.symbol}</option>)}</Select></Field>
              <Field label="Purification ratio" htmlFor="pu-r" hint="Non-compliant income %, as officially published"><NumberInput id="pu-r" value={purify.ratio} min={0} step={0.01} onChange={(v) => setPurify({ ...purify, ratio: v })} suffix="%" /></Field>
              <Field label="Dividend received" htmlFor="pu-d"><NumberInput id="pu-d" value={purify.dividend} min={0} onChange={(v) => setPurify({ ...purify, dividend: v })} prefix="Rs" /></Field>
              <div className="col-span-2 rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">Amount to purify (dividend × ratio)</p><p className="num text-lg font-semibold">{pkr((purify.dividend * purify.ratio) / 100, 2)}</p></div>
              <p className="col-span-2 text-[11px] text-subtle">Treatment of capital gains and the applicable ratio vary by scholarly opinion and methodology. Follow the guidance of your chosen Shariah authority.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Classification history" subtitle="Every status you have recorded" />
            {records.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No classifications recorded yet.</p> : (
              <ul className="divide-y divide-border">
                {[...records].sort((a, b) => (a.publishedOn < b.publishedOn ? 1 : -1)).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                    <span className="w-14 font-semibold">{r.symbol}</span>
                    <Badge tone={r.status === "Compliant" ? "gain" : "loss"}>{r.status}</Badge>
                    <span className="min-w-0 flex-1 truncate text-muted">{r.sourceName} · {fmtDate(r.publishedOn)}</span>
                    <ConfirmButton size="icon" aria-label="Delete record" title="Delete this record?" onConfirm={() => del(r.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <RecordModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function RecordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useApp((s) => s.addShariahRecord);
  const [f, setF] = useState({ symbol: "", status: "Compliant" as ShariahRecord["status"], sourceName: "", sourceUrl: "", publishedOn: "" });
  const save = () => {
    if (!f.symbol) return toast.error("Choose a symbol");
    if (f.sourceName.trim().length < 3) return toast.error("Name the official source", "e.g. the index provider's published constituent list.");
    if (!f.publishedOn || f.publishedOn > todayISO()) return toast.error("Enter the publication date of the official list");
    if (f.sourceUrl && !/^https:\/\/[^\s]+$/i.test(f.sourceUrl)) return toast.error("Source URL must start with https://");
    add({ ...f, sourceName: f.sourceName.trim() });
    toast.success(`${f.symbol} classification recorded`);
    setF({ symbol: "", status: "Compliant", sourceName: "", sourceUrl: "", publishedOn: "" });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Record official classification" description="Only record what an official published source states." size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save record</Button></>}>
      <div className="space-y-4">
        <Field label="Symbol" htmlFor="sh-s"><Select id="sh-s" value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })}><option value="">Select…</option>{SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>)}</Select></Field>
        <Field label="Published status" htmlFor="sh-st"><Select id="sh-st" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ShariahRecord["status"] })}><option>Compliant</option><option>Non-compliant</option></Select></Field>
        <Field label="Official source" htmlFor="sh-src"><Input id="sh-src" value={f.sourceName} onChange={(e) => setF({ ...f, sourceName: e.target.value })} maxLength={100} placeholder="Name of published list / authority" /></Field>
        <Field label="Source link (optional)" htmlFor="sh-url"><Input id="sh-url" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Publication date of the list" htmlFor="sh-d"><Input id="sh-d" type="date" max={todayISO()} value={f.publishedOn} onChange={(e) => setF({ ...f, publishedOn: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
