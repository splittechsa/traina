import { describe, expect, it } from 'vitest';
import { brand, dark, light, radius, typeScale, type Palette } from './tokens';

function complete(palette: Palette): boolean {
  return Object.values(palette).every((value) => typeof value === 'string' && value.length > 0);
}

describe('Traina identity tokens', () => {
  it('keeps both appearance modes semantically complete', () => {
    expect(complete(light)).toBe(true);
    expect(complete(dark)).toBe(true);
    expect(light.scheme).toBe('light');
    expect(dark.scheme).toBe('dark');
  });

  it('reserves gold for earned emphasis instead of primary actions', () => {
    expect(light.accent).toBe(brand.green);
    expect(light.gold).toBe(brand.gold);
    expect(light.accent).not.toBe(light.gold);
    expect(dark.accent).not.toBe(dark.gold);
  });

  it('provides shared hierarchy for cards, heroes, and performance numbers', () => {
    expect(radius.hero).toBeGreaterThan(radius.card);
    expect(typeScale.numericHero).toBeGreaterThan(typeScale.numeric);
    expect(typeScale.title).toBeGreaterThan(typeScale.body);
  });
});
