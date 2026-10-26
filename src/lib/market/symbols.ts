/**
 * Reference list of commonly traded PSX symbols with their sectors.
 * Company names and sectors are descriptive reference data only.
 * NOTE: `seedPrice`, `vol` and `demoDps` are synthetic parameters used to
 * generate demo series. They are NOT market data.
 */
export interface SymbolInfo {
  symbol: string;
  name: string;
  sector: string;
  seedPrice: number;
  vol: number;
  demoDps: number;
}

export const SYMBOLS: SymbolInfo[] = [
  { symbol: "OGDC", name: "Oil & Gas Development Company", sector: "Oil & Gas Exploration", seedPrice: 210, vol: 0.32, demoDps: 10 },
  { symbol: "PPL", name: "Pakistan Petroleum", sector: "Oil & Gas Exploration", seedPrice: 165, vol: 0.34, demoDps: 6 },
  { symbol: "MARI", name: "Mari Energies", sector: "Oil & Gas Exploration", seedPrice: 620, vol: 0.3, demoDps: 15 },
  { symbol: "POL", name: "Pakistan Oilfields", sector: "Oil & Gas Exploration", seedPrice: 590, vol: 0.27, demoDps: 40 },
  { symbol: "PSO", name: "Pakistan State Oil", sector: "Oil & Gas Marketing", seedPrice: 380, vol: 0.36, demoDps: 10 },
  { symbol: "HBL", name: "Habib Bank", sector: "Commercial Banks", seedPrice: 240, vol: 0.28, demoDps: 16 },
  { symbol: "MCB", name: "MCB Bank", sector: "Commercial Banks", seedPrice: 310, vol: 0.24, demoDps: 34 },
  { symbol: "UBL", name: "United Bank", sector: "Commercial Banks", seedPrice: 380, vol: 0.26, demoDps: 40 },
  { symbol: "MEBL", name: "Meezan Bank", sector: "Commercial Banks", seedPrice: 360, vol: 0.27, demoDps: 28 },
  { symbol: "BAHL", name: "Bank AL Habib", sector: "Commercial Banks", seedPrice: 160, vol: 0.25, demoDps: 14 },
  { symbol: "NBP", name: "National Bank of Pakistan", sector: "Commercial Banks", seedPrice: 130, vol: 0.38, demoDps: 0 },
  { symbol: "LUCK", name: "Lucky Cement", sector: "Cement", seedPrice: 420, vol: 0.3, demoDps: 8 },
  { symbol: "DGKC", name: "D.G. Khan Cement", sector: "Cement", seedPrice: 150, vol: 0.4, demoDps: 0 },
  { symbol: "MLCF", name: "Maple Leaf Cement", sector: "Cement", seedPrice: 85, vol: 0.42, demoDps: 0 },
  { symbol: "FFC", name: "Fauji Fertilizer", sector: "Fertilizer", seedPrice: 400, vol: 0.22, demoDps: 30 },
  { symbol: "EFERT", name: "Engro Fertilizers", sector: "Fertilizer", seedPrice: 210, vol: 0.24, demoDps: 18 },
  { symbol: "ENGROH", name: "Engro Holdings", sector: "Conglomerate", seedPrice: 190, vol: 0.3, demoDps: 6 },
  { symbol: "HUBC", name: "Hub Power Company", sector: "Power Generation", seedPrice: 150, vol: 0.28, demoDps: 12 },
  { symbol: "SYS", name: "Systems Limited", sector: "Technology", seedPrice: 155, vol: 0.38, demoDps: 4 },
  { symbol: "TRG", name: "TRG Pakistan", sector: "Technology", seedPrice: 75, vol: 0.5, demoDps: 0 },
  { symbol: "INDU", name: "Indus Motor Company", sector: "Automobile Assembler", seedPrice: 2100, vol: 0.26, demoDps: 120 },
  { symbol: "SEARL", name: "The Searle Company", sector: "Pharmaceuticals", seedPrice: 95, vol: 0.45, demoDps: 0 },
  { symbol: "NESTLE", name: "Nestlé Pakistan", sector: "Food & Personal Care", seedPrice: 7800, vol: 0.18, demoDps: 300 },
  { symbol: "ATRL", name: "Attock Refinery", sector: "Refinery", seedPrice: 700, vol: 0.4, demoDps: 15 },
];

export const SYMBOL_MAP: Record<string, SymbolInfo> = Object.fromEntries(SYMBOLS.map((s) => [s.symbol, s]));

export function sectorOf(symbol: string): string {
  return SYMBOL_MAP[symbol]?.sector ?? "Other / Unclassified";
}

export const BENCHMARKS = {
  KSE100: { label: "KSE-100 (synthetic demo)", seed: 120000, vol: 0.2 },
  KMI30: { label: "KMI-30 (synthetic demo)", seed: 180000, vol: 0.22 },
} as const;
