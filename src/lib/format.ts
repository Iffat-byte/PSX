export type NumberSystem = "international" | "south-asian";

let numberSystem: NumberSystem = "international";
export function setNumberSystem(s: NumberSystem) {
  numberSystem = s;
}

const locale = () => (numberSystem === "south-asian" ? "en-IN" : "en-US");

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(n: number | null | undefined): string {
  return fmtNum(n, 0);
}

/** Pakistani Rupee: "Rs 1,234.50" / "−Rs 1,234.50" */
export function pkr(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = fmtNum(Math.abs(n), digits);
  return `${n < 0 ? "−" : ""}Rs ${s}`;
}

export function pkrSigned(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${pkr(n, digits)}`;
}

export function pkrCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (numberSystem === "south-asian") {
    if (a >= 1e7) return `${sign}Rs ${(a / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `${sign}Rs ${(a / 1e5).toFixed(2)} Lac`;
  } else {
    if (a >= 1e9) return `${sign}Rs ${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sign}Rs ${(a / 1e6).toFixed(2)}M`;
  }
  if (a >= 1e3) return `${sign}Rs ${(a / 1e3).toFixed(1)}K`;
  return `${sign}Rs ${a.toFixed(0)}`;
}

export function pct(n: number | null | undefined, digits = 2, signed = false): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = (n * 100).toFixed(digits);
  return `${signed && n > 0 ? "+" : ""}${v.replace("-", "−")}%`;
}

export function fmtDate(iso: string | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", opts);
}

export function fmtDateTime(ts: number | string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function tone(n: number | null | undefined): "gain" | "loss" | "flat" {
  if (n === null || n === undefined || !Number.isFinite(n) || Math.abs(n) < 1e-9) return "flat";
  return n > 0 ? "gain" : "loss";
}
