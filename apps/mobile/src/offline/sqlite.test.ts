import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as SQLite from 'expo-sqlite';
import { acknowledgePendingSets, enqueuePendingSet, readPendingSets } from './sqlite';
import type { PendingSetCommand } from './queue';

// Exercise actual SQLite ordering and rollback semantics through the Expo adapter.
vi.mock('expo-sqlite', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const native = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { native.exec(sql); },
    runAsync: async (sql: string, ...params: (string | number)[]) => native.prepare(sql).run(...params),
    getAllAsync: async (sql: string) => native.prepare(sql).all(),
    withExclusiveTransactionAsync: async (task: (tx: unknown) => Promise<void>) => {
      native.exec('BEGIN');
      try { await task(db); native.exec('COMMIT'); }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    },
  };
  return { openDatabaseAsync: async () => db };
});

function command(id: string, kind: 'log' | 'replace' = 'log'): PendingSetCommand {
  return { clientEventId: id, sessionId: 'session-1', kind, set: {
    id: 'set-1', exerciseId: 'exercise-1', setIndex: 1, reps: 8, loadGrams: 10000,
    rpeTenths: null, completedAt: '2026-10-20T12:00:00.000Z',
  } };
}

beforeEach(async () => {
  await readPendingSets();
  const db = await SQLite.openDatabaseAsync('test');
  await db.execAsync('DROP TRIGGER IF EXISTS reject_ack; DELETE FROM pending_sets');
});

describe('durable SQLite queue', () => {
  it('preserves insertion order when edit UUID sorts before create UUID', async () => {
    await enqueuePendingSet(command('z-create'));
    await enqueuePendingSet(command('a-replace', 'replace'));
    expect((await readPendingSets()).map(item => item.clientEventId)).toEqual(['z-create', 'a-replace']);
  });

  it('does not remove work appended after a sync snapshot or duplicate replayed enqueues', async () => {
    const first = command('first');
    await enqueuePendingSet(first);
    const snapshot = await readPendingSets();
    await enqueuePendingSet(command('new'));
    await enqueuePendingSet(command('new'));
    await acknowledgePendingSets(snapshot, []);
    expect((await readPendingSets()).map(item => item.clientEventId)).toEqual(['new']);
  });

  it('keeps unresolved conflicts when another command succeeds', async () => {
    const conflict = command('conflict');
    await enqueuePendingSet(conflict);
    await enqueuePendingSet(command('success'));
    await acknowledgePendingSets(await readPendingSets(), [conflict]);
    expect(await readPendingSets()).toEqual([conflict]);
  });

  it('rolls back all acknowledgements if storage fails partway through and remains usable', async () => {
    await enqueuePendingSet(command('first'));
    await enqueuePendingSet(command('second'));
    const snapshot = await readPendingSets();
    const db = await SQLite.openDatabaseAsync('test');
    await db.execAsync(`CREATE TRIGGER reject_ack BEFORE DELETE ON pending_sets WHEN OLD.id = 'second'
      BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END`);
    await expect(acknowledgePendingSets(snapshot, [])).rejects.toThrow('simulated storage failure');
    expect(await readPendingSets()).toEqual(snapshot);
  });
});
