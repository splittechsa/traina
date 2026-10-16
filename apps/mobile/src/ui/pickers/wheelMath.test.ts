import { describe, expect, it } from 'vitest';
import {
  clamp,
  decimalColumns,
  decimalsFromStep,
  integerRange,
  joinDecimal,
  normalizeValue,
  roundToStep,
  snapIndex,
  splitDecimal,
} from './wheelMath';

describe('wheelMath', () => {
  it('derives precision from the step', () => {
    expect(decimalsFromStep(1)).toBe(0);
    expect(decimalsFromStep(500)).toBe(0);
    expect(decimalsFromStep(0.1)).toBe(1);
    expect(decimalsFromStep(0.25)).toBe(2);
  });

  it('builds inclusive integer ranges and rejects bad input', () => {
    expect(integerRange(2000, 3000, 500)).toEqual([2000, 2500, 3000]);
    expect(integerRange(5, 4)).toEqual([]);
    expect(integerRange(1, 3, 0)).toEqual([]);
  });

  it('snaps scroll offsets to rows and clamps at both ends', () => {
    expect(snapIndex(0, 42, 10)).toBe(0);
    expect(snapIndex(62, 42, 10)).toBe(1);
    expect(snapIndex(64, 42, 10)).toBe(2);
    expect(snapIndex(-500, 42, 10)).toBe(0);
    expect(snapIndex(99_999, 42, 10)).toBe(9);
    expect(snapIndex(100, 42, 0)).toBe(0);
  });

  it('rounds to the step without float drift', () => {
    expect(roundToStep(72.30000000000001, 0.1)).toBe(72.3);
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundToStep(7740, 500)).toBe(7500);
  });

  it('normalizes typed input, including Arabic digits and decimal comma', () => {
    expect(normalizeValue('٧٢٫٥', 30, 300, 0.1)).toBe(72.5);
    expect(normalizeValue('72,46', 30, 300, 0.1)).toBe(72.5);
    expect(normalizeValue('999', 30, 300, 0.1)).toBe(300);
    expect(normalizeValue('5', 30, 300, 0.1)).toBe(30);
    expect(normalizeValue('', 30, 300, 0.1)).toBeNull();
    expect(normalizeValue('abc', 30, 300, 0.1)).toBeNull();
  });

  it('splits weight into whole + fraction columns and joins back exactly', () => {
    const columns = decimalColumns(30, 300, 0.1);
    expect(columns.wholes[0]).toBe(30);
    expect(columns.wholes[columns.wholes.length - 1]).toBe(300);
    expect(columns.wholes).toHaveLength(271);
    expect(columns.fractions).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(splitDecimal(72.3, 1)).toEqual({ whole: 72, fraction: 3 });
    expect(joinDecimal(72, 3, 1)).toBe(72.3);
    expect(decimalColumns(0, 10, 0.5).fractions).toEqual([0, 5]);
  });

  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
