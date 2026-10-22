import { expect, it, vi } from 'vitest';
import type { WorkoutSession } from '@sahhti/domain';
import { saveDurableSet, refreshWorkoutDependents } from './saveFeedback';
import type { PendingSetCommand } from '../offline/queue';
const set = { id: 'set-a', exerciseId: 'exercise-a', setIndex: 1, reps: 8, loadGrams: 20000, rpeTenths: null, completedAt: '2026-10-21T00:01:00Z' };
const command: PendingSetCommand = { clientEventId: 'event-a', sessionId: 'session-a', set };
const workout = (sets: WorkoutSession['sets'] = []): WorkoutSession => ({ id: 'session-a', userId: 'synthetic', name: 'Synthetic', discipline: 'powerlifting', status: 'in_progress', plannedExercises: [], sets, scheduledFor: '2026-10-21T00:00:00Z', startedAt: '2026-10-21T00:00:00Z', completedAt: null, pauses: [] });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { resolve, promise }; };
it('publishes only after durability and releases input even if draft cleanup and network never finish', async () => {
  const disk = deferred(), background = deferred(), publish = vi.fn();
  const task = saveDurableSet(command, { persist: () => disk.promise, current: () => workout(), isCurrentAccount: () => true, publish, clearDraft: () => background.promise, synchronize: () => background.promise, backgroundError: vi.fn() });
  await Promise.resolve(); expect(publish).not.toHaveBeenCalled();
  disk.resolve(); await task;
  expect(publish.mock.calls[0]?.[0].sets).toEqual([set]);
});
it('retains cache updates that arrive while a durable write is pending', async () => {
  const disk = deferred(), publish = vi.fn(); let current = workout();
  const task = saveDurableSet(command, { persist: () => disk.promise, current: () => current, isCurrentAccount: () => true, publish, clearDraft: async () => {}, synchronize: async () => {}, backgroundError: vi.fn() });
  const previous = { ...set, id: 'previous', setIndex: 2 }; current = workout([previous]);
  disk.resolve(); await task; expect(publish.mock.calls[0]?.[0].sets).toEqual([previous, set]);
});
it('does not announce a failed write or publish into a switched account', async () => {
  for (const failedWrite of [true, false]) {
    const publish = vi.fn(), clearDraft = vi.fn(async () => {}), synchronize = vi.fn(async () => {});
    await expect(saveDurableSet(command, { persist: async () => { if (failedWrite) throw Error('disk full'); }, current: () => workout(), isCurrentAccount: () => false, publish, clearDraft, synchronize, backgroundError: vi.fn() })).rejects.toThrow(failedWrite ? 'disk full' : 'Account changed');
    expect(publish).not.toHaveBeenCalled(); expect(clearDraft).not.toHaveBeenCalled(); expect(synchronize).not.toHaveBeenCalled();
  }
});
it('does not hold completion for dependent network refreshes or leak refresh failures', async () => {
  const pending = deferred(), refresh = vi.fn((key: string) => key === 'home' ? Promise.reject(Error('offline')) : pending.promise);
  expect(refreshWorkoutDependents(refresh)).toBeUndefined();
  await Promise.resolve(); await Promise.resolve();
  expect(refresh.mock.calls.map(([key]) => key)).toEqual(['sessions', 'home', 'progress']);
});
