"use client";

import { Check, CreditCard, KeyRound, LogIn, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { Badge, Button, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { useApp } from "@/store/app-store";
import { pkr } from "@/lib/format";
import { cn } from "@/lib/utils";

const cloudConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AccountPage() {
  const tiers = useApp((s) => s.tiers);
  const name = useApp((s) => s.settings.userName);
  return (
    <>
      <PageHeader title="Account & Plans" description="Your account mode, subscription tiers and data rights." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<UserRound className="h-4 w-4" />} title={name} subtitle="Local mode" action={<Badge tone="amber">Not signed in</Badge>} />
          <div className="space-y-4 px-5 pb-5">
            <Notice tone="info" title="You're using PSX Pilot in local mode">All records are stored privately in this browser only. Nothing is sent to a server (except a question you explicitly send to the AI assistant, if enabled).</Notice>
            <div className="grid gap-3 sm:grid-cols-3">
              {[{ i: LogIn, t: "Registration & secure login", d: "Email + password and magic links" }, { i: KeyRound, t: "Password reset", d: "Via verified email" }, { i: ShieldCheck, t: "Private cloud data", d: "Row-level security per user" }].map((f) => (
                <div key={f.t} className="rounded-xl border border-dashed border-border p-3"><f.i className="h-4 w-4 text-accent" /><p className="mt-2 text-sm font-medium">{f.t}</p><p className="text-xs text-muted">{f.d}</p></div>
              ))}
            </div>
            <p className="text-xs text-muted">{cloudConfigured ? "Supabase environment variables detected. Cloud sync is the next integration step (see README)." : "Cloud accounts are not configured. The database schema with row-level security is ready in supabase/migrations; add Supabase credentials to enable sign-in."}</p>
            <Button variant="primary" disabled><LogIn className="h-4 w-4" />Sign in (requires cloud setup)</Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Your data rights" />
          <div className="space-y-3 px-5 pb-5 text-sm">
            <Link href="/settings#data" className="block rounded-xl border border-border p-3 hover:border-accent/40"><p className="font-medium">Export my data</p><p className="text-xs text-muted">Download a complete JSON backup or CSV reports.</p></Link>
            <Link href="/settings#data" className="block rounded-xl border border-border p-3 hover:border-accent/40"><p className="font-medium">Delete my data</p><p className="text-xs text-muted">In local mode, erase all data from this browser in Settings. Cloud accounts will support deletion requests.</p></Link>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold tracking-tight">Plans</h2>
      <Notice tone="amber" className="mb-4" title="Billing is not active">No payment provider is connected, so subscriptions cannot be purchased. All features in this build are available for evaluation. Pricing is configurable in the Admin preview.</Notice>
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((t, i) => (
          <Card key={t.id} className={cn("relative p-6", i === 1 && "border-accent/40 ring-1 ring-accent/30")}>
            {i === 1 && <Badge tone="accent" className="absolute right-5 top-5">Most popular</Badge>}
            <p className="text-sm font-semibold">{t.name}</p>
            <p className="num mt-2 text-3xl font-semibold tracking-tight">{t.monthlyPKR ? pkr(t.monthlyPKR) : t.id === "free" ? "Free" : "TBD"}<span className="text-sm font-normal text-muted">{t.monthlyPKR ? " / month" : ""}</span></p>
            <p className="text-xs text-muted">{t.yearlyPKR ? `${pkr(t.yearlyPKR)} / year` : t.id === "free" ? "Forever" : "Pricing not yet set"}</p>
            <ul className="mt-5 space-y-2">{t.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{f}</li>)}</ul>
            <Button className="mt-6 w-full" variant={i === 1 ? "primary" : "outline"} disabled><CreditCard className="h-4 w-4" />{t.id === "free" ? "Current plan" : "Billing not connected"}</Button>
          </Card>
        ))}
      </div>
    </>
  );
}
