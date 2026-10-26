"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, Moon, Search, Sun } from "lucide-react";
import { useApp } from "@/store/app-store";
import { market } from "@/lib/market/demo-provider";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Kbd, Tooltip } from "@/components/ui";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export const openPalette = () => window.dispatchEvent(new CustomEvent("psx:palette"));

export function Topbar() {
  const theme = useApp((s) => s.settings.theme);
  const update = useApp((s) => s.updateSettings);
  const portfolios = useApp((s) => s.portfolios);
  const activeId = useApp((s) => s.activePortfolioId);
  const setActive = useApp((s) => s.setActivePortfolio);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/75 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Link href="/" className="lg:hidden" aria-label="Home"><Logo compact /></Link>
        <button
          onClick={openPalette}
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface-2/70 px-3 text-left text-sm text-subtle transition hover:border-accent/40 hover:text-muted sm:max-w-md"
          aria-label="Search symbols, pages and actions"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search symbols, pages, actions…</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Tooltip content={market.disclaimer}>
            <Link href="/settings#data" className="hidden items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[11px] font-medium text-amber md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-amber" />
              Demo data · {fmtDate(market.asOf(), { day: "2-digit", month: "short" })}
            </Link>
          </Tooltip>

          <label className="sr-only" htmlFor="pf-switch">Active portfolio</label>
          <select
            id="pf-switch"
            value={activeId}
            onChange={(e) => setActive(e.target.value)}
            className="hidden h-9 max-w-[180px] truncate rounded-xl border border-border bg-surface-2 px-2.5 text-xs font-medium sm:block"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.kind === "paper" ? " (paper)" : ""}</option>
            ))}
          </select>

          <button
            onClick={() => update({ theme: theme === "dark" ? "light" : "dark" })}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const items = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markRead);
  const unread = items.filter((n) => !n.read).length;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="num absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber px-1 text-[9px] font-bold text-black">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,360px)] animate-scale-in overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button onClick={() => markRead()} className="flex items-center gap-1 text-xs text-accent hover:underline"><Check className="h-3.5 w-3.5" /> Mark all read</button>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted">You&apos;re all caught up.</li>}
            {items.slice(0, 12).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? "/notifications"}
                  onClick={() => { markRead(n.id); setOpen(false); }}
                  className={cn("flex gap-3 border-b border-border/60 px-4 py-3 hover:bg-surface-2", !n.read && "bg-accent/[.04]")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-surface-3" : n.kind === "alert" ? "bg-amber" : "bg-accent")} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{n.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>
                    <span className="mt-1 block text-[10px] text-subtle">{fmtDateTime(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-accent hover:bg-surface-2">Open notification center</Link>
        </div>
      )}
    </div>
  );
}
