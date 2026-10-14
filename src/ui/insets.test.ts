import { describe, expect, it } from 'vitest';
import { tabBarClearance } from './insets';

describe('tab bar clearance', () => {
  it('grows with the home-indicator inset when the bar has not been measured', () => {
    expect(tabBarClearance(0, 0)).toBe(48);
    expect(tabBarClearance(34, 0)).toBe(82);
    expect(tabBarClearance(47, 0)).toBeGreaterThan(tabBarClearance(34, 0));
  });

  it('uses the measured bar height for the device that rendered it', () => {
    expect(tabBarClearance(34, 108)).toBe(108);
    expect(tabBarClearance(0, 72)).toBe(72);
  });
});
