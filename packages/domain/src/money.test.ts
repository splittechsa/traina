import { describe, expect, it } from 'vitest';
import { applyBasisPoints, extractInclusiveTax, formatMinorUnits, parseScaledInteger } from './money.js';
import { DomainError } from './errors.js';

describe('money', () => {
  it('applies basis points with integer floor division', () => {
    expect(applyBasisPoints(10_000, 1_500)).toBe(1_500);
    expect(applyBasisPoints(1, 1)).toBe(0);
    expect(applyBasisPoints(8_275, 2_000)).toBe(1_655);
    expect(applyBasisPoints(10_000, 10_000)).toBe(10_000);
    expect(applyBasisPoints(10_000, 0)).toBe(0);
  });

  it('rejects fractional and oversized rates', () => {
    expect(() => applyBasisPoints(10.5, 100)).toThrow(DomainError);
    expect(() => applyBasisPoints(100, 10_001)).toThrow(DomainError);
    expect(() => applyBasisPoints(-1, 100)).toThrow(DomainError);
  });

  it('extracts inclusive tax without floating point', () => {
    expect(extractInclusiveTax(11_500, 1_500)).toBe(1_500);
    expect(extractInclusiveTax(10_000, 1_500)).toBe(1_304);
  });

  it('parses decimal strings at a fixed scale', () => {
    expect(parseScaledInteger('70.25', 1000)).toBe(70_250);
    expect(parseScaledInteger('170.5', 10)).toBe(1_705);
    expect(parseScaledInteger('100', 100)).toBe(10_000);
    expect(() => parseScaledInteger('70.2514', 1000)).toThrow(DomainError);
    expect(() => parseScaledInteger('1e2', 100)).toThrow(DomainError);
  });

  it('formats halalas as a decimal string', () => {
    expect(formatMinorUnits(11_550)).toBe('115.50');
    expect(formatMinorUnits(5)).toBe('0.05');
  });
});
