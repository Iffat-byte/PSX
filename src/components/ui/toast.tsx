"use client";

import { create } from "zustand";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info" | "warning";
interface Toast { id: number; kind: Kind; title: string; body?: string; action?: { label: string; run: () => void } }

const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), t.action ? 7000 : 4200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, body?: string, action?: Toast["action"]) => useToasts.getState().push({ kind: "success", title, body, action }),
  error: (title: string, body?: string) => useToasts.getState().push({ kind: "error", title, body }),
  info: (title: string, body?: string, action?: Toast["action"]) => useToasts.getState().push({ kind: "info", title, body, action }),
  warning: (title: string, body?: string) => useToasts.getState().push({ kind: "warning", title, body }),
};

const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: TriangleAlert };
const tones = { success: "text-gain", error: "text-loss", info: "text-info", warning: "text-amber" };

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end">
      {items.map((t) => {
        const I = icons[t.kind];
        return (
          <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm animate-scale-in items-start gap-3 rounded-2xl border border-border bg-surface-2/95 p-3.5 shadow-pop backdrop-blur">
            <I className={cn("mt-0.5 h-5 w-5 shrink-0", tones[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-muted">{t.body}</p>}
              {t.action && (
                <button className="mt-2 text-xs font-semibold text-accent hover:underline" onClick={() => { t.action!.run(); dismiss(t.id); }}>
                  {t.action.label}
                </button>
              )}
            </div>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="rounded-md p-0.5 text-subtle hover:text-fg"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
