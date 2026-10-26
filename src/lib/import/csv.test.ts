import { describe, expect, it } from "vitest";
import { parseBrokerCSV, parseDate, CSV_TEMPLATE } from "./csv";

describe("csv import", () => {
  it("parses dates in common formats and rejects invalid ones", () => {
    expect(parseDate("2026-01-05")).toBe("2026-01-05");
    expect(parseDate("05/01/2026")).toBe("2026-01-05");
    expect(parseDate("5-Jan-2026")).toBe("2026-01-05");
    expect(parseDate("31/02/2026")).toBeNull();
  });
  it("parses the template", () => {
    const { rows } = parseBrokerCSV(CSV_TEMPLATE);
    expect(rows.every((r) => r.tx)).toBe(true);
    expect(rows[1].tx).toMatchObject({ type: "BUY", symbol: "OGDC", quantity: 500, price: 210.5, fees: 160 });
  });
  it("maps aliases and flags bad rows", () => {
    const { rows } = parseBrokerCSV("Trade Date,Side,Scrip,Qty,Rate,Commission\n02/01/2026,Buy,hbl,\"1,000\",120,50\n02/01/2026,Hold,HBL,1,1,0");
    expect(rows[0].tx).toMatchObject({ symbol: "HBL", quantity: 1000, type: "BUY" });
    expect(rows[1].error).toMatch(/Unknown type/);
  });
});
