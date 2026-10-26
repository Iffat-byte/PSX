import { describe, expect, it } from "vitest";
import { answer, findSymbol, parseAmount, type AssistantContext } from "./engine";
import { computePortfolio } from "../finance/portfolio";
import type { Transaction } from "../finance/types";

const t = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(), portfolioId: "p", date: "2026-09-10", type: "BUY", quantity: 0, price: 0, fees: 0, amount: 0, source: "manual", createdAt: Math.random(), ...p });
const txs = [
  t({ symbol: "OGDC", quantity: 100, price: 100 }),
  t({ symbol: "HBL", quantity: 100, price: 50 }),
  t({ type: "SELL", date: "2026-09-20", symbol: "HBL", quantity: 50, price: 60 }),
];
const quotes = { OGDC: { symbol: "OGDC", price: 120, prevClose: 118, volume: 1, asOf: "", source: "" }, HBL: { symbol: "HBL", price: 55, prevClose: 55, volume: 1, asOf: "", source: "" } };
const ctx: AssistantContext = { snap: computePortfolio(txs, quotes), portfolioName: "Test", quotes, events: [], journal: [], reviews: [], theses: {}, transactions: txs, knownSymbols: ["OGDC", "HBL", "PPL"], feePct: 0, today: "2026-10-15" };

describe("assistant engine", () => {
  it("parses amounts including lakh/crore", () => {
    expect(parseAmount("invest another Rs 100,000")).toBe(100000);
    expect(parseAmount("2 lakh aur lagaun")).toBe(200000);
    expect(parseAmount("1.5 crore")).toBe(15000000);
    expect(parseAmount("50k")).toBe(50000);
  });
  it("finds symbols case-insensitively as whole words", () => {
    expect(findSymbol("what about ogdc?", ["OGDC", "PPL"])).toBe("OGDC");
    expect(findSymbol("happy", ["PPL"])).toBeNull();
  });
  it("answers realized profit last month in Roman Urdu", () => {
    const a = answer("Pichle mahine ka munafa kitna tha?", ctx);
    expect(a.intent).toBe("realized");
    expect(a.text).toContain("+Rs 500");
  });
  it("computes average cost for additional investment", () => {
    const a = answer("If I invest another Rs 12,000 in OGDC how would my average cost change?", ctx);
    expect(a.intent).toBe("avgcost");
    expect(a.text).toContain("+100 shares");
    expect(a.text).toContain("Rs 110.00");
  });
  it("answers concentration with the largest holding first", () => {
    const a = answer("Which holdings have the highest concentration?", ctx);
    expect(a.text.indexOf("OGDC")).toBeLessThan(a.text.indexOf("HBL"));
  });
  it("falls back to help", () => {
    expect(answer("hello there", ctx).intent).toBe("help");
  });
});
