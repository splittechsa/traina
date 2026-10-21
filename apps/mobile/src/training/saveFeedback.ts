import type { WorkoutSession } from '@sahhti/domain';
import { ApiClientError } from '../api/client';
import { planOfflineSync, type PendingSetCommand } from '../offline/queue';

type LocalSave = {
  persist: () => Promise<void>;
  current: () => WorkoutSession;
  isCurrentAccount: () => boolean;
  publish: (session: WorkoutSession) => void;
  clearDraft: () => Promise<void>;
  synchronize: () => Promise<unknown>;
  backgroundError: () => void;
};

/** Confirm the durable local write without holding the form for maintenance or network I/O. */
export async function saveDurableSet(command: PendingSetCommand, dependencies: LocalSave): Promise<void> {
  await dependencies.persist();
  if (!dependencies.isCurrentAccount()) throw new ApiClientError(409, 'ACCOUNT_CHANGED', 'Account changed during local save');
  const plan = planOfflineSync(dependencies.current(), [command]);
  if (plan.conflicts.length) throw new ApiClientError(409, 'SET_CONFLICT', 'The workout changed during local save');
  dependencies.publish(plan.session);
  void Promise.resolve().then(dependencies.clearDraft).catch(dependencies.backgroundError);
  void Promise.resolve().then(dependencies.synchronize).catch(dependencies.backgroundError);
}

/** Server-confirmed results are visible before dependent dashboard requests finish. */
export function refreshWorkoutDependents(refresh: (key: string) => Promise<unknown>): void {
  for (const key of ['sessions', 'home', 'progress']) void Promise.resolve().then(() => refresh(key)).catch(() => undefined);
}
