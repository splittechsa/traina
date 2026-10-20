import * as SQLite from 'expo-sqlite';
import type { PendingSetCommand } from './queue';

const DATABASE = 'sahhti-offline.db';
let operations: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.then(() => undefined, () => undefined);
  return result;
}

async function database() {
  const db = await SQLite.openDatabaseAsync(DATABASE);
  await db.execAsync('CREATE TABLE IF NOT EXISTS pending_sets (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
  return db;
}

export function readPendingSets(): Promise<PendingSetCommand[]> {
  return serialize(async () => {
    const db = await database();
    // UUID order is random; rowid preserves create-before-replace insertion order.
    const rows = await db.getAllAsync<{ body: string }>('SELECT body FROM pending_sets ORDER BY rowid');
    return rows.map(row => JSON.parse(row.body) as PendingSetCommand);
  });
}

export function enqueuePendingSet(command: PendingSetCommand): Promise<void> {
  return serialize(async () => {
    const db = await database();
    await db.runAsync('INSERT INTO pending_sets (id, body) VALUES (?, ?) ON CONFLICT (id) DO NOTHING',
      command.clientEventId, JSON.stringify(command));
  });
}

export function acknowledgePendingSets(
  snapshot: readonly PendingSetCommand[],
  remaining: readonly PendingSetCommand[],
): Promise<void> {
  return serialize(async () => {
    const unresolved = new Set(remaining.map(command => command.clientEventId));
    const confirmed = snapshot.filter(command => !unresolved.has(command.clientEventId));
    if (confirmed.length === 0) return;
    const db = await database();
    await db.withExclusiveTransactionAsync(async tx => {
      // Delete only confirmed commands; newly appended work and conflicts survive.
      for (const command of confirmed) {
        await tx.runAsync('DELETE FROM pending_sets WHERE id = ?', command.clientEventId);
      }
    });
  });
}
