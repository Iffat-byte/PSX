import type { JournalTrade, PortfolioSnapshot, Quote } from "../finance/types";
import type { CalendarEvent, Thesis, WeeklyReview } from "@/store/types";
import { averageCost, concentration } from "../finance/calculators";
import { sectorAllocation } from "../insights";
import { fmtDate, fmtInt, fmtNum, pct, pkr, pkrSigned, todayISO, addDays } from "../format";

export interface AssistantContext {
  snap: PortfolioSnapshot;
  portfolioName: string;
  quotes: Record<string, Quote>;
  events: CalendarEvent[];
  journal: JournalTrade[];
  reviews: WeeklyReview[];
  theses: Record<string, Thesis>;
  transactions: { date: string; type: string; symbol?: string; quantity: number; price: number; amount: number }[];
  knownSymbols: string[];
  feePct: number;
  today?: string;
}

export interface AssistantAnswer {
  intent: string;
  text: string;
  /** Records the answer was computed from, shown as "Based on". */
  basis: string[];
}

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

/** Parses amounts like "100000", "1,00,000", "100k", "1.5 lac", "2 lakh", "1 crore", "Rs 50,000". */
export function parseAmount(q: string): number | null {
  const m = q.toLowerCase().replace(/,/g, "").match(/(?:rs\.?\s*|pkr\s*)?(\d+(?:\.\d+)?)\s*(k|thousand|hazar|hazaar|lac|lakh|lacs|lakhs|m|mn|million|cr|crore)?\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2] ?? "";
  const mult = ["k", "thousand", "hazar", "hazaar"].includes(u) ? 1e3 : ["lac", "lakh", "lacs", "lakhs"].includes(u) ? 1e5 : ["m", "mn", "million"].includes(u) ? 1e6 : ["cr", "crore"].includes(u) ? 1e7 : 1;
  const v = n * mult;
  return v >= 100 ? v : null;
}

export function findSymbol(q: string, symbols: string[]): string | null {
  const up = q.toUpperCase();
  const sorted = [...symbols].sort((a, b) => b.length - a.length);
  return sorted.find((s) => new RegExp(`(^|[^A-Z])${s}([^A-Z]|$)`).test(up)) ?? null;
}

