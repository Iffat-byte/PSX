"use client";

import { useRef, useState } from "react";
import { Bell, Database, Download, Palette, Percent, Shield, Upload, UserRound, ListChecks, Plus, X, Volume2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmButton, Field, Input, Notice, NumberInput, PageHeader, Segmented, Switch } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { beep } from "@/components/shell/alert-engine";
import { useApp } from "@/store/app-store";
import { estimateFees, isFeeProfileConfigured, type FeeProfile } from "@/lib/finance/fees";
import { market } from "@/lib/market/demo-provider";
import { downloadFile } from "@/lib/utils";
import { fmtDate, pkr, todayISO } from "@/lib/format";

export default function SettingsPage() {
  const s = useApp((x) => x.settings);
  const update = useApp((x) => x.updateSettings);
  const hasDemo = useApp((x) => x.hasDemoData);
  const { loadDemoData, clearDemoData, resetAll, importBackup } = useApp.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newItem, setNewItem] = useState("");
  const fp = s.feeProfile;
  const setFp = (p: Partial<FeeProfile>) => update({ feeProfile: { ...fp, ...p } });

  const exportBackup = () => {
    const st = useApp.getState();
    const data = Object.fromEntries(Object.entries(st).filter(([, v]) => typeof v !== "function"));
    downloadFile(`psx-pilot-backup-${todayISO()}.json`, JSON.stringify({ app: "psx-pilot", version: 1, exportedAt: new Date().toISOString(), data }, null, 2), "application/json");
    toast.success("Backup downloaded", "Contains all your records. Store it somewhere safe.");
  };
  const importFile = async (f: File) => {
    try {
      if (f.size > 20_000_000) throw new Error("File too large");
      const json = JSON.parse(await f.text());
      if (json?.app !== "psx-pilot" || typeof json.data !== "object") throw new Error("Not a PSX Pilot backup file");
      if (!Array.isArray(json.data.portfolios) || !Array.isArray(json.data.transactions)) throw new Error("Backup is missing portfolios or transactions");
      importBackup(json.data);
      toast.success("Backup restored");
    } catch (e) {
      toast.error("Could not restore backup", (e as Error).message);
    }
  };

  const requestBrowser = async (v: boolean) => {
    if (!v) return update({ notifyBrowser: false });
    if (typeof Notification === "undefined") return toast.error("Browser notifications are not supported here");
    const p = await Notification.requestPermission();
    if (p === "granted") { update({ notifyBrowser: true }); toast.success("Browser notifications enabled", "Delivered while PSX Pilot is open in a tab."); }
    else toast.warning("Permission not granted", "Enable notifications for this site in your browser settings.");
  };

  return (
    <>
      <PageHeader title="Settings" description="Preferences, fee assumptions, risk limits, notifications and your data." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<UserRound className="h-4 w-4" />} title="Profile & appearance" />
          <div className="space-y-5 px-5 pb-5">
            <Field label="Display name" htmlFor="st-name"><Input id="st-name" value={s.userName} maxLength={30} onChange={(e) => update({ userName: e.target.value || "Investor" })} /></Field>
            <div><p className="label">Theme</p><Segmented value={s.theme} onChange={(v) => update({ theme: v })} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} /></div>
            <div>
              <p className="label">Number format</p>
              <Segmented value={s.numberSystem} onChange={(v) => update({ numberSystem: v })} options={[{ value: "international", label: "1,234,567 · 1.23M" }, { value: "south-asian", label: "12,34,567 · 12.35 Lac" }]} />
            </div>
          </div>
        </Card>

        <Card id="fees">
          <CardHeader icon={<Percent className="h-4 w-4" />} title="Broker fee profile" subtitle="Used to estimate fees on new transactions and in calculators" action={isFeeProfileConfigured(fp) ? <Badge tone="gain">Configured</Badge> : <Badge tone="amber">Not set</Badge>} />
          <div className="space-y-4 px-5 pb-5">
            <Notice tone="info">Rates differ by broker and change over time. PSX Pilot does not assume any rate — copy the figures from your broker&apos;s current tariff or contract notes.</Notice>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Commission (% of value)" htmlFor="f1"><NumberInput id="f1" value={fp.commissionPct} min={0} step={0.01} onChange={(v) => setFp({ commissionPct: v })} suffix="%" /></Field>
              <Field label="Min. commission per share" htmlFor="f2"><NumberInput id="f2" value={fp.minPerShare} min={0} step={0.01} onChange={(v) => setFp({ minPerShare: v })} prefix="Rs" /></Field>
              <Field label="Sales tax on commission" htmlFor="f3"><NumberInput id="f3" value={fp.taxOnCommissionPct} min={0} step={0.5} onChange={(v) => setFp({ taxOnCommissionPct: v })} suffix="%" /></Field>
              <Field label="Other charges (% of value)" htmlFor="f4" hint="CDC, exchange, regulatory"><NumberInput id="f4" value={fp.otherPct} min={0} step={0.001} onChange={(v) => setFp({ otherPct: v })} suffix="%" /></Field>
              <Field label="Flat charge per trade" htmlFor="f5"><NumberInput id="f5" value={fp.flatPerTrade} min={0} onChange={(v) => setFp({ flatPerTrade: v })} prefix="Rs" /></Field>
              <Field label="Dividend tax (calculator default)" htmlFor="f6"><NumberInput id="f6" value={s.dividendTaxPct} min={0} step={0.5} onChange={(v) => update({ dividendTaxPct: v })} suffix="%" /></Field>
            </div>
            <p className="text-xs text-muted">Example: 1,000 shares @ Rs 100 → estimated fees <span className="num font-semibold text-fg">{pkr(estimateFees(fp, 1000, 100), 2)}</span></p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Shield className="h-4 w-4" />} title="Risk limits" subtitle="Your personal thresholds for concentration warnings" />
          <div className="grid grid-cols-2 gap-3 px-5 pb-5">
            <Field label="Max single position" htmlFor="r1"><NumberInput id="r1" value={s.maxPositionPct} min={1} onChange={(v) => update({ maxPositionPct: Math.min(100, Math.max(1, v)) })} suffix="%" /></Field>
            <Field label="Max single sector" htmlFor="r2"><NumberInput id="r2" value={s.maxSectorPct} min={1} onChange={(v) => update({ maxSectorPct: Math.min(100, Math.max(1, v)) })} suffix="%" /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<ListChecks className="h-4 w-4" />} title="Daily checklist template" subtitle="Copied into each new day in the Daily Workspace" />
          <div className="px-5 pb-5">
            <ul className="space-y-1.5">
              {s.checklistTemplate.map((c, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="flex-1">{c}</span>
                  <button aria-label="Remove item" onClick={() => update({ checklistTemplate: s.checklistTemplate.filter((_, j) => j !== i) })} className="text-subtle hover:text-loss"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { update({ checklistTemplate: [...s.checklistTemplate, newItem.trim()] }); setNewItem(""); } }}>
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add checklist item" maxLength={120} aria-label="New checklist item" />
              <Button type="submit" variant="secondary"><Plus className="h-4 w-4" /></Button>
            </form>
          </div>
        </Card>

        <Card id="notifications">
          <CardHeader icon={<Bell className="h-4 w-4" />} title="Notifications" />
          <div className="space-y-4 px-5 pb-5">
            <Switch checked={s.notifyInApp} onChange={(v) => update({ notifyInApp: v })} label="In-app notifications" description="Shown in the notification center when alerts trigger." />
            <Switch checked={s.notifyBrowser} onChange={requestBrowser} label="Browser notifications" description="Uses your browser's notification permission. Works while PSX Pilot is open." />
            <div className="flex items-start justify-between gap-4">
              <Switch checked={s.soundAlerts} onChange={(v) => update({ soundAlerts: v })} label="Audible alerts" description="A short tone when an alert triggers (opt-in)." />
            </div>
            <Button size="sm" variant="ghost" onClick={beep}><Volume2 className="h-4 w-4" />Test sound</Button>
            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">Email notifications</p><Badge>Requires backend</Badge></div>
              <p className="mt-1 text-xs text-muted">Available once cloud accounts and an email provider are configured.</p>
            </div>
            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">WhatsApp</p><Badge>Planned</Badge></div>
              <p className="mt-1 text-xs text-muted">Future integration via an approved WhatsApp Business provider.</p>
            </div>
            <Field label="Weekly review reminder day" htmlFor="rv-day">
              <select id="rv-day" className="field" value={s.reviewReminderDay} onChange={(e) => update({ reviewReminderDay: Number(e.target.value) })}>
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        <Card id="data">
          <CardHeader icon={<Database className="h-4 w-4" />} title="Data source & your data" />
          <div className="space-y-4 px-5 pb-5">
            <div className="rounded-xl border border-amber/30 bg-amber/[.06] p-3">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">Market data: {market.label}</p><Badge tone="amber">Not live</Badge></div>
              <p className="mt-1 text-xs text-muted">{market.disclaimer} Latest synthetic date: {fmtDate(market.asOf())}. Connecting a licensed PSX data provider requires an agreement with an authorised vendor.</p>
            </div>
            <div className="rounded-xl border border-border p-3 text-xs text-muted">
              <p className="text-sm font-semibold text-fg">Storage: this browser only</p>
              Your records are stored locally in this browser (local mode). They are not uploaded anywhere. Export a backup regularly; clearing browser data deletes them.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportBackup}><Download className="h-4 w-4" />Export backup (JSON)</Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Restore backup</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {hasDemo ? (
                <ConfirmButton variant="secondary" size="sm" confirmLabel="Remove demo data" title="Remove demo data?" body="Deletes the demo portfolios, transactions, journal entries, alerts and sample events. Records you created yourself are kept." onConfirm={() => { clearDemoData(); toast.success("Demo data removed", "You're ready to add your own records."); }}>Remove demo data</ConfirmButton>
              ) : (
                <ConfirmButton variant="secondary" size="sm" confirmLabel="Load demo" title="Load demo data?" body="This replaces your current records with the demo dataset. Export a backup first if you want to keep them." onConfirm={() => { loadDemoData(); toast.success("Demo data loaded"); }}>Load demo data</ConfirmButton>
              )}
              <ConfirmButton variant="danger" size="sm" confirmLabel="Erase everything" title="Erase all data in this browser?" body="Permanently deletes every portfolio, transaction, journal entry, watchlist and setting stored in this browser." onConfirm={() => { resetAll(); toast.success("All local data erased"); }}><Palette className="hidden" />Erase all local data</ConfirmButton>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
