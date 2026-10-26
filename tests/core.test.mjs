// Tests for the pure finance engine (window.PSXCore) inside app/index.html.
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
const coreSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx = {}; vm.createContext(ctx); vm.runInContext(coreSrc, ctx);
const C = ctx.PSXCore;
const TODAY = "2026-10-26";
const tx = (o, i) => ({ id: "t" + i, at: i, qty: 0, price: 0, fees: 0, amount: 0, ...o });

test("core loads and knows the main companies", () => {
  assert.ok(C);
  for (const s of ["OGDC", "HBL", "MEBL", "LUCK", "FFC", "SYS"]) assert.ok(C.SYM[s], s);
});

test("Roman Urdu sentence: one buy", () => {
  const [r] = C.parseSentence("100 OGDC 210 par khareede", TODAY);
  assert.equal(r.type, "BUY"); assert.equal(r.symbol, "OGDC"); assert.equal(r.qty, 100); assert.equal(r.price, 210); assert.equal(r.date, TODAY);
});

test("Roman Urdu sentence: two buys, number words, yesterday", () => {
  const rows = C.parseSentence("kal paanch sau Fauji 398 par aur 50 PPL 160 par liye", TODAY);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].symbol, rows[0].qty, rows[0].price, rows[0].date], ["FFC", 500, 398, "2026-10-25"]);
  assert.deepEqual([rows[1].symbol, rows[1].qty, rows[1].price], ["PPL", 50, 160]);
});

test("sell and dividend sentences", () => {
  assert.equal(C.parseSentence("50 Lucky 415 rupay par beche", TODAY)[0].type, "SELL");
  const [d] = C.parseSentence("FFC ka 2500 dividend mila", TODAY);
  assert.equal(d.type, "DIVIDEND"); assert.equal(d.amount, 2500);
});

test("weighted average cost and realized profit", () => {
  const txs = [
    tx({ type: "BUY", date: "2026-01-01", symbol: "OGDC", qty: 100, price: 10 }, 1),
    tx({ type: "BUY", date: "2026-01-02", symbol: "OGDC", qty: 100, price: 20 }, 2),
    tx({ type: "SELL", date: "2026-01-03", symbol: "OGDC", qty: 50, price: 30 }, 3),
  ];
  const L = C.replay(txs); const p = L.pos.get("OGDC");
  assert.equal(p.q, 150); assert.equal(C.round2(p.cost / p.q), 15);
  assert.equal(L.events[0].pl, 750);
});

test("selling more than you hold is flagged, not counted", () => {
  const L = C.replay([tx({ type: "BUY", date: "2026-01-01", symbol: "HBL", qty: 10, price: 100 }, 1), tx({ type: "SELL", date: "2026-01-02", symbol: "HBL", qty: 20, price: 100 }, 2)]);
  assert.equal(L.issues.length, 1); assert.equal(L.pos.get("HBL").q, 10);
});

test("broker charges: percentage vs per-share minimum, plus sales tax", () => {
  const prof = { commPct: 0.15, minPerShare: 0.03, sstPct: 15 };
  assert.equal(C.feeFor(1000, 100, prof), 172.5);   // 0.15% of 100,000 = 150, +15% = 172.5
  assert.equal(C.feeFor(1000, 10, prof), 34.5);     // 0.15% of 10,000 = 15 < 1000×0.03 = 30, +15% = 34.5
});

test("duplicate detection", () => {
  const existing = [tx({ type: "BUY", date: "2026-10-20", symbol: "MCB", qty: 100, price: 300 }, 1)];
  assert.equal(C.findDuplicate({ type: "BUY", date: "2026-10-20", symbol: "MCB", qty: 100, price: 300, amount: 0 }, existing)?.kind, "exact");
  assert.equal(C.findDuplicate({ type: "BUY", date: "2026-10-21", symbol: "MCB", qty: 100, price: 301, amount: 0 }, existing)?.kind, "possible");
  assert.equal(C.findDuplicate({ type: "BUY", date: "2026-10-21", symbol: "MCB", qty: 90, price: 300, amount: 0 }, existing), null);
});

test("announcement reader: cash dividend with book closure", () => {
  const a = C.parseAnnouncementText("Fauji Fertilizer Company Limited (FFC). The Board recommended a cash dividend of Rs. 5.00 per share i.e. 50%. The share transfer books will remain closed from November 10, 2026 to November 12, 2026 (both days inclusive).");
  assert.equal(a.kind, "dividend"); assert.equal(a.symbol, "FFC"); assert.equal(a.dps, 5);
  assert.equal(a.bookFrom, "2026-11-10"); assert.equal(a.bookTo, "2026-11-12");
});

test("number words", () => {
  assert.equal(C.wordsToNumbers("paanch sau"), "500");
  assert.equal(C.wordsToNumbers("do hazar"), "2000");
});
