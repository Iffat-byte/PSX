"use client";

import { useEffect } from "react";
import { useApp } from "@/store/app-store";
import { checkAlert, describeAlert, observedLabel } from "@/lib/alerts";
import { getQuotes } from "@/lib/hooks";
import { computePortfolio } from "@/lib/finance/portfolio";
import { isoWeek } from "@/lib/finance/behavior";
import { addDays, todayISO, fmtDate } from "@/lib/format";
import { toast } from "@/components/ui/toast";

const REMINDER_KEY = "psx-pilot:reminders";
// Guards against double evaluation (e.g. React StrictMode effects in development).
const handled = new Set<string>();

function remindedOnce(key: string): boolean {
  try {
    const set: string[] = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? "[]");
    if (set.includes(key)) return true;
    localStorage.setItem(REMINDER_KEY, JSON.stringify([...set.slice(-200), key]));
  } catch {
    /* storage unavailable: still deliver */
  }
  return false;
}

export function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio not available */
  }
}

/**
 * Evaluates alerts and reminders in the browser against the current (demo)
 * quotes. This is NOT a live monitoring service: it runs only while the app is
 * open and only against whatever data the active provider supplies.
 */
export function AlertEngine() {
  const alerts = useApp((s) => s.alerts);

  useEffect(() => {
    const s = useApp.getState();
    const quotes = getQuotes();
    const snap = computePortfolio(s.transactions.filter((t) => t.portfolioId === s.activePortfolioId), quotes);
    for (const a of alerts) {
      if (!a.active || handled.has(a.id)) continue;
      const v = checkAlert(a, quotes, snap);
      if (v === null) continue;
      handled.add(a.id);
      s.updateAlert(a.id, { active: false, triggeredAt: Date.now(), triggeredValue: v });
      const body = `${describeAlert(a)} — observed ${observedLabel(a, v)} (demo data).`;
      if (s.settings.notifyInApp) s.notify({ title: `Alert triggered: ${a.symbol}`, body, kind: "alert", href: "/watchlists" });
      toast.info(`Alert triggered: ${a.symbol}`, body);
      if (s.settings.soundAlerts) beep();
      if (s.settings.notifyBrowser && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification(`PSX Pilot: ${a.symbol}`, { body }); } catch { /* ignore */ }
      }
    }
  }, [alerts]);

  // Reminders: weekly review + upcoming declared dividends / tracked events.
  useEffect(() => {
    if (handled.has("__reminders")) return;
    handled.add("__reminders");
    const s = useApp.getState();
    const today = todayISO();
    const week = isoWeek(today);
    if (new Date().getDay() === s.settings.reviewReminderDay && !s.reviews.some((r) => r.week === week) && !remindedOnce(`review-${week}`)) {
      s.notify({ title: "Weekly review reminder", body: "Take 5 minutes to reflect on this week's decisions in the Behavior Studio.", kind: "reminder", href: "/behavior?review=1" });
    }
    for (const d of s.dividends) {
      if (d.status === "declared" && d.bookClosure && d.bookClosure >= today && d.bookClosure <= addDays(today, 7) && !remindedOnce(`div-${d.id}`)) {
        s.notify({ title: `Book closure soon: ${d.symbol}`, body: `Book closure on ${fmtDate(d.bookClosure)} for a declared dividend you are tracking.`, kind: "dividend", href: "/calendar" });
      }
    }
    for (const e of s.events) {
      if (e.remind && e.date >= today && e.date <= addDays(today, 2) && !remindedOnce(`ev-${e.id}`)) {
        s.notify({ title: `Upcoming: ${e.symbol ?? ""} ${e.type}`, body: `${e.title} on ${fmtDate(e.date)}.`, kind: "reminder", href: "/calendar" });
      }
    }
  }, []);

  return null;
}
