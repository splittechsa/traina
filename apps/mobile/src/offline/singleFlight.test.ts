import { expect, it, vi } from 'vitest';
import { singleFlight, type Flight } from './singleFlight';
it('lets finish join the current sync instead of reporting unsaved while it runs', async () => {
  let resolve!: (value: boolean) => void;
  const operation = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
  const slot: { current: Flight<boolean> | null } = { current: null };
  const background = singleFlight(slot, 'owned-workout', operation);
  const finish = singleFlight(slot, 'owned-workout', operation);
  expect(finish).toBe(background); await Promise.resolve(); expect(operation).toHaveBeenCalledTimes(1);
  resolve(true); expect(await finish).toBe(true); expect(slot.current).toBeNull();
});
it('does not share a job across accounts or let old cleanup discard a new job', async () => {
  let resolveA!: () => void, resolveB!: () => void;
  const slot: { current: Flight<void> | null } = { current: null };
  const a = singleFlight(slot, 'account-a', () => new Promise<void>(done => { resolveA = done; }));
  const b = singleFlight(slot, 'account-b', () => new Promise<void>(done => { resolveB = done; }));
  await Promise.resolve(); resolveA(); await a; expect(slot.current?.promise).toBe(b);
  resolveB(); await b; expect(slot.current).toBeNull();
});
it('releases a failed job for a later retry', async () => {
  const slot: { current: Flight<boolean> | null } = { current: null };
  await expect(singleFlight(slot, 'owned-workout', async () => { throw Error('offline'); })).rejects.toThrow('offline');
  expect(await singleFlight(slot, 'owned-workout', async () => true)).toBe(true);
});
