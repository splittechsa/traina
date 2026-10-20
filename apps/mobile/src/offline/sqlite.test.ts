import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as SQLite from 'expo-sqlite';
import { acknowledgePendingSets, enqueuePendingSet, readPendingSets, readAccountSnapshot, writeAccountSnapshot, replaceConflictingSet } from './sqlite';
import type { PendingSetCommand } from './queue';

// Exercise actual SQLite ordering and rollback semantics through the Expo adapter.
vi.mock('expo-sqlite', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const path = join(mkdtempSync(join(tmpdir(), 'traina-account-offline-')), 'offline.db');
  let native = new DatabaseSync(path);
  const db = {
    execAsync: async (sql: string) => { native.exec(sql); },
    runAsync: async (sql: string, ...params: (string | number)[]) => native.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: (string | number)[]) => native.prepare(sql).all(...params),
    withExclusiveTransactionAsync: async (task: (tx: unknown) => Promise<void>) => {
      native.exec('BEGIN');
      try { await task(db); native.exec('COMMIT'); }
      catch (error) { native.exec('ROLLBACK'); throw error; }
    },
  };
  return { openDatabaseAsync: async () => db, __restart: () => { native.close(); native = new DatabaseSync(path); } };
});

function command(id: string, kind: 'log' | 'replace' = 'log'): PendingSetCommand {
  return { clientEventId: id, sessionId: 'session-1', kind, set: {
    id: 'set-1', exerciseId: 'exercise-1', setIndex: 1, reps: 8, loadGrams: 10000,
    rpeTenths: null, completedAt: '2026-10-20T12:00:00.000Z',
  } };
}

beforeEach(async () => {
  await readPendingSets('https://test|account-a');
  const db = await SQLite.openDatabaseAsync('test');
  await db.execAsync('DROP TRIGGER IF EXISTS reject_ack; DELETE FROM pending_sets_scoped; DELETE FROM account_snapshots');
});

describe('durable SQLite queue', () => {
  it('isolates queues, snapshots and acknowledgements across two accounts and cold reads', async () => {
    const a = 'https://test|account-a', b = 'https://test|account-b';
    const first = command('same-event');
    await enqueuePendingSet(a, first);
    await enqueuePendingSet(b, { ...first, sessionId: 'session-b' });
    await writeAccountSnapshot(a, 'workout', { id: 'workout-a', reps: 8 });
    await writeAccountSnapshot(b, 'workout', { id: 'workout-b', reps: 12 });
    (SQLite as unknown as { __restart: () => void }).__restart();
    expect(await readAccountSnapshot(a, 'workout')).toEqual({ id: 'workout-a', reps: 8 });
    expect(await readAccountSnapshot(b, 'workout')).toEqual({ id: 'workout-b', reps: 12 });
    await acknowledgePendingSets(a, await readPendingSets(a), []);
    expect(await readPendingSets(a)).toEqual([]);
    expect((await readPendingSets(b))[0]?.sessionId).toBe('session-b');
    expect(await readAccountSnapshot('https://different-api|account-a', 'workout')).toBeNull();
    expect(() => readPendingSets('')).toThrow('OFFLINE_ACCOUNT_UNVERIFIED');
  });
  it('atomically replaces a conflicting chain and refuses a stale resolution choice', async () => {
    const owner = 'https://test|account-a'; const first = command('first'); const edit = command('edit', 'replace');
    await enqueuePendingSet(owner, first); await enqueuePendingSet(owner, edit);
    await expect(replaceConflictingSet(owner, first, command('replacement', 'replace'))).rejects.toThrow('LOCAL_EDIT_CHANGED');
    expect(await readPendingSets(owner)).toEqual([first, edit]);
    const replacement = command('replacement', 'replace'); await replaceConflictingSet(owner, edit, replacement);
    expect(await readPendingSets(owner)).toEqual([replacement]);
  });

  it('preserves insertion order when edit UUID sorts before create UUID', async () => {
    await enqueuePendingSet('https://test|account-a', command('z-create'));
    await enqueuePendingSet('https://test|account-a', command('a-replace', 'replace'));
    expect((await readPendingSets('https://test|account-a')).map(item => item.clientEventId)).toEqual(['z-create', 'a-replace']);
  });

  it('does not remove work appended after a sync snapshot or duplicate replayed enqueues', async () => {
    const first = command('first');
    await enqueuePendingSet('https://test|account-a', first);
    const snapshot = await readPendingSets('https://test|account-a');
    await enqueuePendingSet('https://test|account-a', command('new'));
    await enqueuePendingSet('https://test|account-a', command('new'));
    await acknowledgePendingSets('https://test|account-a', snapshot, []);
    expect((await readPendingSets('https://test|account-a')).map(item => item.clientEventId)).toEqual(['new']);
  });

  it('keeps unresolved conflicts when another command succeeds', async () => {
    const conflict = command('conflict');
    await enqueuePendingSet('https://test|account-a', conflict);
    await enqueuePendingSet('https://test|account-a', command('success'));
    await acknowledgePendingSets('https://test|account-a', await readPendingSets('https://test|account-a'), [conflict]);
    expect(await readPendingSets('https://test|account-a')).toEqual([conflict]);
  });

  it('rolls back all acknowledgements if storage fails partway through and remains usable', async () => {
    await enqueuePendingSet('https://test|account-a', command('first'));
    await enqueuePendingSet('https://test|account-a', command('second'));
    const snapshot = await readPendingSets('https://test|account-a');
    const db = await SQLite.openDatabaseAsync('test');
    await db.execAsync(`CREATE TRIGGER reject_ack BEFORE DELETE ON pending_sets_scoped WHEN OLD.id = 'second'
      BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END`);
    await expect(acknowledgePendingSets('https://test|account-a', snapshot, [])).rejects.toThrow('simulated storage failure');
    expect(await readPendingSets('https://test|account-a')).toEqual(snapshot);
  });
});
