"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/store/app-store";
import { useHydrated } from "@/lib/hooks";
import { setNumberSystem } from "@/lib/format";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { AlertEngine } from "./alert-engine";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const theme = useApp((s) => s.settings.theme);
  const numberSystem = useApp((s) => s.settings.numberSystem);
  const collapsed = useApp((s) => s.settings.sidebarCollapsed);
  const pathname = usePathname();
  setNumberSystem(numberSystem);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  if (!hydrated) return <BootScreen />;

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">Skip to content</a>
      <Sidebar />
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
        <Topbar />
        <main id="main" key={pathname} className="mx-auto w-full max-w-[1440px] animate-fade-in px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileNav />
      <CommandPalette />
      <AlertEngine />
      <Toaster />
    </div>
  );
}

function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-ping rounded-2xl bg-accent/20" />
          <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-border bg-surface">
            <svg viewBox="0 0 64 64" className="h-7 w-7"><path d="M14 42 L26 30 L34 36 L50 20" fill="none" stroke="rgb(var(--accent))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <p className="text-xs text-muted">Loading your workspace…</p>
      </div>
    </div>
  );
}
