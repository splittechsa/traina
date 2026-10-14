import { describe, expect, it } from 'vitest';
import { verificationDigits } from './code';

describe('verification digits', () => {
  it('keeps six numbers from a pasted code', () => {
    expect(verificationDigits('رمز 123-456')).toBe('123456');
    expect(verificationDigits('12345678')).toBe('123456');
  });
});
