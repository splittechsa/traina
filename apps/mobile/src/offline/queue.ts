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
  const latestBySet = new Map<string, PendingSetCommand>();
  for (const command of pending) {
    if (command.sessionId === server.id) latestBySet.set(command.set.id, command);
  }
  const acknowledgedSets = new Set<string>();
  for (const [setId, command] of latestBySet) {
    const saved = server.sets.find(set => set.id === setId);
    const desired = command.set;
    if (saved !== undefined && saved.exerciseId === desired.exerciseId && saved.setIndex === desired.setIndex &&
        saved.reps === desired.reps && saved.loadGrams === desired.loadGrams &&
        saved.rpeTenths === desired.rpeTenths && Date.parse(saved.completedAt) === Date.parse(desired.completedAt)) {
      // The server already contains the final desired state. A prior acknowledgement may
      // have failed locally after both create and replace succeeded; do not replay the old create.
      acknowledgedSets.add(setId);
    }
  }
  for (const command of pending) {
    if (command.sessionId !== server.id || acknowledgedSets.has(command.set.id)) {
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

/** Keep conflicts and failed writes until the server acknowledges them. */
export async function synchronizeOfflineSets(
  server: WorkoutSession,
  pending: readonly PendingSetCommand[],
  send: (command: PendingSetCommand) => Promise<void>,
): Promise<{ remaining: PendingSetCommand[]; hasConflicts: boolean }> {
  const plan = planOfflineSync(server, pending);
  const conflicts = new Set(plan.conflicts.map(item => item.clientEventId));
  const remaining = pending.filter(item => item.sessionId !== server.id || conflicts.has(item.clientEventId));
  let failed = false;
  for (const command of plan.send) {
    if (failed || conflicts.size > 0) {
      remaining.push(command);
      continue;
    }
    try {
      await send(command);
    } catch {
      // Preserve ordering: later writes may depend on the failed create or edit.
      failed = true;
      remaining.push(command);
    }
  }
  return { remaining, hasConflicts: conflicts.size > 0 };
}
