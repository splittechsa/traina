import { describe, expect, it } from 'vitest';
import { formatKgFromGrams, formatRiyadhDate, formatSarFromHalalas, localizeDigits, riyadhToday } from './format';

describe('display formatting', () => {
  it('keeps Arabic digits and Saudi currency in integer units', () => {
    expect(localizeDigits('70.25', 'ar')).toBe('٧٠.٢٥');
    expect(localizeDigits('70.25', 'en')).toBe('70.25');
    expect(formatKgFromGrams(70250)).toBe('70.25');
    expect(formatSarFromHalalas(1655)).toBe('16.55 SAR');
  });

  it('formats Riyadh dates without exposing an ISO timestamp', () => {
    const formatted = formatRiyadhDate('2026-10-12T21:31:00.000Z', 'en');
    expect(formatted.includes('2026-10-12T')).toBe(false);
    expect(formatted.toLowerCase().includes('october')).toBe(true);
    expect(riyadhToday(new Date('2026-10-12T21:31:00.000Z'))).toBe('2026-10-13');
  });
});
