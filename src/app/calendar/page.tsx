"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronLeft, ChevronRight, Coins, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, EmptyState, Field, Input, Modal, NumberInput, PageHeader, Segmented, Select, Switch, Textarea, Notice } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import type { CalendarEvent, CorpEventType, DividendRecord } from "@/store/types";
import { useSnapshot } from "@/lib/hooks";
import { dividendIncome } from "@/lib/finance/calculators";
import { SYMBOLS } from "@/lib/market/symbols";
import { SYMBOL_RE } from "@/components/transaction-form";
import { fmtDate, fmtInt, fmtNum, pkr, todayISO, toISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES: CorpEventType[] = ["Results", "Board Meeting", "Dividend", "Book Closure", "Bonus", "Rights", "AGM", "Other"];
const TYPE_COLOR: Record<CorpEventType, string> = { Results: "var(--c1)", "Board Meeting": "var(--c7)", Dividend: "var(--c3)", "Book Closure": "var(--c4)", Bonus: "var(--c5)", Rights: "var(--c2)", AGM: "var(--c6)", Other: "var(--c8)" };

export default function CalendarPage() {
  const events = useApp((s) => s.events);
  const snap = useSnapshot();
  const lists = useApp((s) => s.watchlists);
  const [view, setView] = useState<"month" | "list" | "dividends">("month");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [scope, setScope] = useState<"all" | "holdings" | "watch">("all");
  const [types, setTypes] = useState<Set<CorpEventType>>(new Set(TYPES));
  const [edit, setEdit] = useState<Partial<CalendarEvent> | null>(null);
  const held = new Set(snap.holdings.map((h) => h.symbol));
  const watched = new Set(lists.flatMap((l) => l.items.map((i) => i.symbol)));
  const filtered = events.filter((e) => types.has(e.type) && (scope === "all" || (e.symbol && (scope === "holdings" ? held.has(e.symbol) : watched.has(e.symbol) || held.has(e.symbol)))));

  const days = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);
  const today = todayISO();

  return (
    <>
      <PageHeader title="Dividend & Corporate Action Calendar" description="Results, board meetings, dividends, book closures, bonus and rights issues — filtered to what matters to you."
        actions={<Button variant="primary" size="sm" onClick={() => setEdit({ date: today, type: "Results", remind: true, origin: "user" })}><Plus className="h-4 w-4" />Add event</Button>} />
      {events.some((e) => e.origin === "demo") && <Notice tone="amber" className="mb-4" title="Sample events shown">Events marked “sample” are illustrative and are not actual PSX announcements. Add real events from official company or PSX notices.</Notice>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={setView} options={[{ value: "month", label: "Month" }, { value: "list", label: "List" }, { value: "dividends", label: "Dividend tracker" }]} />
        {view !== "dividends" && <Segmented size="sm" value={scope} onChange={setScope} options={[{ value: "all", label: "All" }, { value: "holdings", label: "My holdings" }, { value: "watch", label: "Holdings + watchlists" }]} />}
      </div>
      {view !== "dividends" && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {TYPES.map((t) => <button key={t} onClick={() => setTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })} aria-pressed={types.has(t)} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium", types.has(t) ? "border-border bg-surface-2 text-fg" : "border-transparent text-subtle line-through")}><span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />{t}</button>)}
        </div>
      )}

      {view === "month" && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3">
            <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm font-semibold">{cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
            <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 border-t border-border text-center text-[10px] font-semibold uppercase tracking-wider text-subtle">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const iso = toISO(d);
              const ev = filtered.filter((e) => e.date === iso);
              const out = d.getMonth() !== cursor.getMonth();
              return (
                <button key={iso} onClick={() => setEdit({ date: iso, type: "Results", remind: true, origin: "user" })} className={cn("min-h-[64px] border-t border-r border-border/70 p-1.5 text-left align-top transition hover:bg-surface-2 sm:min-h-[96px]", out && "bg-surface-2/30 text-subtle")} aria-label={`${fmtDate(iso)}, ${ev.length} events`}>
                  <span className={cn("num inline-grid h-6 w-6 place-items-center rounded-full text-xs", iso === today && "bg-accent font-bold text-accent-fg")}>{d.getDate()}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {ev.slice(0, 3).map((e) => (
                      <span key={e.id} role="button" tabIndex={0} onClick={(x) => { x.stopPropagation(); setEdit(e); }} onKeyDown={(x) => x.key === "Enter" && (x.stopPropagation(), setEdit(e))} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium hover:bg-surface-3" style={{ background: `color-mix(in srgb, ${TYPE_COLOR[e.type]} 16%, transparent)` }}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TYPE_COLOR[e.type] }} /><span className="truncate">{e.symbol} <span className="hidden md:inline">{e.type}</span></span>
                      </span>
                    ))}
                    {ev.length > 3 && <span className="px-1 text-[10px] text-subtle">+{ev.length - 3} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {view === "list" && (
        <Card>
          {filtered.length === 0 ? <EmptyState title="No events match" /> : (
            <ul className="divide-y divide-border">
              {[...filtered].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => (
                <li key={e.id} className={cn("flex items-center gap-4 px-5 py-3", e.date < today && "opacity-60")}>
                  <span className="num w-24 shrink-0 text-xs text-muted">{fmtDate(e.date)}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_COLOR[e.type] }} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{e.symbol} · {e.type} {e.symbol && held.has(e.symbol) && <Badge tone="accent">held</Badge>} {e.origin === "demo" && <Badge tone="amber">sample</Badge>}</p><p className="truncate text-xs text-muted">{e.title}</p></div>
                  {e.remind && <BellRing className="h-4 w-4 text-accent" aria-label="Reminder on" />}
                  <Button size="icon" variant="ghost" aria-label="Edit event" onClick={() => setEdit(e)}><Pencil className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {view === "dividends" && <DividendTracker />}
      <EventModal value={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function EventModal({ value, onClose }: { value: Partial<CalendarEvent> | null; onClose: () => void }) {
  const upsert = useApp((s) => s.upsertEvent);
  const del = useApp((s) => s.deleteEvent);
  const [e, setE] = useState<Partial<CalendarEvent>>({});
  const [err, setErr] = useState("");
  useEffect(() => { if (value) { setE(value); setErr(""); } }, [value]);
  if (!value) return null;
  const save = () => {
    if (!e.date) return setErr("Date required");
    if (e.symbol && !SYMBOL_RE.test(e.symbol)) return setErr("Invalid symbol");
    upsert({ id: e.id, date: e.date, symbol: e.symbol || undefined, type: e.type ?? "Other", title: e.title?.trim() || `${e.type}`, note: e.note, remind: !!e.remind, origin: e.origin ?? "user" });
    toast.success(e.id ? "Event updated" : "Event added");
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={e.id ? "Edit event" : "Add event"} size="sm" footer={<>{e.id && <ConfirmButton variant="ghost" size="md" title="Delete event?" onConfirm={() => { del(e.id!); onClose(); }} className="mr-auto"><Trash2 className="h-4 w-4" />Delete</ConfirmButton>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        {e.origin === "demo" && <Notice tone="amber">Sample event — not an actual announcement.</Notice>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="ev-d"><Input id="ev-d" type="date" value={e.date ?? ""} onChange={(x) => setE({ ...e, date: x.target.value })} /></Field>
          <Field label="Symbol" htmlFor="ev-s"><Input id="ev-s" list="ev-syms" value={e.symbol ?? ""} onChange={(x) => setE({ ...e, symbol: x.target.value.toUpperCase() })} /><datalist id="ev-syms">{SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol} />)}</datalist></Field>
        </div>
        <Field label="Type" htmlFor="ev-t"><Select id="ev-t" value={e.type} onChange={(x) => setE({ ...e, type: x.target.value as CorpEventType })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Title" htmlFor="ev-ti"><Input id="ev-ti" value={e.title ?? ""} onChange={(x) => setE({ ...e, title: x.target.value })} maxLength={100} placeholder="e.g. Q3 results announcement" /></Field>
        <Field label="Notes / source" htmlFor="ev-n"><Textarea id="ev-n" rows={2} value={e.note ?? ""} onChange={(x) => setE({ ...e, note: x.target.value })} maxLength={400} /></Field>
        <Switch checked={!!e.remind} onChange={(v) => setE({ ...e, remind: v })} label="Remind me" description="In-app notification up to 2 days before." />
        {err && <p className="text-xs text-loss">{err}</p>}
      </div>
    </Modal>
  );
}

function DividendTracker() {
  const dividends = useApp((s) => s.dividends);
  const pfId = useApp((s) => s.activePortfolioId);
  const portfolios = useApp((s) => s.portfolios);
  const taxDefault = useApp((s) => s.settings.dividendTaxPct);
  const { upsertDividend, deleteDividend, addTransactions } = useApp.getState();
  const snap = useSnapshot();
  const [edit, setEdit] = useState<Partial<DividendRecord> | null>(null);
  const rows = dividends.filter((d) => d.portfolioId === pfId);
  const sum = (st: DividendRecord["status"]) => rows.filter((d) => d.status === st).reduce((a, d) => a + dividendIncome(d.quantity, d.dps, d.taxPct).net, 0);

  const markReceived = (d: DividendRecord) => {
    const net = dividendIncome(d.quantity, d.dps, d.taxPct).net;
    const [txId] = addTransactions([{ portfolioId: d.portfolioId, date: d.paymentDate && d.paymentDate <= todayISO() ? d.paymentDate : todayISO(), type: "DIVIDEND", symbol: d.symbol, quantity: 0, price: 0, fees: 0, amount: Math.round(net * 100) / 100, note: `Dividend Rs ${d.dps}/share × ${d.quantity}`, source: "manual" }]);
    upsertDividend({ ...d, status: "received", ledgerTxId: txId });
    toast.success("Marked as received", `${pkr(net, 2)} recorded in your ledger as a dividend.`);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {([["expected", "Expected (your estimate)", "amber"], ["declared", "Declared (announced)", "info"], ["received", "Received (in ledger)", "gain"]] as const).map(([k, l, t]) => (
          <Card key={k} className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted">{l}</p><Badge tone={t}>{rows.filter((d) => d.status === k).length}</Badge></div><p className="num mt-1 text-xl font-semibold">{pkr(sum(k))}</p><p className="text-[11px] text-subtle">net of tax</p></Card>
        ))}
      </div>
      <Card>
        <CardHeader icon={<Coins className="h-4 w-4" />} title={`Dividend records — ${portfolios.find((p) => p.id === pfId)?.name}`} subtitle="Expected amounts are your own estimates and are kept separate from declared and received amounts" action={<Button size="sm" variant="primary" onClick={() => setEdit({ status: "declared", taxPct: taxDefault, portfolioId: pfId, quantity: 0, dps: 0 })}><Plus className="h-4 w-4" />Add</Button>} />
        {rows.length === 0 ? <EmptyState title="No dividend records" body="Track expected, declared and received dividends for your holdings." /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Symbol</th><th>Status</th><th className="text-right">DPS</th><th className="text-right">Shares</th><th className="text-right">Gross</th><th className="text-right">Tax</th><th className="text-right">Net</th><th>Book closure</th><th>Payment</th><th className="text-right">Actions</th></tr></thead>
              <tbody className="num">
                {rows.map((d) => { const r = dividendIncome(d.quantity, d.dps, d.taxPct); return (
                  <tr key={d.id}>
                    <td className="font-medium">{d.symbol}</td>
                    <td><Badge tone={d.status === "expected" ? "amber" : d.status === "declared" ? "info" : "gain"}>{d.status}</Badge></td>
                    <td className="text-right">{fmtNum(d.dps)}</td><td className="text-right">{fmtInt(d.quantity)}</td>
                    <td className="text-right">{pkr(r.gross)}</td><td className="text-right">{pkr(r.tax)}</td><td className="text-right font-medium">{pkr(r.net)}</td>
                    <td>{fmtDate(d.bookClosure)}</td><td>{fmtDate(d.paymentDate)}</td>
                    <td className="text-right"><div className="flex justify-end gap-1">
                      {d.status !== "received" && <Button size="sm" variant="outline" onClick={() => markReceived(d)}>Mark received</Button>}
                      <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit(d)}><Pencil className="h-4 w-4" /></Button>
                      <ConfirmButton size="icon" aria-label="Delete" title="Delete dividend record?" body={d.ledgerTxId ? "The ledger transaction created when it was received will be kept; delete it separately in Portfolios if needed." : undefined} onConfirm={() => deleteDividend(d.id)}><Trash2 className="h-4 w-4" /></ConfirmButton>
                    </div></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit dividend" : "Add dividend record"} size="sm" footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={() => {
        if (!edit) return;
        if (!edit.symbol || !SYMBOL_RE.test(edit.symbol)) return toast.error("Valid symbol required");
        if (!(edit.dps! > 0) || !(edit.quantity! > 0)) return toast.error("DPS and shares must be above zero");
        upsertDividend({ ...(edit as DividendRecord), portfolioId: edit.portfolioId ?? pfId });
        toast.success("Dividend record saved");
        setEdit(null);
      }}>Save</Button></>}>
        {edit && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Symbol" className="col-span-2" htmlFor="dv-s">
              <Select id="dv-s" value={edit.symbol ?? ""} onChange={(x) => { const h = snap.holdings.find((y) => y.symbol === x.target.value); setEdit({ ...edit, symbol: x.target.value, quantity: edit.quantity || h?.quantity || 0 }); }}>
                <option value="">Select…</option>
                {snap.holdings.map((h) => <option key={h.symbol} value={h.symbol}>{h.symbol} ({fmtInt(h.quantity)} held)</option>)}
                {SYMBOLS.filter((s) => !snap.holdings.some((h) => h.symbol === s.symbol)).map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
              </Select>
            </Field>
            <Field label="Status" className="col-span-2" htmlFor="dv-st" hint={edit.status === "expected" ? "Your own estimate — not an announcement." : edit.status === "declared" ? "Officially announced by the company." : undefined}><Select id="dv-st" value={edit.status} onChange={(x) => setEdit({ ...edit, status: x.target.value as DividendRecord["status"] })} disabled={edit.status === "received" && !!edit.ledgerTxId}><option value="expected">Expected</option><option value="declared">Declared</option>{edit.status === "received" && <option value="received">Received</option>}</Select></Field>
            <Field label="Dividend per share" htmlFor="dv-d"><NumberInput id="dv-d" value={edit.dps ?? 0} min={0} step={0.25} onChange={(v) => setEdit({ ...edit, dps: v })} prefix="Rs" /></Field>
            <Field label="Shares entitled" htmlFor="dv-q"><NumberInput id="dv-q" value={edit.quantity ?? 0} min={0} step={1} onChange={(v) => setEdit({ ...edit, quantity: v })} /></Field>
            <Field label="Tax rate" htmlFor="dv-t"><NumberInput id="dv-t" value={edit.taxPct ?? 0} min={0} step={0.5} onChange={(v) => setEdit({ ...edit, taxPct: v })} suffix="%" /></Field>
            <Field label="Book closure" htmlFor="dv-b"><Input id="dv-b" type="date" value={edit.bookClosure ?? ""} onChange={(x) => setEdit({ ...edit, bookClosure: x.target.value || undefined })} /></Field>
            <Field label="Payment date" htmlFor="dv-p"><Input id="dv-p" type="date" value={edit.paymentDate ?? ""} onChange={(x) => setEdit({ ...edit, paymentDate: x.target.value || undefined })} /></Field>
            <Field label="Note" className="col-span-2" htmlFor="dv-n"><Input id="dv-n" value={edit.note ?? ""} onChange={(x) => setEdit({ ...edit, note: x.target.value })} maxLength={120} /></Field>
            <p className="col-span-2 num text-xs text-muted">Net: {pkr(dividendIncome(edit.quantity ?? 0, edit.dps ?? 0, edit.taxPct ?? 0).net, 2)}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
