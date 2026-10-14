import { describe, expect, it } from 'vitest';
import { createThrottle } from './throttle.js';

describe('login throttle', () => {
  it('blocks the next attempt after the limit inside the window', () => {
    const allow = createThrottle(3, 1_000);
    expect(allow('a', 0)).toBe(true);
    expect(allow('a', 10)).toBe(true);
    expect(allow('a', 20)).toBe(true);
    expect(allow('a', 30)).toBe(false);
    expect(allow('a', 1_001)).toBe(true);
    expect(allow('b', 30)).toBe(true);
  });
});
