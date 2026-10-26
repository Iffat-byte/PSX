"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, X } from "lucide-react";
import { MOBILE_NAV, NAV_GROUPS } from "./nav";
import { isActive } from "./sidebar";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  return (
    <>
      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MOBILE_NAV.map((it) => {
            const active = isActive(pathname, it.href);
            const I = it.icon;
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-accent" : "text-subtle")}>
                  <I className="h-5 w-5" />
                  {it.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} className="flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-subtle" aria-haspopup="dialog">
              <LayoutGrid className="h-5 w-5" />
              More
            </button>
          </li>
        </ul>
      </nav>
      {more && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] animate-scale-in overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-3" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">All sections</p>
              <button onClick={() => setMore(false)} aria-label="Close" className="rounded-lg p-1.5 text-subtle hover:bg-surface-2"><X className="h-4 w-4" /></button>
            </div>
            {NAV_GROUPS.map((g) => (
              <div key={g.label} className="mb-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{g.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {g.items.map((it) => {
                    const I = it.icon;
                    const active = isActive(pathname, it.href);
                    return (
                      <Link key={it.href} href={it.href} onClick={() => setMore(false)} className={cn("flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-[11px] font-medium", active ? "border-accent/40 bg-accent/10 text-fg" : "border-border bg-surface-2 text-muted")}>
                        <I className={cn("h-5 w-5", active ? "text-accent" : "")} />
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
