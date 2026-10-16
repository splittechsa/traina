import { describe, expect, it } from 'vitest';
import { designTokens, layoutDirection } from './index.js';

describe('design tokens', () => {
  it('keeps Arabic right-to-left and defines the semantic palette', () => {
    expect(layoutDirection('ar')).toBe('rtl');
    expect(layoutDirection('en')).toBe('ltr');
    expect(designTokens.color.semantic.background).toBe('#F3EEE6');
    expect(designTokens.color.semantic.text).toBe('#1C1915');
    expect(designTokens.color.brand.green).toBe('#315C49');
    expect(designTokens.color.brand.gold).toBe('#D6A54A');
    expect(designTokens.spacing).toContain(8);
  });
});
