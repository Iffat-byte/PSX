"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, FolderOpen, Trash2 } from "lucide-react";
import { Card, ConfirmButton, EmptyState, PageHeader, Button, Badge } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { AverageCostCalc, CompoundCalc, DividendCalc, PositionSizeCalc, ProfitTargetCalc, RebalanceCalc, WhatIfCalc } from "@/components/lab/calculators";
import { useApp } from "@/store/app-store";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "average", label: "Average cost", calc: "Average cost", letter: "A" },
  { id: "whatif", label: "What-if", calc: "What-if", letter: "B" },
  { id: "position", label: "Position sizing", calc: "Position size", letter: "C" },
  { id: "targets", label: "Profit targets", calc: "Profit targets", letter: "D" },
  { id: "rebalance", label: "Rebalancing", calc: "Rebalancing", letter: "E" },
  { id: "dividend", label: "Dividend income", calc: "Dividend income", letter: "F" },
  { id: "compound", label: "Compounding", calc: "Compounding", letter: "G" },
  { id: "saved", label: "Saved scenarios", calc: "", letter: "★" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function LabPage() {
  const params = useSearchParams();
  const [tab, setTab] = useState<TabId>((params.get("tab") as TabId) || "average");
  const [loaded, setLoaded] = useState<{ key: number; inputs: Record<string, number | string> } | undefined>();
  const scenarios = useApp((s) => s.scenarios);
  const del = useApp((s) => s.deleteScenario);

  useEffect(() => {
    const t = params.get("tab") as TabId | null;
    if (t) setTab(t);
  }, [params]);

  const open = (calc: string, inputs: Record<string, number | string>) => {
    const t = TABS.find((x) => x.calc === calc);
    if (!t) return;
    setLoaded({ key: Date.now(), inputs });
    setTab(t.id);
    toast.info("Scenario loaded");
  };
  const k = loaded?.key ?? 0;
  const init = loaded?.inputs;

  return (
    <>
      <PageHeader title="Investment Lab" description="Interactive calculators with real math. Every result is a hypothetical scenario based on your inputs — never a prediction." />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { setLoaded(undefined); setTab(t.id); }}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition", tab === t.id ? "border-accent/50 bg-accent/10 text-fg" : "border-border bg-surface text-muted hover:text-fg")}
          >
            <span className={cn("grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold", tab === t.id ? "bg-accent text-accent-fg" : "bg-surface-3")}>{t.letter}</span>
            {t.label}
            {t.id === "saved" && scenarios.length > 0 && <Badge>{scenarios.length}</Badge>}
          </button>
        ))}
      </div>

      {tab === "average" && <AverageCostCalc key={k} init={init} />}
      {tab === "whatif" && <WhatIfCalc key={k} init={init} />}
      {tab === "position" && <PositionSizeCalc key={k} init={init} />}
      {tab === "targets" && <ProfitTargetCalc key={k} init={init} />}
      {tab === "rebalance" && <RebalanceCalc />}
      {tab === "dividend" && <DividendCalc key={k} init={init} />}
      {tab === "compound" && <CompoundCalc key={k} init={init} />}
      {tab === "saved" && (
        <Card>
          {scenarios.length === 0 ? (
            <EmptyState icon={<Calculator className="h-5 w-5" />} title="No saved scenarios" body="Use “Save scenario” in any calculator to revisit it later." />
          ) : (
            <ul className="divide-y divide-border">
              {scenarios.map((s) => (
                <li key={s.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="text-sm font-semibold">{s.name}</p><Badge tone="accent">{s.calculator}</Badge></div>
                    <p className="mt-1 truncate text-xs text-muted">{s.summary}</p>
                    <p className="mt-0.5 text-[11px] text-subtle">Saved {fmtDateTime(s.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => open(s.calculator, s.inputs)}><FolderOpen className="h-4 w-4" />Open</Button>
                    <ConfirmButton size="sm" title="Delete scenario?" onConfirm={() => del(s.id)} aria-label="Delete scenario"><Trash2 className="h-4 w-4" /></ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
