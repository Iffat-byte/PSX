"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { JournalTrade, Portfolio, Transaction } from "@/lib/finance/types";
import { ZERO_FEES } from "@/lib/finance/fees";
import { DEFAULT_BEHAVIOR_OPTIONS } from "@/lib/finance/behavior";
import { uid } from "@/lib/utils";
import { buildDemoData } from "./seed";
import type {
  AppNotification,
  CalendarEvent,
  DailyPlan,
  DividendRecord,
  PlanTier,
  PriceAlert,
  ResearchNote,
  SavedScenario,
  Settings,
  ShariahRecord,
  Thesis,
  Watchlist,
  WeeklyReview,
  WidgetConfig,
} from "./types";

export const DEFAULT_DASHBOARD: WidgetConfig[] = [
  { id: "kpis", visible: true, size: "full" },
  { id: "value-history", visible: true, size: "full" },
  { id: "allocation", visible: true, size: "half" },
  { id: "movers", visible: true, size: "half" },
  { id: "today", visible: true, size: "half" },
  { id: "alerts", visible: true, size: "half" },
  { id: "risk", visible: true, size: "half" },
  { id: "events", visible: true, size: "half" },
  { id: "watchlist", visible: true, size: "half" },
  { id: "insights", visible: true, size: "half" },
  { id: "behavior", visible: true, size: "full" },
];

export const DEFAULT_CHECKLIST = [
  "Review overnight news and PSX notices for my holdings",
  "Check upcoming corporate actions this week",
  "Review triggered alerts and price levels",
  "Confirm max risk per trade before placing orders",
  "Write today's trading plan (or decide not to trade)",
];

export const DEFAULT_PLANS: PlanTier[] = [
  { id: "free", name: "Free", monthlyPKR: 0, yearlyPKR: 0, features: ["1 portfolio", "Core Investment Lab calculators", "1 watchlist (20 symbols)", "Basic trade journal"] },
  { id: "pro", name: "Pro", monthlyPKR: 0, yearlyPKR: 0, features: ["Unlimited portfolios", "Advanced analytics & reports", "Alerts & notification center", "Research workspace", "Selected AI capabilities"] },
  { id: "premium", name: "Premium", monthlyPKR: 0, yearlyPKR: 0, features: ["Everything in Pro", "Advanced simulations", "Extended AI research assistant", "Full Behavior Studio analytics", "Daily workspace automations"] },
];

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  numberSystem: "international",
  feeProfile: ZERO_FEES,
  behavior: DEFAULT_BEHAVIOR_OPTIONS,
  maxPositionPct: 20,
  maxSectorPct: 35,
  dividendTaxPct: 0,
  checklistTemplate: DEFAULT_CHECKLIST,
  dashboard: DEFAULT_DASHBOARD,
  sidebarCollapsed: false,
  soundAlerts: false,
  notifyInApp: true,
  notifyBrowser: false,
  notifyEmail: false,
  reviewReminderDay: 5,
  userName: "Investor",
};

export interface AppState {
  version: number;
  hasDemoData: boolean;
  portfolios: Portfolio[];
  activePortfolioId: string;
  transactions: Transaction[];
  journal: JournalTrade[];
  watchlists: Watchlist[];
  alerts: PriceAlert[];
  notifications: AppNotification[];
  reviews: WeeklyReview[];
  scenarios: SavedScenario[];
  plans: Record<string, DailyPlan>;
  notes: ResearchNote[];
  theses: Record<string, Thesis>;
  shariah: ShariahRecord[];
  events: CalendarEvent[];
  dividends: DividendRecord[];
  settings: Settings;
  tiers: PlanTier[];

