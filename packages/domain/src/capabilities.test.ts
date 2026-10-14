import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLATFORM_CAPABILITIES, assertCapabilitiesHonest } from './capabilities.js';

describe('platform claims', () => {
  it('does not claim validated million-user capacity', () => {
    expect(PLATFORM_CAPABILITIES.scale.validated).toBe(false);
    expect(() => assertCapabilitiesHonest()).not.toThrow();
  });

  it('does not seed approved coaching rules or password columns', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const sql = readFileSync(resolve(root, 'database/migrations/0001_core.sql'), 'utf8');
    expect(sql.toLowerCase()).not.toContain('password');
    expect(sql.toLowerCase()).not.toContain('insert into');
    expect(sql).toContain('sahhti_forbid_mutation');
    expect(sql).toContain('financial_ledger_entries');
  });
});
