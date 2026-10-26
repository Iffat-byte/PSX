"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_GROUPS } from "./nav";
import { Logo } from "./logo";
import { useApp } from "@/store/app-store";
import { cn } from "@/lib/utils";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useApp((s) => s.settings.sidebarCollapsed);
  const update = useApp((s) => s.updateSettings);
  const unread = useApp((s) => s.notifications.filter((n) => !n.read).length);

  return (
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface/80 backdrop-blur-xl transition-[width] duration-200 lg:flex", collapsed ? "w-[76px]" : "w-[248px]")}>
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center" : "px-5")}>
        <Link href="/" aria-label="PSX Pilot home"><Logo compact={collapsed} /></Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mb-5">
            {!collapsed && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(pathname, it.href);
                const I = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      title={collapsed ? it.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        active ? "bg-accent/10 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
                      <I className={cn("h-[18px] w-[18px] shrink-0", active ? "text-accent" : "text-subtle group-hover:text-fg")} />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                      {it.href === "/notifications" && unread > 0 && (
                        <span className={cn("num rounded-full bg-amber px-1.5 text-[10px] font-bold text-black", collapsed ? "absolute right-2 top-1" : "ml-auto")}>{unread}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <button
          onClick={() => update({ sidebarCollapsed: !collapsed })}
          className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted hover:bg-surface-2 hover:text-fg", collapsed && "justify-center px-0")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}
