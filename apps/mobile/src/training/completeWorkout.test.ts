import { expect, it, vi } from 'vitest';
import type { WorkoutSession } from '@sahhti/domain';
import { ApiClientError } from '../api/client';
import { completionTimestamp, finishWithReconciliation } from './completeWorkout';
const completed = { session: { status: 'completed' } as WorkoutSession };
it('reconciles a committed completion after a lost response', async () => {
  const read = vi.fn(async () => completed);
  expect(await finishWithReconciliation(async () => { throw new ApiClientError(0, 'TIMEOUT', 'timeout'); }, read)).toBe(completed);
});
it('retains an ambiguous failure when the server is still active', async () => {
  const failure = new ApiClientError(0, 'OFFLINE', 'offline');
  await expect(finishWithReconciliation(async () => { throw failure; }, async () => ({ session: { status: 'in_progress' } as WorkoutSession }))).rejects.toBe(failure);
});
it('never substitutes a read for authorization or account-change failure', async () => {
  for (const code of ['ACCOUNT_CHANGED', 'FORBIDDEN', 'INVALID_TOKEN']) {
    const read = vi.fn(async () => completed);
    await expect(finishWithReconciliation(async () => { throw new ApiClientError(403, code, 'denied'); }, read)).rejects.toThrow('denied');
    expect(read).not.toHaveBeenCalled();
  }
});
it('uses a confirmed response without an extra read', async () => {
  const read = vi.fn(async () => completed);
  expect(await finishWithReconciliation(async () => completed, read)).toBe(completed);
  expect(read).not.toHaveBeenCalled();
});

it('does not send completion before server-known start or pause events when the device clock lags', () => {
  const start = '2026-10-21T00:00:02.000Z', resume = '2026-10-21T00:01:00.000Z';
  expect(completionTimestamp({ startedAt: start, pauses: [] }, Date.parse(start) - 2000)).toBe(start);
  expect(completionTimestamp({ startedAt: start, pauses: [{ pausedAt: start, resumedAt: resume }] }, Date.parse(start))).toBe(resume);
});
