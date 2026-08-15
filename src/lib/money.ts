/**
 * Bahraini dinar: 3 decimal places (1 BHD = 1000 fils).
 * Amounts move through the app as numbers and are always rendered with
 * exactly 3 decimals, in Western digits, LTR — even inside RTL layouts.
 */
export function money(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "0.000";
  return n.toFixed(3);
}

/** Round to the nearest fils so float arithmetic can't leak 0.1+0.2 noise. */
export function fils(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function parsePrice(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return fils(n);
}
