/** Round to paisa precision, avoiding binary float artefacts like 0.1+0.2. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const EPS = 1e-9;

export function isZero(n: number, eps = 1e-6): boolean {
  return Math.abs(n) < eps;
}

export function safeDiv(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || isZero(b)) return null;
  return a / b;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