export function answer(question: string, ctx: AssistantContext): AssistantAnswer {
  const q = ` ${question.toLowerCase().trim()} `;
  const { snap } = ctx;
  const today = ctx.today ?? todayISO();
  const sym = findSymbol(question, ctx.knownSymbols);
  const basis = (...b: string[]) => b;

  if (!snap.holdings.length && !snap.realizedEvents.length && !has(q, ["ratio", "p/e", "valuation"])) {
    return { intent: "empty", text: `Your portfolio “${ctx.portfolioName}” has no recorded transactions yet. Record purchases or import a broker CSV and I can answer questions about it.`, basis: [] };
  }

  // Average-cost / additional investment
  if (has(q, ["invest", "average", "avg", "lagaun", "lagao", "aur paise", "more money", "add more", "khareed", "kharid"]) && parseAmount(q)) {
    const amount = parseAmount(q)!;
    const targets = sym ? snap.holdings.filter((h) => h.symbol === sym) : snap.holdings.slice(0, 3);
    if (sym && !targets.length) {
      const pr = ctx.quotes[sym]?.price;
      if (!pr) return { intent: "avgcost", text: `You don't hold ${sym}, and I have no price for it from the current data source.`, basis: [] };
      const r = averageCost({ existingQty: 0, existingAvg: 0, newPrice: pr, investAmount: amount, feePct: ctx.feePct });
      return { intent: "avgcost", text: `You don't currently hold **${sym}**. With ${pkr(amount)} at the latest demo close of Rs ${fmtNum(pr)}${ctx.feePct ? ` and a ${ctx.feePct}% fee assumption` : ""}, you could buy **${fmtInt(r.addQty)} shares** (avg cost Rs ${fmtNum(r.newAvg)}, break-even Rs ${fmtNum(r.breakEven)}).`, basis: basis("Demo quote", "Your fee profile") };
    }
    const lines = targets.map((h) => {
      const price = h.price ?? h.avgCost;
      const r = averageCost({ existingQty: h.quantity, existingAvg: h.avgCost, newPrice: price, investAmount: amount, feePct: ctx.feePct });
      return `- **${h.symbol}**: +${fmtInt(r.addQty)} shares at Rs ${fmtNum(price)} → average cost Rs ${fmtNum(h.avgCost)} → **Rs ${fmtNum(r.newAvg)}** (${pct(r.avgChangePct, 2, true)}), break-even Rs ${fmtNum(r.breakEven)}.`;
    });
    return {
      intent: "avgcost",
      text: `If you invested another **${pkr(amount)}** at the latest available price${sym ? "" : " in each of your largest holdings"}:\n${lines.join("\n")}\n\nThis is a hypothetical calculation, not a recommendation. Open the Investment Lab → Average cost to adjust the price or fees.`,
      basis: basis("Your holdings (weighted average cost)", "Latest demo prices", "Your fee profile"),
    };
  }

  // Concentration
  if (has(q, ["concentrat", "largest", "biggest", "sab se zyada", "sabse zyada", "sab se bara", "sabse bara", "weight", "allocation", "heavy", "zyada paisa"])) {
    const c = concentration(snap.holdings.map((h) => h.marketValue));
    const top = snap.holdings.slice(0, 5).map((h) => `- **${h.symbol}** — ${pct(h.weight, 1)} (${pkr(h.marketValue)})`).join("\n");
    const sec = sectorAllocation(snap)[0];
    return {
      intent: "concentration",
      text: `Your highest-concentration holdings in **${ctx.portfolioName}**:\n${top}\n\nTop 3 together: **${pct(c.top3, 1)}**. Largest sector: **${sec?.sector}** at ${pct(sec?.weight, 1)}. Effective number of positions (1/HHI): **${c.effectiveN.toFixed(1)}**.`,
      basis: basis("Your holdings", "Latest demo prices"),
    };
  }

  // Realized profit by period
  if (has(q, ["realized", "realised", "profit", "munafa", "faida", "booked", "kamaya", "kamai"])) {
    const lastMonth = has(q, ["last month", "previous month", "pichle mahine", "pichlay mahine", "guzishta mahine"]);
    const thisMonth = has(q, ["this month", "is mahine", "iss mahine"]);
    const d = new Date(today + "T00:00:00");
    const m = lastMonth ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : d;
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    const ev = lastMonth || thisMonth ? snap.realizedEvents.filter((e) => e.date.startsWith(key)) : snap.realizedEvents;
    const total = ev.reduce((a, e) => a + e.pnl, 0);
    const label = lastMonth || thisMonth ? m.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "all time";
    const rows = ev.slice(-6).map((e) => `- ${fmtDate(e.date)} · ${e.symbol} · ${fmtInt(e.quantity)} sh · ${pkrSigned(e.pnl)}`).join("\n");
    return {
      intent: "realized",
      text: ev.length ? `Realized P/L for **${label}**: **${pkrSigned(total)}** from ${ev.length} sale(s), net of fees.\n${rows}${!lastMonth && !thisMonth ? `\n\nPlus dividends received: ${pkr(snap.dividends)}.` : ""}` : `No sales were recorded for ${label}, so realized P/L is Rs 0.`,
      basis: basis("Your SELL transactions (weighted average cost)"),
    };
  }

  // Since last review
  if (has(q, ["changed", "since my", "kya badla", "kya change", "review"])) {
    const last = [...ctx.reviews].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    const since = last ? new Date(last.createdAt).toISOString().slice(0, 10) : addDays(today, -7);
    const tx = ctx.transactions.filter((t) => t.date >= since);
    const realized = snap.realizedEvents.filter((e) => e.date >= since).reduce((a, e) => a + e.pnl, 0);
    const trades = ctx.journal.filter((j) => j.entryDate >= since);
    return {
      intent: "changes",
      text: `Since ${last ? `your last weekly review (${last.week})` : "the last 7 days"} — from ${fmtDate(since)}:\n- **${tx.length}** transactions recorded${tx.length ? ` (${[...new Set(tx.map((t) => t.type))].join(", ")})` : ""}\n- Realized P/L: **${pkrSigned(realized)}**\n- **${trades.length}** journal entries, ${trades.filter((t) => !t.followedPlan).length} unplanned\n- Today's change vs previous close (demo prices): **${pkrSigned(snap.dayChange)}**`,
      basis: basis("Your ledger", "Journal", "Weekly reviews"),
    };
  }

  // Corporate actions
  if (has(q, ["corporate", "dividend", "event", "book closure", "bonus", "rights", "board", "result", "munafa taqseem"])) {
    const held = new Set(snap.holdings.map((h) => h.symbol));
    const ev = ctx.events.filter((e) => e.date >= today && e.symbol && held.has(e.symbol)).sort((a, b) => (a.date < b.date ? -1 : 1));
    return {
      intent: "events",
      text: ev.length ? `Upcoming events for your holdings:\n${ev.slice(0, 8).map((e) => `- ${fmtDate(e.date)} · **${e.symbol}** · ${e.type}${e.origin === "demo" ? " _(sample event, not an actual announcement)_" : ""}`).join("\n")}` : "No upcoming events are recorded for your holdings. Add events from official PSX or company notices in the Corporate Calendar.",
      basis: basis("Corporate Calendar records"),
    };
  }

  // Downside
  if (has(q, ["downside", "worst case", "crash", "fall", "girawat", "gir", "risk", "nuqsan ho", "stress"])) {
    const mv = snap.marketValue;
    const rows = [-10, -20, -30].map((m) => `- Market-wide ${m}% → holdings ${pkr(mv * (1 + m / 100))} (**${pkrSigned((mv * m) / 100)}**), total account ${pkr(snap.totalValue + (mv * m) / 100)}`).join("\n");
    const top = snap.holdings[0];
    return {
      intent: "downside",
      text: `Illustrative downside scenarios for **${ctx.portfolioName}** (uniform price moves, cash unchanged):\n${rows}\n\nSingle-name risk: if **${top?.symbol}** (${pct(top?.weight, 1)} of holdings) fell 40%, the portfolio would lose ${pkr((top?.marketValue ?? 0) * 0.4)}.\n\nThese are arithmetic scenarios, not forecasts. Real declines are uneven across stocks.`,
      basis: basis("Your holdings", "Latest demo prices"),
    };
  }

  // Thesis
  if (has(q, ["thesis", "evidence", "for and against", "bull", "bear", "case"])) {
    const t = sym ? ctx.theses[sym] : Object.values(ctx.theses)[0];
    if (!t) return { intent: "thesis", text: `I couldn't find a saved thesis${sym ? ` for ${sym}` : ""}. Write one in Stock Research → Notes & thesis, listing evidence for and against, and I'll summarize it.`, basis: [] };
    return {
      intent: "thesis",
      text: `**${t.symbol} thesis:** ${t.summary || "(no summary)"}\n\n**Evidence for (${t.evidenceFor.length}):**\n${t.evidenceFor.map((e) => `- ${e}`).join("\n") || "- none recorded"}\n\n**Evidence against (${t.evidenceAgainst.length}):**\n${t.evidenceAgainst.map((e) => `- ${e}`).join("\n") || "- none recorded"}\n\n**Invalidation:** ${t.invalidation || "not defined"}${t.reviewDate ? `\n**Next review:** ${fmtDate(t.reviewDate)}` : ""}${t.evidenceAgainst.length === 0 ? "\n\nNote: no counter-evidence recorded — consider actively looking for it." : ""}`,
      basis: basis("Your saved thesis"),
    };
  }

  // Valuation education
  if (has(q, ["ratio", "p/e", "pe ", "valuation", "p/b", "yield", "eps"])) {
    return {
      intent: "valuation",
      text: `Common valuation ratios:\n- **P/E** = price ÷ earnings per share. How many rupees investors pay per rupee of annual profit.\n- **P/B** = price ÷ book value per share. Common for banks and asset-heavy firms.\n- **Dividend yield** = annual dividend per share ÷ price.\n- **EV/EBITDA** = enterprise value ÷ operating earnings before depreciation; useful across different debt levels.\n\nCompare ratios with the company's own history and sector peers. ${sym ? `I don't have verified financial statements for ${sym}, so I can't compute its ratios — ` : ""}PSX Pilot does not estimate financial data; a verified data source must be connected first.`,
      basis: basis("General financial education"),
    };
  }

  // Losers
  if (has(q, ["loss", "losing", "nuqsan", "nuksan", "red", "worst"])) {
    const losers = snap.holdings.filter((h) => h.unrealized < 0).sort((a, b) => a.unrealizedPct - b.unrealizedPct);
    return {
      intent: "losers",
      text: losers.length ? `Holdings below your average cost:\n${losers.map((h) => `- **${h.symbol}**: ${pct(h.unrealizedPct, 1, true)} (${pkrSigned(h.unrealized)}) — avg Rs ${fmtNum(h.avgCost)} vs Rs ${fmtNum(h.price ?? 0)}`).join("\n")}` : "None of your open positions are below average cost at the latest prices.",
      basis: basis("Your holdings", "Latest demo prices"),
    };
  }

  // Summary
  if (has(q, ["summary", "overview", "portfolio", "kitna", "kitni", "value", "mera", "total", "how am i", "kaisa"])) {
    return {
      intent: "summary",
      text: `**${ctx.portfolioName}** summary:\n- Total value: **${pkr(snap.totalValue)}** (holdings ${pkr(snap.marketValue)} + cash ${pkr(snap.cash)})\n- Unrealized P/L: **${pkrSigned(snap.unrealized)}**\n- Realized P/L: **${pkrSigned(snap.realized)}**, dividends ${pkr(snap.dividends)}\n- Total return on net contributions: **${pct(snap.returnPct, 2, true)}**\n- ${snap.holdings.length} open positions; largest ${snap.holdings[0]?.symbol} at ${pct(snap.holdings[0]?.weight, 1)}`,
      basis: basis("Your ledger", "Latest demo prices"),
    };
  }

  return {
    intent: "help",
    text: `I'm a rule-based demo assistant that answers from your own records. Try:\n- “Which holdings have the highest concentration?”\n- “What was my realized profit last month?” / “Pichle mahine ka munafa kitna tha?”\n- “If I invest another Rs 100,000 in OGDC, how would my average cost change?”\n- “Which upcoming corporate actions concern my holdings?”\n- “Help me understand the downside scenarios of this allocation.”\n- “Summarize the evidence for and against my LUCK thesis.”`,
    basis: [],
  };
}
