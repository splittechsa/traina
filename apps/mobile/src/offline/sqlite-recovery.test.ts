import { expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const native = new DatabaseSync(':memory:');
  let first = true;
  return { openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => { if (first) { first = false; throw Error('storage temporarily unavailable'); } native.exec(sql); },
    closeAsync: async () => undefined,
    runAsync: async (sql: string, ...params: (string | number)[]) => native.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: (string | number)[]) => native.prepare(sql).all(...params),
  }) };
});

it('recovers from initialization failure and retains later writes across queued callers', async () => {
  const { readAccountSnapshot, writeAccountSnapshot } = await import('./sqlite');
  const owner = 'https://staging|synthetic';
  await expect(readAccountSnapshot(owner, 'draft')).rejects.toThrow('storage temporarily unavailable');
  await Promise.all([writeAccountSnapshot(owner, 'draft', { reps: 8 }), writeAccountSnapshot(owner, 'rest', { endsAt: 100 })]);
  expect(await readAccountSnapshot(owner, 'draft')).toEqual({ reps: 8 });
  expect(await readAccountSnapshot(owner, 'rest')).toEqual({ endsAt: 100 });
});
