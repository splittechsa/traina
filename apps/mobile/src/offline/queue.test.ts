import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@sahhti/domain';
import { planOfflineSync, synchronizeOfflineSets } from './queue';

const set = {
  id: '20000000-0000-4000-8000-000000000010',
  exerciseId: '10000000-0000-4000-8000-000000000001',
  setIndex: 1,
  reps: 5,
  loadGrams: 100000,
  rpeTenths: 80,
  completedAt: '2026-06-01T15:10:00.000Z',
};

function session(status: WorkoutSession['status'], sets: WorkoutSession['sets'] = []): WorkoutSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    name: 'Lower strength',
    discipline: 'powerlifting',
    status,
    plannedExercises: [],
    sets,
    scheduledFor: '2026-06-01T15:00:00.000Z',
    startedAt: status === 'scheduled' ? null : '2026-06-01T15:05:00.000Z',
    completedAt: status === 'completed' ? '2026-06-01T15:30:00.000Z' : null,
    pauses: [],
  };
}

describe('offline set queue', () => {
  it('queues a set against an in-progress session', () => {
    const plan = planOfflineSync(session('in_progress'), [{ clientEventId: 'evt-1', sessionId: 'session-1', set }]);
    expect(plan.send).toHaveLength(1);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.session.sets).toHaveLength(1);
  });

  it('does not rewrite a completed session', () => {
    const server = session('completed');
    const plan = planOfflineSync(server, [{ clientEventId: 'evt-1', sessionId: 'session-1', set }]);
    expect(plan.send).toHaveLength(0);
    expect(plan.conflicts).toEqual([{ clientEventId: 'evt-1', reason: 'terminal_session' }]);
    expect(plan.session).toBe(server);
  });

  it('treats an identical set as a replay and a different payload as a conflict', () => {
    const server = session('in_progress', [set]);
    const replay = planOfflineSync(server, [{ clientEventId: 'evt-1', sessionId: 'session-1', set }]);
    expect(replay.send).toHaveLength(0);
    expect(replay.conflicts).toHaveLength(0);
    const changed = planOfflineSync(server, [
      { clientEventId: 'evt-2', sessionId: 'session-1', set: { ...set, reps: 4 } },
    ]);
    expect(changed.conflicts).toEqual([{ clientEventId: 'evt-2', reason: 'payload_conflict' }]);
    expect(changed.session.sets[0]?.reps).toBe(5);
  });

  it('queues offline replaces, replays identical edits, and conflicts on terminal sessions', () => {
    const server = session('in_progress', [set]);
    const edited = planOfflineSync(server, [
      { clientEventId: 'evt-edit', sessionId: 'session-1', kind: 'replace', set: { ...set, reps: 6, loadGrams: 105_000 } },
    ]);
    expect(edited.send).toHaveLength(1);
    expect(edited.send[0]?.kind).toBe('replace');
    expect(edited.session.sets[0]?.reps).toBe(6);

    const replay = planOfflineSync(server, [
      { clientEventId: 'evt-same', sessionId: 'session-1', kind: 'replace', set },
    ]);
    expect(replay.send).toHaveLength(0);
    expect(replay.conflicts).toHaveLength(0);

    const done = session('completed', [set]);
    const blocked = planOfflineSync(done, [
      { clientEventId: 'evt-late', sessionId: 'session-1', kind: 'replace', set: { ...set, reps: 7 } },
    ]);
    expect(blocked.send).toHaveLength(0);
    expect(blocked.conflicts[0]?.reason).toBe('terminal_session');
  });

  it('applies log then replace in order without duplicating the set id', () => {
    const plan = planOfflineSync(session('in_progress'), [
      { clientEventId: 'evt-1', sessionId: 'session-1', kind: 'log', set },
      { clientEventId: 'evt-2', sessionId: 'session-1', kind: 'replace', set: { ...set, reps: 8 } },
    ]);
    expect(plan.send).toHaveLength(2);
    expect(plan.session.sets).toHaveLength(1);
    expect(plan.session.sets[0]?.reps).toBe(8);
  });
});


describe('durable offline synchronization', () => {
  const create = { clientEventId: 'create', sessionId: 'session-1', kind: 'log' as const, set };
  const replace = { clientEventId: 'replace', sessionId: 'session-1', kind: 'replace' as const, set: { ...set, reps: 8 } };

  it('retains an unacknowledged create and its dependent edit after a failed write', async () => {
    const sent: string[] = [];
    const result = await synchronizeOfflineSets(session('in_progress'), [create, replace], async command => {
      sent.push(command.clientEventId);
      throw new Error('network lost after send');
    });
    expect(sent).toEqual(['create']);
    expect(result.remaining).toEqual([create, replace]);
  });

  it('keeps terminal-session conflicts instead of silently deleting logged work', async () => {
    let sent = false;
    const result = await synchronizeOfflineSets(session('completed'), [create], async () => { sent = true; });
    expect(sent).toBe(false);
    expect(result.hasConflicts).toBe(true);
    expect(result.remaining).toEqual([create]);
  });

  it('uses confirmed server replay to recover a lost response without duplicating a set', async () => {
    const sent: string[] = [];
    const result = await synchronizeOfflineSets(session('in_progress', [set]), [create, replace], async command => {
      sent.push(command.clientEventId);
    });
    expect(sent).toEqual(['replace']);
    expect(result.remaining).toEqual([]);
  });

  it('keeps rejected writes and commands for other sessions', async () => {
    const other = { ...create, clientEventId: 'other', sessionId: 'session-2' };
    const result = await synchronizeOfflineSets(session('in_progress'), [create, other], async () => {
      throw new Error('409 payload conflict');
    });
    expect(result.remaining).toEqual([other, create]);
  });

});
