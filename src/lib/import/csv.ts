import Papa from "papaparse";
import type { Transaction, TxType } from "../finance/types";

const ALIASES: Record<string, string[]> = {
  date: ["date", "trade date", "tradedate", "transaction date", "settlement date", "value date"],
  type: ["type", "side", "transaction type", "action", "buy/sell", "b/s"],
  symbol: ["symbol", "scrip", "ticker", "security", "stock", "symbol code"],
  quantity: ["quantity", "qty", "shares", "volume", "no of shares"],
  price: ["price", "rate", "avg price", "average price", "execution price"],
  fees: ["fees", "fee", "commission", "brokerage", "charges", "total charges"],
  amount: ["amount", "net amount", "cash", "value"],
  note: ["note", "notes", "remarks", "description"],
};

const TYPE_MAP: Record<string, TxType> = {
  buy: "BUY", b: "BUY", purchase: "BUY",
  sell: "SELL", s: "SELL", sale: "SELL",
  dividend: "DIVIDEND", div: "DIVIDEND",
  bonus: "BONUS",
  deposit: "DEPOSIT", "cash in": "DEPOSIT",
  withdrawal: "WITHDRAWAL", withdraw: "WITHDRAWAL", "cash out": "WITHDRAWAL",
  fee: "FEE", charge: "FEE", charges: "FEE",
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY (PK convention)
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return iso(+m[3], mi + 1, +m[1]);
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const num = (v: unknown) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(/[,\s]|Rs\.?|PKR/gi, ""));
  return Number.isFinite(n) ? n : NaN;
};

export interface ParsedRow {
  line: number;
  tx: Omit<Transaction, "id" | "createdAt" | "portfolioId" | "source"> | null;
  error?: string;
}

export function parseBrokerCSV(text: string): { rows: ParsedRow[]; columns: Record<string, string | undefined>; headers: string[] } {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const headers = res.meta.fields ?? [];
  const columns: Record<string, string | undefined> = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    columns[key] = headers.find((h) => aliases.includes(h.toLowerCase()));
  }
  const get = (r: Record<string, string>, k: string) => (columns[k] ? r[columns[k]!] ?? "" : "");
  const rows: ParsedRow[] = res.data.map((r, i) => {
    const line = i + 2;
    const date = parseDate(get(r, "date"));
    const type = TYPE_MAP[get(r, "type").trim().toLowerCase()];
    const symbol = get(r, "symbol").trim().toUpperCase() || undefined;
    const quantity = num(get(r, "quantity"));
    const price = num(get(r, "price"));
    const fees = num(get(r, "fees"));
    let amount = num(get(r, "amount"));
    if (!date) return { line, tx: null, error: "Unrecognised date (use YYYY-MM-DD or DD/MM/YYYY)" };
    if (!type) return { line, tx: null, error: `Unknown type "${get(r, "type")}"` };
    if ([quantity, price, fees, amount].some(Number.isNaN)) return { line, tx: null, error: "Non-numeric value" };
    if ((type === "BUY" || type === "SELL") && (!symbol || quantity <= 0 || price <= 0)) return { line, tx: null, error: "Trades need symbol, quantity and price" };
    if ((type === "BUY" || type === "SELL" || type === "BONUS") && !Number.isInteger(quantity)) return { line, tx: null, error: "Quantity must be a whole number" };
    if ((type === "DIVIDEND" || type === "BONUS") && !symbol) return { line, tx: null, error: "Symbol required" };
    if (["DEPOSIT", "WITHDRAWAL", "FEE", "DIVIDEND"].includes(type)) {
      amount = Math.abs(amount);
      if (!(amount > 0)) return { line, tx: null, error: "Amount required" };
    }
    if (fees < 0) return { line, tx: null, error: "Fees cannot be negative" };
    const isTrade = type === "BUY" || type === "SELL";
    return {
      line,
      tx: {
        date,
        type,
        symbol,
        quantity: isTrade || type === "BONUS" ? quantity : 0,
        price: isTrade ? price : 0,
        fees: isTrade ? fees : 0,
        amount: isTrade || type === "BONUS" ? 0 : amount,
        note: get(r, "note") || undefined,
      },
    };
  });
  return { rows, columns, headers };
}

export const CSV_TEMPLATE = `date,type,symbol,quantity,price,fees,amount,note
2026-01-02,DEPOSIT,,,,,500000,Initial deposit
2026-01-03,BUY,OGDC,500,210.50,160,,
2026-02-10,SELL,OGDC,200,225.00,70,,Partial profit
2026-03-01,DIVIDEND,OGDC,,,,2550,Net of tax
`;
