// Pure helpers behind the wheel pickers. Kept free of React / React Native so they can be
// unit-tested in the plain `node` vitest environment this app uses.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Number of decimal places implied by a step: 1 -> 0, 0.5 -> 1, 0.1 -> 1, 0.25 -> 2. */
export function decimalsFromStep(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Integers from `from` to `to` inclusive, advancing by `by` (>= 1). */
export function integerRange(from: number, to: number, by = 1): number[] {
  if (by < 1 || to < from) return [];
  const out: number[] = [];
  for (let value = from; value <= to; value += by) out.push(value);
  return out;
}

/** Index of the row whose band contains a scroll offset, clamped to the list. */
export function snapIndex(offset: number, itemHeight: number, count: number): number {
  if (count <= 0 || itemHeight <= 0) return 0;
  return clamp(Math.round(offset / itemHeight), 0, count - 1);
}

/** Rounds to the nearest multiple of `step` without binary-float drift (72.30000000001). */
export function roundToStep(value: number, step: number): number {
  const places = decimalsFromStep(step);
  const factor = 10 ** places;
  const steps = Math.round((value * factor) / Math.round(step * factor));
  return (steps * Math.round(step * factor)) / factor;
}

/** Clamp + snap a typed or external value into the picker's legal set. Returns null for garbage. */
export function normalizeValue(raw: number | string, min: number, max: number, step: number): number | null {
  let parsed: number;
  if (typeof raw === 'number') {
    parsed = raw;
  } else {
    const cleaned = raw
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[٫,]/g, '.')
      .replace(/[^\d.-]/g, '');
    // Number('') is 0 — an input with no digits at all must be rejected, not read as zero.
    if (!/\d/.test(cleaned)) return null;
    parsed = Number(cleaned);
  }
  if (!Number.isFinite(parsed)) return null;
  return clamp(roundToStep(parsed, step), min, max);
}

export type DecimalColumns = {
  wholes: number[];
  /** Fraction stops as integers in units of 10^-decimals (0..9 for one decimal). */
  fractions: number[];
  decimals: number;
};

/** Splits a decimal range into a whole-number column and a fraction column (iOS Health style). */
export function decimalColumns(min: number, max: number, step: number): DecimalColumns {
  const decimals = decimalsFromStep(step);
  const scale = 10 ** decimals;
  const fractionStep = Math.max(1, Math.round(step * scale));
  return {
    wholes: integerRange(Math.floor(min), Math.floor(max)),
    fractions: decimals === 0 ? [0] : integerRange(0, scale - 1, fractionStep),
    decimals,
  };
}

export function splitDecimal(value: number, decimals: number): { whole: number; fraction: number } {
  const scale = 10 ** decimals;
  const scaled = Math.round(value * scale);
  return { whole: Math.floor(scaled / scale), fraction: scaled % scale };
}

export function joinDecimal(whole: number, fraction: number, decimals: number): number {
  const scale = 10 ** decimals;
  return (whole * scale + fraction) / scale;
}

export function formatFixed(value: number, decimals: number): string {
  return value.toFixed(decimals);
}