  // portfolios
  addPortfolio: (p: Omit<Portfolio, "id" | "createdAt">) => string;
  updatePortfolio: (id: string, patch: Partial<Portfolio>) => void;
  deletePortfolio: (id: string) => void;
  setActivePortfolio: (id: string) => void;
  // transactions
  addTransactions: (txs: Omit<Transaction, "id" | "createdAt">[]) => string[];
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  // journal
  upsertTrade: (t: JournalTrade) => void;
  deleteTrade: (id: string) => void;
  // watchlists & alerts
  addWatchlist: (name: string, kind?: Watchlist["kind"]) => string;
  renameWatchlist: (id: string, name: string) => void;
  deleteWatchlist: (id: string) => void;
  addToWatchlist: (id: string, symbol: string) => void;
  removeFromWatchlist: (id: string, symbol: string) => void;
  setWatchNote: (id: string, symbol: string, note: string) => void;
  addAlert: (a: Omit<PriceAlert, "id" | "createdAt" | "active">) => void;
  updateAlert: (id: string, patch: Partial<PriceAlert>) => void;
  deleteAlert: (id: string) => void;
  // notifications
  notify: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markRead: (id?: string) => void;
  clearNotifications: () => void;
  // reviews & scenarios
  upsertReview: (r: Omit<WeeklyReview, "id" | "createdAt"> & { id?: string }) => void;
  deleteReview: (id: string) => void;
  saveScenario: (s: Omit<SavedScenario, "id" | "createdAt">) => void;
  deleteScenario: (id: string) => void;
  // daily plans
  updatePlan: (date: string, patch: Partial<DailyPlan>) => void;
  // research
  addNote: (n: Omit<ResearchNote, "id" | "createdAt">) => void;
  deleteNote: (id: string) => void;
  saveThesis: (t: Omit<Thesis, "updatedAt">) => void;
  // shariah
  addShariahRecord: (r: Omit<ShariahRecord, "id" | "recordedAt">) => void;
  deleteShariahRecord: (id: string) => void;
  // calendar & dividends
  upsertEvent: (e: Omit<CalendarEvent, "id"> & { id?: string }) => void;
  deleteEvent: (id: string) => void;
  upsertDividend: (d: Omit<DividendRecord, "id" | "createdAt"> & { id?: string }) => string;
  deleteDividend: (id: string) => void;
  // settings
  updateSettings: (patch: Partial<Settings>) => void;
  updateTiers: (tiers: PlanTier[]) => void;
  // data management
  loadDemoData: () => void;
  clearDemoData: () => void;
  resetAll: () => void;
  importBackup: (data: Partial<AppState>) => void;
}

function emptyState() {
  const pf: Portfolio = { id: uid("pf-"), name: "My Portfolio", kind: "real", benchmark: "KSE100", createdAt: Date.now() };
  return {
    hasDemoData: false,
    portfolios: [pf],
    activePortfolioId: pf.id,
    transactions: [] as Transaction[],
    journal: [] as JournalTrade[],
    watchlists: [{ id: uid("wl-"), name: "My Watchlist", kind: "general" as const, items: [], createdAt: Date.now() }],
    alerts: [] as PriceAlert[],
    notifications: [] as AppNotification[],
    reviews: [] as WeeklyReview[],
    scenarios: [] as SavedScenario[],
    plans: {} as Record<string, DailyPlan>,
    notes: [] as ResearchNote[],
    theses: {} as Record<string, Thesis>,
    shariah: [] as ShariahRecord[],
    events: [] as CalendarEvent[],
    dividends: [] as DividendRecord[],
  };
}

