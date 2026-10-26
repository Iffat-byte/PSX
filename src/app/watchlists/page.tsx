"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, BellOff, Moon, Pencil, Plus, RotateCcw, Star, Trash2, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, Delta, EmptyState, Field, Input, Modal, PageHeader, Select, SourceNote } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { AlertForm } from "@/components/alert-form";
import { Sparkline } from "@/components/charts";
import { useApp } from "@/store/app-store";
import { useQuotes, useSnapshot } from "@/lib/hooks";
import { market } from "@/lib/market/demo-provider";
import { SYMBOL_MAP, SYMBOLS } from "@/lib/market/symbols";
import { checkAlert, describeAlert, observedLabel } from "@/lib/alerts";
import { SYMBOL_RE } from "@/components/transaction-form";
import { fmtDate, fmtDateTime, fmtInt, fmtNum, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function WatchlistsPage() {
  const lists = useApp((s) => s.watchlists);
  const alerts = useApp((s) => s.alerts);
  const { addWatchlist, renameWatchlist, deleteWatchlist, addToWatchlist, removeFromWatchlist, setWatchNote, updateAlert, deleteAlert } = useApp.getState();
  const quotes = useQuotes();
  const snap = useSnapshot();
  const params = useSearchParams();
  const router = useRouter();
  const [activeId, setActiveId] = useState(lists[0]?.id ?? "");
  const [sym, setSym] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertSym, setAlertSym] = useState<string | undefined>();
  const [listModal, setListModal] = useState<"new" | "rename" | null>(null);
  const [listName, setListName] = useState("");
  const [listKind, setListKind] = useState<"general" | "shariah">("general");
  const [noteEdit, setNoteEdit] = useState<{ symbol: string; note: string } | null>(null);
  const active = lists.find((l) => l.id === activeId) ?? lists[0];

  useEffect(() => {
    if (params.get("new") === "alert") { setAlertSym(undefined); setAlertOpen(true); router.replace("/watchlists"); }
  }, [params, router]);

  const addSym = () => {
    const s = sym.trim().toUpperCase();
    if (!active) return;
    if (!SYMBOL_RE.test(s)) return toast.error("Invalid symbol");
    if (active.items.some((i) => i.symbol === s)) return toast.info(`${s} is already on this list`);
    addToWatchlist(active.id, s);
    setSym("");
    toast.success(`${s} added to ${active.name}`, SYMBOL_MAP[s] ? undefined : "No demo price available for this symbol.");
  };

  const activeAlerts = alerts.filter((a) => a.active);
  const triggered = alerts.filter((a) => !a.active && a.triggeredAt);
  const near = useMemo(() => activeAlerts.map((a) => {
    const q = quotes[a.symbol];
    const dist = q && (a.kind === "above" || a.kind === "below") ? (a.value - q.price) / q.price : null;
    return { a, dist };
  }), [activeAlerts, quotes]);

  return (
    <>
      <PageHeader
        title="Watchlists & Alerts"
        description="Track symbols, keep notes and set conditions. Alerts are evaluated in your browser against the configured data source."
        actions={<><Button variant="outline" size="sm" onClick={() => { setListName(""); setListKind("general"); setListModal("new"); }}><Plus className="h-4 w-4" />Watchlist</Button><Button variant="primary" size="sm" onClick={() => { setAlertSym(undefined); setAlertOpen(true); }}><Bell className="h-4 w-4" />New alert</Button></>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {lists.map((l) => (
              <button key={l.id} onClick={() => setActiveId(l.id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium", l.id === active?.id ? "border-accent/50 bg-accent/10" : "border-border bg-surface text-muted hover:text-fg")}>
                {l.kind === "shariah" ? <Moon className="h-3.5 w-3.5 text-accent" /> : <Star className="h-3.5 w-3.5" />}{l.name}<Badge>{l.items.length}</Badge>
              </button>
            ))}
          </div>
          {!active ? (
            <Card><EmptyState icon={<Star className="h-5 w-5" />} title="No watchlists" action={<Button variant="primary" onClick={() => setListModal("new")}>Create watchlist</Button>} /></Card>
          ) : (
            <Card>
              <CardHeader
                title={active.name}
                subtitle={active.kind === "shariah" ? "Shariah research list — verify status in the Shariah Center" : `${active.items.length} symbols`}
                action={<><Button size="icon" variant="ghost" aria-label="Rename watchlist" onClick={() => { setListName(active.name); setListModal("rename"); }}><Pencil className="h-4 w-4" /></Button><ConfirmButton size="icon" aria-label="Delete watchlist" title={`Delete “${active.name}”?`} onConfirm={() => { deleteWatchlist(active.id); setActiveId(lists.find((l) => l.id !== active.id)?.id ?? ""); }}><Trash2 className="h-4 w-4" /></ConfirmButton></>}
              />
              <form className="flex gap-2 px-5 pb-3" onSubmit={(e) => { e.preventDefault(); addSym(); }}>
                <Input list="wl-syms" value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} placeholder="Add symbol, e.g. MARI" aria-label="Symbol to add" />
                <datalist id="wl-syms">{SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.name}</option>)}</datalist>
                <Button type="submit" variant="secondary"><Plus className="h-4 w-4" />Add</Button>
              </form>
              {active.items.length === 0 ? <EmptyState title="This watchlist is empty" body="Add PSX symbols above." /> : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead><tr><th>Symbol</th><th className="text-right">Last</th><th className="text-right">Change</th><th className="hidden md:table-cell">30d</th><th className="text-right">Volume</th><th>Note</th><th className="text-right">Actions</th></tr></thead>
                    <tbody className="num">
                      {active.items.map((i) => {
                        const q = quotes[i.symbol];
                        const chg = q ? (q.price - q.prevClose) / q.prevClose : null;
                        const held = snap.holdings.find((h) => h.symbol === i.symbol);
                        return (
                          <tr key={i.symbol}>
                            <td><Link href={`/research?s=${i.symbol}`} className="font-semibold hover:text-accent">{i.symbol}</Link>{held && <Badge tone="accent" className="ml-1.5">held</Badge>}<span className="block max-w-[160px] truncate text-[11px] text-subtle">{SYMBOL_MAP[i.symbol]?.name ?? "No reference data"}</span></td>
                            <td className="text-right">{q ? fmtNum(q.price) : "—"}</td>
                            <td className="text-right"><Delta value={chg}>{pct(chg, 2, true)}</Delta></td>
                            <td className="hidden md:table-cell">{q && <Sparkline values={market.history(i.symbol).slice(-30).map((p) => p.close)} />}</td>
                            <td className="text-right">{q ? fmtInt(q.volume) : "—"}</td>
                            <td className="max-w-[200px]"><button onClick={() => setNoteEdit({ symbol: i.symbol, note: i.note ?? "" })} className="block w-full truncate text-left text-xs text-muted hover:text-fg">{i.note || <span className="text-subtle">+ add note</span>}</button></td>
                            <td className="text-right"><div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" aria-label={`Create alert for ${i.symbol}`} onClick={() => { setAlertSym(i.symbol); setAlertOpen(true); }}><Bell className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" aria-label={`Remove ${i.symbol}`} onClick={() => { removeFromWatchlist(active.id, i.symbol); toast.success(`${i.symbol} removed`, undefined, { label: "Undo", run: () => { addToWatchlist(active.id, i.symbol); if (i.note) setWatchNote(active.id, i.symbol, i.note); } }); }}><X className="h-4 w-4" /></Button>
                            </div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-5 py-3"><SourceNote source={market.label} asOf={fmtDate(market.asOf())} /></div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader icon={<Bell className="h-4 w-4" />} title={`Active alerts (${activeAlerts.length})`} subtitle="Distance shown for price alerts" />
            {near.length === 0 ? <EmptyState title="No active alerts" /> : (
              <ul className="space-y-1 px-3 pb-3">
                {near.map(({ a, dist }) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{describeAlert(a)}</p>
                      <p className="text-[11px] text-subtle">{dist !== null ? `${pct(Math.abs(dist), 1)} away · ` : ""}{a.note ?? `Created ${fmtDate(new Date(a.createdAt).toISOString())}`}</p>
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Pause alert" onClick={() => updateAlert(a.id, { active: false })}><BellOff className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Delete alert" onClick={() => deleteAlert(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Triggered & paused" />
            {triggered.length === 0 && alerts.filter((a) => !a.active && !a.triggeredAt).length === 0 ? <p className="px-5 pb-5 text-sm text-muted">Nothing here yet.</p> : (
              <ul className="space-y-1 px-3 pb-3">
                {alerts.filter((a) => !a.active).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", a.triggeredAt ? "bg-amber" : "bg-surface-3")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{describeAlert(a)}</p>
                      <p className="text-[11px] text-subtle">{a.triggeredAt ? `Triggered ${fmtDateTime(a.triggeredAt)} · observed ${observedLabel(a, a.triggeredValue ?? 0)}` : "Paused"}</p>
                    </div>
                    <Button size="icon" variant="ghost" aria-label="Re-arm alert" title="Re-arm" onClick={() => { if (checkAlert({ ...a, active: true }, quotes, snap) !== null) toast.warning("Condition is currently met", "The alert will trigger again immediately."); updateAlert(a.id, { active: true, triggeredAt: undefined, triggeredValue: undefined }); }}><RotateCcw className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Delete alert" onClick={() => deleteAlert(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5 text-xs leading-relaxed text-muted">
            <p className="mb-1 text-sm font-semibold text-fg">How alerts work today</p>
            Alerts are evaluated in your browser whenever PSX Pilot is open, against the latest values from the active data source (currently synthetic demo data). Server-side monitoring, email and push delivery require a licensed market-data feed and a notification backend. <Link href="/settings#notifications" className="text-accent hover:underline">Notification settings →</Link>
          </Card>
        </div>
      </div>

      <AlertForm open={alertOpen} onClose={() => setAlertOpen(false)} symbol={alertSym} />
      <Modal open={listModal !== null} onClose={() => setListModal(null)} size="sm" title={listModal === "new" ? "New watchlist" : "Rename watchlist"} footer={<><Button variant="ghost" onClick={() => setListModal(null)}>Cancel</Button><Button variant="primary" onClick={() => {
        const n = listName.trim();
        if (!n) return toast.error("Name required");
        if (listModal === "new") { const id = addWatchlist(n, listKind); setActiveId(id); toast.success("Watchlist created"); }
        else if (active) renameWatchlist(active.id, n);
        setListModal(null);
      }}>Save</Button></>}>
        <div className="space-y-4">
          <Field label="Name" htmlFor="wl-n"><Input id="wl-n" value={listName} onChange={(e) => setListName(e.target.value)} maxLength={40} /></Field>
          {listModal === "new" && <Field label="Type" htmlFor="wl-k"><Select id="wl-k" value={listKind} onChange={(e) => setListKind(e.target.value as "general" | "shariah")}><option value="general">General</option><option value="shariah">Shariah research</option></Select></Field>}
        </div>
      </Modal>
      <Modal open={!!noteEdit} onClose={() => setNoteEdit(null)} size="sm" title={`Note for ${noteEdit?.symbol}`} footer={<><Button variant="ghost" onClick={() => setNoteEdit(null)}>Cancel</Button><Button variant="primary" onClick={() => { if (noteEdit && active) setWatchNote(active.id, noteEdit.symbol, noteEdit.note.trim()); setNoteEdit(null); }}>Save note</Button></>}>
        <Input value={noteEdit?.note ?? ""} onChange={(e) => setNoteEdit((n) => (n ? { ...n, note: e.target.value } : n))} maxLength={200} aria-label="Note" />
      </Modal>
    </>
  );
}
