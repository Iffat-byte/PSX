import type { BehaviorOptions } from "@/lib/finance/behavior";
import type { FeeProfile } from "@/lib/finance/fees";
import type { NumberSystem } from "@/lib/format";

export interface WatchItem {
  symbol: string;
  note?: string;
  addedAt: number;
}

export interface Watchlist {
  id: string;
  name: string;
  kind: "general" | "shariah";
  items: WatchItem[];
  createdAt: number;
}

export type AlertKind = "above" | "below" | "pctUp" | "pctDown" | "volumeAbove" | "positionWeight";

export interface PriceAlert {
  id: string;
  symbol: string;
  kind: AlertKind;
  value: number;
  note?: string;
  active: boolean;
  createdAt: number;
  triggeredAt?: number;
  triggeredValue?: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: "alert" | "reminder" | "system" | "dividend";
  createdAt: number;
  read: boolean;
  href?: string;
}

export interface WeeklyReview {
  id: string;
  week: string;
  wentWell: string;
  improve: string;
  focus: string;
  rating: number;
  createdAt: number;
}

export interface SavedScenario {
  id: string;
  calculator: string;
  name: string;
  inputs: Record<string, number | string>;
  summary: string;
  createdAt: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface PriceLevel {
  id: string;
  symbol: string;
  price: number;
  note: string;
}

export interface DailyPlan {
  date: string;
  checklist: ChecklistItem[];
  tasks: ChecklistItem[];
  levels: PriceLevel[];
  plan: string;
  notes: string;
  recap: string;
  nextSession: ChecklistItem[];
}

export interface ResearchNote {
  id: string;
  symbol: string;
  title: string;
  body: string;
  stance: "bull" | "bear" | "neutral";
  createdAt: number;
}

export interface Thesis {
  symbol: string;
  summary: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  invalidation: string;
  reviewDate: string;
  updatedAt: number;
}

export interface ShariahRecord {
  id: string;
  symbol: string;
  status: "Compliant" | "Non-compliant";
  sourceName: string;
  sourceUrl: string;
  publishedOn: string;
  recordedAt: number;
}

export type CorpEventType = "Results" | "Board Meeting" | "Dividend" | "Book Closure" | "Bonus" | "Rights" | "AGM" | "Other";

export interface CalendarEvent {
  id: string;
  date: string;
  symbol?: string;
  type: CorpEventType;
  title: string;
  note?: string;
  remind: boolean;
  origin: "user" | "demo";
}

export interface DividendRecord {
  id: string;
  portfolioId: string;
  symbol: string;
  status: "expected" | "declared" | "received";
  dps: number;
  quantity: number;
  taxPct: number;
  bookClosure?: string;
  paymentDate?: string;
  note?: string;
  ledgerTxId?: string;
  createdAt: number;
}

export type WidgetId =
  | "kpis"
  | "value-history"
  | "allocation"
  | "movers"
  | "risk"
  | "watchlist"
  | "alerts"
  | "events"
  | "today"
  | "insights"
  | "behavior";

export interface WidgetConfig {
  id: WidgetId;
  visible: boolean;
  size: "half" | "full";
}

export interface PlanTier {
  id: "free" | "pro" | "premium";
  name: string;
  monthlyPKR: number;
  yearlyPKR: number;
  features: string[];
}

export interface Settings {
  theme: "dark" | "light";
  numberSystem: NumberSystem;
  feeProfile: FeeProfile;
  behavior: BehaviorOptions;
  maxPositionPct: number;
  maxSectorPct: number;
  dividendTaxPct: number;
  checklistTemplate: string[];
  dashboard: WidgetConfig[];
  sidebarCollapsed: boolean;
  soundAlerts: boolean;
  notifyInApp: boolean;
  notifyBrowser: boolean;
  notifyEmail: boolean;
  reviewReminderDay: number;
  userName: string;
}
