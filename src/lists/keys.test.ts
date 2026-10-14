import { describe, expect, it } from 'vitest';
import { stableRecordKey } from './keys';

describe('list keys', () => {
  it('keeps two identical weights on the same day distinct', () => {
    const first = { id: '11111111-1111-4111-8111-111111111111', recorded_on: '2026-10-12', weight_grams: 80000 };
    const second = { id: '22222222-2222-4222-8222-222222222222', recorded_on: '2026-10-12', weight_grams: 80000 };
    expect(stableRecordKey(first.id)).not.toBe(stableRecordKey(second.id));
    expect(new Set([stableRecordKey(first.id), stableRecordKey(second.id)]).size).toBe(2);
  });
});
