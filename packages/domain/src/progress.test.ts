import { describe, expect, it } from 'vitest';
import { compareSessionLoad, isCardioDiscipline } from './progress.js';

describe('session load comparison', () => {
  it('splits iron time from cardio time and keeps steps as counted', () => {
    expect(isCardioDiscipline('crossfit')).toBe(true);
    expect(isCardioDiscipline('bodybuilding')).toBe(false);
    expect(
      compareSessionLoad(
        [
          { completed_at: '2026-06-01T15:20:00.000Z', discipline: 'bodybuilding', duration_seconds: 2700 },
          { completed_at: '2026-06-02T15:20:00.000Z', discipline: 'crossfit', duration_seconds: 900 },
        ],
        8124.7,
      ),
    ).toEqual({ strengthSeconds: 2700, cardioSeconds: 900, steps: 8124 });
  });
});
