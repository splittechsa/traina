import type { WorkoutSession } from '@sahhti/domain';
import { ApiClientError } from '../api/client';

type Result = { session: WorkoutSession };
/** A lost response must not turn an already committed completion into a failed workout. */
export async function finishWithReconciliation(post: () => Promise<Result>, read: () => Promise<Result>): Promise<Result> {
  try { return await post(); }
  catch (error) {
    if (!(error instanceof ApiClientError) || !['TIMEOUT', 'OFFLINE', 'INVALID_SESSION_STATE'].includes(error.code)) throw error;
    const current = await read().catch(() => null);
    if (current?.session.status === 'completed') return current;
    throw error;
  }
}

/** The device clock can lag the server's known session events. */
export function completionTimestamp(session: Pick<WorkoutSession, 'startedAt' | 'pauses'>, now: number): string {
  const known = [session.startedAt, ...session.pauses.flatMap(pause => [pause.pausedAt, pause.resumedAt])].filter((value): value is string => value !== null).map(Date.parse).filter(Number.isFinite);
  return new Date(Math.max(now, ...known)).toISOString();
}
