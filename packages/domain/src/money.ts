import { DomainError, assertSafeNonNegativeInteger } from './errors.js';

export const SUPPORTED_CURRENCIES = ['SAR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

const SCALE = 10_000n;

export function applyBasisPoints(amountMinor: number, basisPoints: number): number {
  assertSafeNonNegativeInteger(amountMinor, 'INVALID_AMOUNT');
  assertSafeNonNegativeInteger(basisPoints, 'INVALID_BASIS_POINTS');
  if (basisPoints > 10_000) {
    throw new DomainError('INVALID_BASIS_POINTS', 'Basis points cannot exceed 10000');
  }
  return Number((BigInt(amountMinor) * BigInt(basisPoints)) / SCALE);
}

/** Inclusive tax: tax = gross * rate / (1 + rate), floored to minor units. */
export function extractInclusiveTax(grossMinor: number, vatBasisPoints: number): number {
  assertSafeNonNegativeInteger(grossMinor, 'INVALID_AMOUNT');
  assertSafeNonNegativeInteger(vatBasisPoints, 'INVALID_BASIS_POINTS');
  if (vatBasisPoints > 10_000) {
    throw new DomainError('INVALID_BASIS_POINTS', 'Basis points cannot exceed 10000');
  }
  const rate = BigInt(vatBasisPoints);
  return Number((BigInt(grossMinor) * rate) / (SCALE + rate));
}

export function formatMinorUnits(amountMinor: number, fractionDigits = 2): string {
  assertSafeNonNegativeInteger(amountMinor, 'INVALID_AMOUNT');
  if (!Number.isSafeInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 6) {
    throw new DomainError('INVALID_SCALE', 'Unsupported fraction digits');
  }
  const scale = 10 ** fractionDigits;
  const whole = Math.floor(amountMinor / scale);
  const fraction = String(amountMinor % scale).padStart(fractionDigits, '0');
  return fractionDigits === 0 ? String(whole) : `${whole}.${fraction}`;
}

/**
 * Parse a non-negative decimal string into an integer at the given scale.
 * "70.25" with scale 1000 becomes 70250. Binary floating point is not used.
 */
export function parseScaledInteger(input: string, scale: number): number {
  if (!Number.isSafeInteger(scale) || scale < 1 || scale > 1_000_000_000) {
    throw new DomainError('INVALID_SCALE', 'Unsupported scale');
  }
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new DomainError('INVALID_DECIMAL', 'Expected a non-negative decimal string');
  }
  const [whole = '0', fraction = ''] = trimmed.split('.');
  const places = String(scale).length - 1;
  if (fraction.length > places) {
    throw new DomainError('SCALE_EXCEEDED', 'Too many decimal places');
  }
  const padded = fraction.padEnd(places, '0');
  const combined = BigInt(whole) * BigInt(scale) + BigInt(padded === '' ? '0' : padded);
  if (combined > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new DomainError('OVERFLOW', 'Amount exceeds the safe integer range');
  }
  return Number(combined);
}

export function assertCurrency(currency: string): asserts currency is CurrencyCode {
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
    throw new DomainError('UNSUPPORTED_CURRENCY', 'Only SAR minor units are supported in this version');
  }
}