function demoState() {
  const d = buildDemoData();
  return {
    ...emptyState(),
    hasDemoData: true,
    portfolios: d.portfolios,
    activePortfolioId: d.portfolios[0].id,
    transactions: d.transactions,
    journal: d.journal,
    watchlists: d.watchlists,
    alerts: d.alerts,
    events: d.events,
    dividends: d.dividends,
    notes: d.notes,
    reviews: d.reviews,
    notifications: [
      {
        id: uid("n-"),
        title: "Welcome to PSX Pilot",
        body: "You're exploring with clearly-labelled demo data. Clear it from Settings whenever you're ready to add your own records.",
        kind: "system" as const,
        createdAt: Date.now(),
        read: false,
        href: "/settings",
      },
    ],
  };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      version: 1,
      ...demoState(),
      settings: DEFAULT_SETTINGS,
      tiers: DEFAULT_PLANS,

      addPortfolio: (p) => {
        const id = uid("pf-");
        set((s) => ({ portfolios: [...s.portfolios, { ...p, id, createdAt: Date.now() }], activePortfolioId: id }));
        return id;
      },
      updatePortfolio: (id, patch) => set((s) => ({ portfolios: s.portfolios.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePortfolio: (id) =>
        set((s) => {
          const portfolios = s.portfolios.filter((p) => p.id !== id);
          if (!portfolios.length) return s;
          return {
            portfolios,
            transactions: s.transactions.filter((t) => t.portfolioId !== id),
            dividends: s.dividends.filter((d) => d.portfolioId !== id),
            activePortfolioId: s.activePortfolioId === id ? portfolios[0].id : s.activePortfolioId,
          };
        }),
      setActivePortfolio: (id) => set({ activePortfolioId: id }),

      addTransactions: (txs) => {
        const base = Date.now();
        const rows = txs.map((t, i) => ({ ...t, symbol: t.symbol?.toUpperCase(), id: uid("tx-"), createdAt: base + i }));
        set((s) => ({ transactions: [...s.transactions, ...rows] }));
        return rows.map((r) => r.id);
      },
      updateTransaction: (id, patch) => set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.filter((t) => t.id !== id),
          dividends: s.dividends.map((d) => (d.ledgerTxId === id ? { ...d, ledgerTxId: undefined } : d)),
        })),

      upsertTrade: (t) =>
        set((s) => ({ journal: s.journal.some((x) => x.id === t.id) ? s.journal.map((x) => (x.id === t.id ? t : x)) : [t, ...s.journal] })),
      deleteTrade: (id) => set((s) => ({ journal: s.journal.filter((t) => t.id !== id) })),

      addWatchlist: (name, kind = "general") => {
        const id = uid("wl-");
        set((s) => ({ watchlists: [...s.watchlists, { id, name, kind, items: [], createdAt: Date.now() }] }));
        return id;
      },
      renameWatchlist: (id, name) => set((s) => ({ watchlists: s.watchlists.map((w) => (w.id === id ? { ...w, name } : w)) })),
      deleteWatchlist: (id) => set((s) => ({ watchlists: s.watchlists.filter((w) => w.id !== id) })),
      addToWatchlist: (id, symbol) =>
        set((s) => ({
          watchlists: s.watchlists.map((w) =>
            w.id === id && !w.items.some((i) => i.symbol === symbol) ? { ...w, items: [...w.items, { symbol, addedAt: Date.now() }] } : w,
          ),
        })),
      removeFromWatchlist: (id, symbol) =>
        set((s) => ({ watchlists: s.watchlists.map((w) => (w.id === id ? { ...w, items: w.items.filter((i) => i.symbol !== symbol) } : w)) })),
      setWatchNote: (id, symbol, note) =>
        set((s) => ({
          watchlists: s.watchlists.map((w) => (w.id === id ? { ...w, items: w.items.map((i) => (i.symbol === symbol ? { ...i, note } : i)) } : w)),
        })),
      addAlert: (a) => set((s) => ({ alerts: [{ ...a, id: uid("al-"), createdAt: Date.now(), active: true }, ...s.alerts] })),
      updateAlert: (id, patch) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      deleteAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

      notify: (n) => set((s) => ({ notifications: [{ ...n, id: uid("n-"), createdAt: Date.now(), read: false }, ...s.notifications].slice(0, 200) })),
      markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (!id || n.id === id ? { ...n, read: true } : n)) })),
      clearNotifications: () => set({ notifications: [] }),

      upsertReview: (r) =>
        set((s) => {
          const existing = s.reviews.find((x) => (r.id ? x.id === r.id : x.week === r.week));
          if (existing) return { reviews: s.reviews.map((x) => (x.id === existing.id ? { ...existing, ...r, id: existing.id } : x)) };
          return { reviews: [{ ...r, id: uid("wr-"), createdAt: Date.now() }, ...s.reviews] };
        }),
      deleteReview: (id) => set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) })),
      saveScenario: (sc) => set((s) => ({ scenarios: [{ ...sc, id: uid("sc-"), createdAt: Date.now() }, ...s.scenarios] })),
      deleteScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),

      updatePlan: (date, patch) =>
        set((s) => {
          const cur: DailyPlan = s.plans[date] ?? {
            date,
            checklist: s.settings.checklistTemplate.map((text) => ({ id: uid("c-"), text, done: false })),
            tasks: [],
            levels: [],
            plan: "",
            notes: "",
            recap: "",
            nextSession: [],
          };
          return { plans: { ...s.plans, [date]: { ...cur, ...patch } } };
        }),

      addNote: (n) => set((s) => ({ notes: [{ ...n, id: uid("rn-"), createdAt: Date.now() }, ...s.notes] })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      saveThesis: (t) => set((s) => ({ theses: { ...s.theses, [t.symbol]: { ...t, updatedAt: Date.now() } } })),

      addShariahRecord: (r) => set((s) => ({ shariah: [{ ...r, id: uid("sh-"), recordedAt: Date.now() }, ...s.shariah] })),
      deleteShariahRecord: (id) => set((s) => ({ shariah: s.shariah.filter((r) => r.id !== id) })),

      upsertEvent: (e) =>
        set((s) =>
          e.id && s.events.some((x) => x.id === e.id)
            ? { events: s.events.map((x) => (x.id === e.id ? ({ ...x, ...e } as CalendarEvent) : x)) }
            : { events: [...s.events, { ...e, id: uid("ev-") }] },
        ),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      upsertDividend: (d) => {
        const id = d.id ?? uid("dv-");
        set((s) =>
          s.dividends.some((x) => x.id === id)
            ? { dividends: s.dividends.map((x) => (x.id === id ? { ...x, ...d, id } : x)) }
            : { dividends: [{ ...d, id, createdAt: Date.now() }, ...s.dividends] },
        );
        return id;
      },
      deleteDividend: (id) => set((s) => ({ dividends: s.dividends.filter((d) => d.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      updateTiers: (tiers) => set({ tiers }),

      loadDemoData: () => set({ ...demoState() }),
      clearDemoData: () => {
        const s = get();
        const keepPf = s.portfolios.filter((p) => !p.id.startsWith("pf-demo-"));
        const fresh = emptyState();
        const portfolios = keepPf.length ? keepPf : fresh.portfolios;
        set({
          hasDemoData: false,
          portfolios,
          activePortfolioId: portfolios[0].id,
          transactions: s.transactions.filter((t) => t.source !== "demo" && !t.portfolioId.startsWith("pf-demo-")),
          journal: s.journal.filter((t) => !t.id.startsWith("jr-demo-")),
          watchlists: s.watchlists.filter((w) => !w.id.startsWith("wl-demo-")).length ? s.watchlists.filter((w) => !w.id.startsWith("wl-demo-")) : fresh.watchlists,
          alerts: s.alerts.filter((a) => !a.id.startsWith("al-demo-")),
          events: s.events.filter((e) => e.origin !== "demo"),
          dividends: s.dividends.filter((d) => !d.id.startsWith("dv-demo-") && !d.portfolioId.startsWith("pf-demo-")),
          notes: s.notes.filter((n) => !n.id.startsWith("rn-demo-")),
          reviews: s.reviews.filter((r) => !r.id.startsWith("wr-demo-")),
        });
      },
      resetAll: () => set({ ...emptyState(), settings: { ...DEFAULT_SETTINGS, theme: get().settings.theme }, tiers: DEFAULT_PLANS }),
      importBackup: (data) => {
        const allowed: (keyof AppState)[] = [
          "portfolios", "activePortfolioId", "transactions", "journal", "watchlists", "alerts", "notifications", "reviews",
          "scenarios", "plans", "notes", "theses", "shariah", "events", "dividends", "settings", "hasDemoData",
        ];
        const patch: Record<string, unknown> = {};
        for (const k of allowed) if (k in data) patch[k] = data[k];
        set(patch as Partial<AppState>);
      },
    }),
    {
      name: "psx-pilot:v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        if (!p) return current;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}), dashboard: mergeDashboard(p.settings?.dashboard) },
        };
      },
    },
  ),
);

function mergeDashboard(saved?: WidgetConfig[]): WidgetConfig[] {
  if (!saved?.length) return DEFAULT_DASHBOARD;
  const known = saved.filter((w) => DEFAULT_DASHBOARD.some((d) => d.id === w.id));
  const missing = DEFAULT_DASHBOARD.filter((d) => !known.some((w) => w.id === d.id));
  return [...known, ...missing];
}

export const selectActivePortfolio = (s: AppState) => s.portfolios.find((p) => p.id === s.activePortfolioId) ?? s.portfolios[0];
