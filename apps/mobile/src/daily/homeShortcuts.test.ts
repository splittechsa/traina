import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-router', () => ({ router: { push: () => undefined } }));
vi.mock('expo-symbols', () => ({ SymbolView: () => null }));

import { DEFAULT_HOME_SHORTCUTS, sanitizeHomeShortcuts } from './homeShortcuts';

describe('home shortcuts', () => {
  it('keeps known ids and falls back when empty', () => {
    expect(sanitizeHomeShortcuts(['coach', 'water', 'prime'])).toEqual(['coach', 'water']);
    expect(sanitizeHomeShortcuts([])).toEqual(DEFAULT_HOME_SHORTCUTS);
    expect(sanitizeHomeShortcuts(null)).toEqual(DEFAULT_HOME_SHORTCUTS);
  });
});
