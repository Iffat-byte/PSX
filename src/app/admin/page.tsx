"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, Plus, Shield, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Notice, NumberInput, PageHeader } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { DEFAULT_PLANS, useApp } from "@/store/app-store";
import type { PlanTier } from "@/store/types";
import { market } from "@/lib/market/demo-provider";

export default function AdminPage() {
  const tiers = useApp((s) => s.tiers);
  const save = useApp((s) => s.updateTiers);
  const [draft, setDraft] = useState<PlanTier[]>(tiers);
  const [feat, setFeat] = useState<Record<string, string>>({});
  const set = (i: number, p: Partial<PlanTier>) => setDraft((d) => d.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const status = [
    { k: "Market data feed", ok: market.isLive, d: market.isLive ? market.label : "Demo provider (synthetic). Needs a licensed PSX data vendor." },
    { k: "Authentication", ok: false, d: "Supabase Auth — schema ready, not connected." },
    { k: "Database & RLS", ok: false, d: "Migrations in supabase/migrations; apply to a Supabase project." },
    { k: "AI assistant", ok: null, d: "Server checks ANTHROPIC_API_KEY at runtime (see Research Assistant badge)." },
    { k: "Payments", ok: false, d: "No payment provider connected. Billing disabled." },
    { k: "Email notifications", ok: false, d: "No email provider configured." },
  ];
  return (
    <>
      <PageHeader title="Admin preview" description="Operator configuration. In local mode, changes affect only this browser." badge={<Badge tone="amber"><Shield className="h-3 w-3" />Local preview — no admin auth</Badge>} />
      <Notice tone="amber" className="mb-4" title="Not a secured admin panel">A production admin panel requires authenticated, role-checked server access. This preview demonstrates the configuration surface only.</Notice>
      <Card className="mb-4">
        <CardHeader title="Integration status" />
        <ul className="grid gap-2 px-5 pb-5 md:grid-cols-2">
          {status.map((s) => <li key={s.k} className="flex items-start gap-3 rounded-xl border border-border p-3">{s.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-gain" /> : <CircleDashed className="mt-0.5 h-4 w-4 text-amber" />}<div><p className="text-sm font-medium">{s.k}</p><p className="text-xs text-muted">{s.d}</p></div></li>)}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Subscription tiers & pricing" subtitle="Displayed on Account & Plans. Prices in PKR; 0 shows as “TBD” for paid tiers." action={<><Button size="sm" variant="ghost" onClick={() => setDraft(DEFAULT_PLANS)}>Reset</Button><Button size="sm" variant="primary" onClick={() => { save(draft); toast.success("Tier configuration saved"); }}>Save</Button></>} />
        <div className="grid gap-4 px-5 pb-5 md:grid-cols-3">
          {draft.map((t, i) => (
            <div key={t.id} className="space-y-3 rounded-2xl border border-border p-4">
              <Field label="Tier name" htmlFor={`tn-${t.id}`}><Input id={`tn-${t.id}`} value={t.name} onChange={(e) => set(i, { name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Monthly" htmlFor={`tm-${t.id}`}><NumberInput id={`tm-${t.id}`} value={t.monthlyPKR} min={0} step={100} onChange={(v) => set(i, { monthlyPKR: Math.max(0, v) })} /></Field>
                <Field label="Yearly" htmlFor={`ty-${t.id}`}><NumberInput id={`ty-${t.id}`} value={t.yearlyPKR} min={0} step={1000} onChange={(v) => set(i, { yearlyPKR: Math.max(0, v) })} /></Field>
              </div>
              <div>
                <p className="label">Features</p>
                <ul className="space-y-1">{t.features.map((f, j) => <li key={j} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs"><span className="flex-1">{f}</span><button aria-label="Remove feature" onClick={() => set(i, { features: t.features.filter((_, k) => k !== j) })} className="text-subtle hover:text-loss"><X className="h-3.5 w-3.5" /></button></li>)}</ul>
                <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = feat[t.id]?.trim(); if (v) { set(i, { features: [...t.features, v] }); setFeat({ ...feat, [t.id]: "" }); } }}><Input className="h-8 text-xs" value={feat[t.id] ?? ""} onChange={(e) => setFeat({ ...feat, [t.id]: e.target.value })} placeholder="Add feature" aria-label={`Add feature to ${t.name}`} /><Button type="submit" size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /></Button></form>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
