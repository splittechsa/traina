import { applyOfflineReplace, applyOfflineSet, type WorkoutSession, type WorkoutSet } from '@sahhti/domain';

export type PendingSetCommand = {
  clientEventId: string;
  sessionId: string;
  set: WorkoutSet;
  /** Default `log` for backward-compatible queued creates. */
  kind?: 'log' | 'replace';
};

export type OfflineConflictReason = 'terminal_session' | 'payload_conflict' | 'not_in_progress' | 'set_missing';

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
    const kind = command.kind ?? 'log';
    const resolution = kind === 'replace' ? applyOfflineReplace(session, command.set) : applyOfflineSet(session, command.set);
    if (resolution.disposition === 'applied') {
      session = resolution.session;
      send.push({ ...command, kind });
      continue;
    }
    if (resolution.disposition === 'replay') {
      continue;
    }
    const reason: OfflineConflictReason =
      resolution.serverStatus === 'completed' || resolution.serverStatus === 'abandoned'
        ? 'terminal_session'
        : resolution.command === 'replace_set' && resolution.serverStatus === 'in_progress'
          ? session.sets.some((set) => set.id === command.set.id)
            ? 'payload_conflict'
            : 'set_missing'
          : resolution.serverStatus === 'in_progress'
            ? 'payload_conflict'
            : 'not_in_progress';
    conflicts.push({ clientEventId: command.clientEventId, reason });
  }
  return { send, conflicts, session };
}
