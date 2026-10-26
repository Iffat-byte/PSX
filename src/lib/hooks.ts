"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useApp } from "@/store/app-store";
import { computePortfolio } from "./finance/portfolio";
import { market } from "./market/demo-provider";
import type { Quote } from "./finance/types";

export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useApp.persist.onFinishHydration(cb),
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

let quotesCache: Record<string, Quote> | null = null;
export function getQuotes(): Record<string, Quote> {
  if (!quotesCache) quotesCache = market.quotes();
  return quotesCache;
}

export function useQuotes() {
  return useMemo(() => getQuotes(), []);
}

export function usePortfolioTxs(portfolioId?: string) {
  const txs = useApp((s) => s.transactions);
  const active = useApp((s) => s.activePortfolioId);
  const id = portfolioId ?? active;
  return useMemo(() => txs.filter((t) => t.portfolioId === id), [txs, id]);
}

export function useSnapshot(portfolioId?: string) {
  const txs = usePortfolioTxs(portfolioId);
  const quotes = useQuotes();
  return useMemo(() => computePortfolio(txs, quotes), [txs, quotes]);
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    setM(mq.matches);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}
