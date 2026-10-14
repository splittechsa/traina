import { describe, expect, it } from 'vitest';
import { featuredSession, uniqueById } from './unique';

describe('session list', () => {
  it('keeps the first row when the same id is returned twice', () => {
    const rows = uniqueById([
      { id: 'a', name: 'first' },
      { id: 'a', name: 'duplicate' },
      { id: 'b', name: 'other' },
    ]);
    expect(rows.map((row) => row.name)).toEqual(['first', 'other']);
  });

  it('features the active session and does not treat a repeated id as a second workout', () => {
    const rows = uniqueById([
      { id: 'done', status: 'completed', scheduled_for: '2026-10-11T10:00:00.000Z' },
      { id: 'live', status: 'in_progress', scheduled_for: '2026-10-12T10:00:00.000Z' },
      { id: 'live', status: 'in_progress', scheduled_for: '2026-10-12T10:00:00.000Z' },
      { id: 'next', status: 'scheduled', scheduled_for: '2026-10-13T10:00:00.000Z' },
    ]);
    expect(featuredSession(rows, '2026-10-12')?.id).toBe('live');
    expect(rows.filter((row) => row.id === 'live')).toHaveLength(1);
  });

  it('features the earliest upcoming scheduled session when none is active', () => {
    const featured = featuredSession(
      [
        { id: 'later', status: 'scheduled', scheduled_for: '2026-10-20T10:00:00.000Z' },
        { id: 'soon', status: 'scheduled', scheduled_for: '2026-10-13T10:00:00.000Z' },
        { id: 'old', status: 'completed', scheduled_for: '2026-10-01T10:00:00.000Z' },
      ],
      '2026-10-12',
    );
    expect(featured?.id).toBe('soon');
  });
});
