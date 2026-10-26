"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookPlus, Moon, Plus, Search, Star, Sun, TrendingUp } from "lucide-react";
import { ALL_NAV } from "./nav";
import { SYMBOLS } from "@/lib/market/symbols";
import { useApp } from "@/store/app-store";
import { getQuotes } from "@/lib/hooks";
import { fmtNum, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const theme = useApp((s) => s.settings.theme);
  const update = useApp((s) => s.updateSettings);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("psx:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("psx:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href);
    const quotes = getQuotes();
    const actions: Item[] = [
      { id: "a-tx", group: "Actions", label: "Add transaction", icon: Plus, run: go("/portfolio?new=tx"), keywords: "buy sell record trade" },
      { id: "a-j", group: "Actions", label: "New journal entry", icon: BookPlus, run: go("/journal?new=1"), keywords: "trade log" },
      { id: "a-al", group: "Actions", label: "Create price alert", icon: Star, run: go("/watchlists?new=alert"), keywords: "notify target" },
      { id: "a-rev", group: "Actions", label: "Start weekly review", icon: BookPlus, run: go("/behavior?review=1"), keywords: "reflection psychology" },
      { id: "a-th", group: "Actions", label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`, icon: theme === "dark" ? Sun : Moon, run: () => update({ theme: theme === "dark" ? "light" : "dark" }), keywords: "dark light mode appearance" },
    ];
    const pages: Item[] = ALL_NAV.map((n) => ({ id: "p" + n.href, group: "Pages", label: n.label, icon: n.icon, run: go(n.href) }));
    const syms: Item[] = SYMBOLS.map((s) => {
      const qt = quotes[s.symbol];
      return {
        id: "s" + s.symbol,
        group: "Symbols",
        label: `${s.symbol} — ${s.name}`,
        hint: qt ? `Rs ${fmtNum(qt.price)} · ${pct((qt.price - qt.prevClose) / qt.prevClose, 2, true)} (demo)` : s.sector,
        icon: TrendingUp,
        run: go(`/research?s=${s.symbol}`),
        keywords: s.sector,
      };
    });
    return [...actions, ...pages, ...syms];
  }, [router, theme, update]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items.filter((i) => i.group !== "Symbols").concat(items.filter((i) => i.group === "Symbols").slice(0, 6));
    return items
      .map((i) => {
        const hay = `${i.label} ${i.keywords ?? ""}`.toLowerCase();
        const score = hay.startsWith(t) ? 3 : hay.includes(" " + t) ? 2 : hay.includes(t) ? 1 : 0;
        return { i, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.i)
      .slice(0, 30);
  }, [items, q]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  if (!open) return null;

  const run = (it?: Item) => {
    if (!it) return;
    setOpen(false);
    it.run();
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-subtle" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); run(filtered[idx]); }
              else if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Type a symbol (e.g. OGDC), page or action…"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            aria-controls="palette-list"
            aria-activedescendant={filtered[idx] ? `pi-${filtered[idx].id}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results for “{q}”.</li>}
          {filtered.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            const I = it.icon;
            return (
              <li key={it.id}>
                {header && <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{header}</p>}
                <button
                  id={`pi-${it.id}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === idx}
                  onMouseMove={() => setIdx(i)}
                  onClick={() => run(it)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === idx ? "bg-accent/10 text-fg" : "text-muted")}
                >
                  <I className={cn("h-4 w-4 shrink-0", i === idx ? "text-accent" : "text-subtle")} />
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="num hidden shrink-0 text-[11px] text-subtle sm:block">{it.hint}</span>}
                  {i === idx && <ArrowRight className="h-3.5 w-3.5 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-subtle">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> open</span>
          <span className="ml-auto">Symbol prices shown are synthetic demo values</span>
        </div>
      </div>
    </div>
  );
}
