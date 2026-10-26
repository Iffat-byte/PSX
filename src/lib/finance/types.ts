// Core domain types. These mirror the tables in supabase/migrations so the
// local-first store can later be swapped for a server-backed repository.

export type TxType = "BUY" | "SELL" | "DIVIDEND" | "DEPOSIT" | "WITHDRAWAL" | "FEE" | "BONUS";

export interface Transaction {
  id: string;
  portfolioId: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  type: TxType;
  symbol?: string;
  /** Shares for BUY / SELL / BONUS */
  quantity: number;
  /** Per-share price for BUY / SELL */
  price: number;
  /** Brokerage + other charges for this transaction, in PKR */
  fees: number;
  /** Cash amount for DEPOSIT / WITHDRAWAL / DIVIDEND (net received) / FEE */
  amount: number;
  note?: string;
  source: "manual" | "import" | "paper" | "demo";
  createdAt: number;
}

export interface Portfolio {
  id: string;
  name: string;
  kind: "real" | "paper";
  benchmark: "KSE100" | "KMI30" | "none";
  createdAt: number;
  description?: string;
}

export interface Holding {
  symbol: string;
  quantity: number;
  /** Total cost of shares still held (incl. buy fees), PKR */
  costBasis: number;
  avgCost: number;
  price: number | null;
  prevClose: number | null;
  marketValue: number;
  unrealized: number;
  unrealizedPct: number;
  dayChange: number;
  dayChangePct: number;
  realized: number;
  dividends: number;
  weight: number;
}

export interface RealizedEvent {
  date: string;
  symbol: string;
  quantity: number;
  proceeds: number;
  costRemoved: number;
  pnl: number;
  txId: string;
}

export interface LedgerIssue {
  txId: string;
  date: string;
  message: string;
}

export interface PortfolioSnapshot {
  holdings: Holding[];
  closedSymbols: string[];
  cash: number;
  marketValue: number;
  totalValue: number;
  costBasis: number;
  unrealized: number;
  realized: number;
  dividends: number;
  feesPaid: number;
  deposits: number;
  withdrawals: number;
  netContributions: number;
  grossBuyCost: number;
  totalGain: number;
  returnPct: number | null;
  dayChange: number;
  dayChangePct: number | null;
  realizedEvents: RealizedEvent[];
  issues: LedgerIssue[];
  /** True when there is at least one holding without a price */
  missingPrices: string[];
}

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  volume: number;
  asOf: string;
  source: string;
}

export interface JournalTrade {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryDate: string;
  entryPrice: number;
  quantity: number;
  exitDate?: string;
  exitPrice?: number;
  fees: number;
  stopLoss?: number;
  target?: number;
  strategy?: string;
  tags: string[];
  entryReason: string;
  exitReason?: string;
  confidence: number; // 1-5
  emotionEntry: Emotion;
  emotionExit?: Emotion;
  followedPlan: boolean;
  riskRespected: boolean;
  impulsive: boolean;
  pressured: boolean;
  lessons?: string;
  notes?: string;
  createdAt: number;
}

export const EMOTIONS = [
  "Calm",
  "Confident",
  "Excited",
  "Anxious",
  "Fearful",
  "Greedy",
  "Frustrated",
  "FOMO",
  "Bored",
] as const;
export type Emotion = (typeof EMOTIONS)[number];
