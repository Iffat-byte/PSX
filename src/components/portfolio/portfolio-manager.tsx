"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useApp } from "@/store/app-store";
import type { Portfolio } from "@/lib/finance/types";

export function PortfolioModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Portfolio | null }) {
  const add = useApp((s) => s.addPortfolio);
  const update = useApp((s) => s.updatePortfolio);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Portfolio["kind"]>("real");
  const [benchmark, setBenchmark] = useState<Portfolio["benchmark"]>("KSE100");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setKind(editing?.kind ?? "real");
    setBenchmark(editing?.benchmark ?? "KSE100");
    setDescription(editing?.description ?? "");
    setErr("");
  }, [open, editing]);
  const save = () => {
    const n = name.trim();
    if (n.length < 2 || n.length > 40) return setErr("Name must be 2–40 characters.");
    if (editing) {
      update(editing.id, { name: n, benchmark, description });
      toast.success("Portfolio updated");
    } else {
      add({ name: n, kind, benchmark, description });
      toast.success(`Portfolio “${n}” created`, "It is now your active portfolio.");
    }
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit portfolio" : "New portfolio"} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Button></>}>
      <div className="space-y-4">
        <Field label="Name" error={err} htmlFor="pf-name"><Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Long-term, Dividend, Trading" onKeyDown={(e) => e.key === "Enter" && save()} /></Field>
        {!editing && (
          <Field label="Type" htmlFor="pf-kind" hint="Paper portfolios use virtual money for practice.">
            <Select id="pf-kind" value={kind} onChange={(e) => setKind(e.target.value as Portfolio["kind"])}><option value="real">Real (record-keeping)</option><option value="paper">Paper (virtual money)</option></Select>
          </Field>
        )}
        <Field label="Benchmark" htmlFor="pf-bm" hint="Benchmark series are synthetic until a licensed index feed is configured.">
          <Select id="pf-bm" value={benchmark} onChange={(e) => setBenchmark(e.target.value as Portfolio["benchmark"])}><option value="KSE100">KSE-100</option><option value="KMI30">KMI-30 (Shariah index)</option><option value="none">None</option></Select>
        </Field>
        <Field label="Description (optional)" htmlFor="pf-desc"><Input id="pf-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} /></Field>
      </div>
    </Modal>
  );
}
