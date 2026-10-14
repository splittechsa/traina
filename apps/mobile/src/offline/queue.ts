import { applyOfflineSet, type WorkoutSession, type WorkoutSet } from '@sahhti/domain';

export type PendingSetCommand = {
  clientEventId: string;
  sessionId: string;
  set: WorkoutSet;
};

export type OfflineConflictReason = 'terminal_session' | 'payload_conflict' | 'not_in_progress';

export type OfflineSyncPlan = {
  send: PendingSetCommand[];
  conflicts: { clientEventId: string; reason: OfflineConflictReason }[];
  session: WorkoutSession;
};

export function planOfflineSync(server: WorkoutSession, pending: readonly PendingSetCommand[]): OfflineSyncPlan {
  let session = server;
  const send: PendingSetCommand[] = [];
  const conflicts: OfflineSyncPlan['conflicts'] = [];
  for (const command of pending) {
    if (command.sessionId !== server.id) {
      continue;
    }
    const resolution = applyOfflineSet(session, command.set);
    if (resolution.disposition === 'applied') {
      session = resolution.session;
      send.push(command);
      continue;
    }
    if (resolution.disposition === 'replay') {
      continue;
    }
    const reason: OfflineConflictReason =
      resolution.serverStatus === 'completed' || resolution.serverStatus === 'abandoned'
        ? 'terminal_session'
        : resolution.serverStatus === 'in_progress'
          ? 'payload_conflict'
          : 'not_in_progress';
    conflicts.push({ clientEventId: command.clientEventId, reason });
  }
  return { send, conflicts, session };
}
