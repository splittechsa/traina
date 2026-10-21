import * as SQLite from 'expo-sqlite';
import type { PendingSetCommand } from './queue';
import { perfMark } from '../performance/lab';

const DATABASE = 'sahhti-offline.db';
let operations: Promise<void> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const queuedAt = performance.now();
  const result = operations.then(async () => {
    perfMark('sqlite.wait', 'serialized queue', performance.now() - queuedAt);
    const started = performance.now();
    try { return await operation(); } finally { perfMark('sqlite.operation', 'serialized operation', performance.now() - started); }
  }); operations = result.then(() => undefined, () => undefined); return result;
}
function requireOwner(owner: string): void { if (!owner || !owner.includes('|')) throw new Error('OFFLINE_ACCOUNT_UNVERIFIED'); }
let connection: Promise<SQLite.SQLiteDatabase> | undefined;
function database(): Promise<SQLite.SQLiteDatabase> {
  if (!connection) {
    connection = (async () => {
      const started = performance.now();
      const db = await SQLite.openDatabaseAsync(DATABASE);
      try {
        // Legacy unscoped rows remain recoverable, never attached to a login.
        await db.execAsync(`CREATE TABLE IF NOT EXISTS pending_sets_scoped (account_id TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (account_id, id));
          CREATE TABLE IF NOT EXISTS account_snapshots (account_id TEXT NOT NULL, key TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (account_id, key));`);
        perfMark('sqlite.open', 'open + schema', performance.now() - started);
        return db;
      } catch (error) { await db.closeAsync().catch(() => undefined); throw error; }
    })().catch(error => { connection = undefined; throw error; });
  }
  return connection;
}
export function readPendingSets(owner: string): Promise<PendingSetCommand[]> {
  requireOwner(owner);
  return serialize(async () => {
    const db = await database();
    const rows = await db.getAllAsync<{ body: string }>('SELECT body FROM pending_sets_scoped WHERE account_id = ? ORDER BY rowid', owner);
    return rows.map(row => JSON.parse(row.body) as PendingSetCommand);
  });
}
export function enqueuePendingSet(owner: string, command: PendingSetCommand): Promise<void> {
  requireOwner(owner);
  return serialize(async () => { const db = await database();
    await db.runAsync('INSERT INTO pending_sets_scoped (account_id, id, body) VALUES (?, ?, ?) ON CONFLICT (account_id, id) DO NOTHING', owner, command.clientEventId, JSON.stringify(command));
  });
}
export function acknowledgePendingSets(owner: string, snapshot: readonly PendingSetCommand[], remaining: readonly PendingSetCommand[]): Promise<void> {
  requireOwner(owner);
  return serialize(async () => {
    const unresolved = new Set(remaining.map(command => command.clientEventId));
    const confirmed = snapshot.filter(command => !unresolved.has(command.clientEventId));
    if (!confirmed.length) return; const db = await database();
    await db.withExclusiveTransactionAsync(async tx => {
      for (const command of confirmed) await tx.runAsync('DELETE FROM pending_sets_scoped WHERE account_id = ? AND id = ?', owner, command.clientEventId);
    });
  });
}
export function readAccountSnapshot<T>(owner: string, key: string): Promise<T | null> {
  requireOwner(owner);
  return serialize(async () => { const db = await database(); const rows = await db.getAllAsync<{ body: string }>('SELECT body FROM account_snapshots WHERE account_id = ? AND key = ?', owner, key);
    return rows[0] ? JSON.parse(rows[0].body) as T : null;
  });
}
export function writeAccountSnapshot(owner: string, key: string, value: unknown): Promise<void> {
  requireOwner(owner);
  return serialize(async () => { const db = await database(); await db.runAsync('INSERT INTO account_snapshots (account_id, key, body) VALUES (?, ?, ?) ON CONFLICT (account_id, key) DO UPDATE SET body = excluded.body', owner, key, JSON.stringify(value)); });
}
export function removeAccountSnapshot(owner: string, key: string): Promise<void> {
  requireOwner(owner);
  return serialize(async () => { const db = await database(); await db.runAsync('DELETE FROM account_snapshots WHERE account_id = ? AND key = ?', owner, key); });
}
/** Replace one conflicting set's command chain atomically, only if the visible local edit is still current. */
export function replaceConflictingSet(owner: string, selected: PendingSetCommand, replacement: PendingSetCommand): Promise<void> {
  requireOwner(owner);
  return serialize(async () => {
    const db = await database();
    await db.withExclusiveTransactionAsync(async tx => {
      const rows = await tx.getAllAsync<{ body: string }>('SELECT body FROM pending_sets_scoped WHERE account_id = ? ORDER BY rowid', owner);
      const chain = rows.map(row => JSON.parse(row.body) as PendingSetCommand).filter(command => command.sessionId === selected.sessionId && command.set.id === selected.set.id);
      if (chain.at(-1)?.clientEventId !== selected.clientEventId) throw new Error('LOCAL_EDIT_CHANGED');
      for (const command of chain) await tx.runAsync('DELETE FROM pending_sets_scoped WHERE account_id = ? AND id = ?', owner, command.clientEventId);
      await tx.runAsync('INSERT INTO pending_sets_scoped (account_id, id, body) VALUES (?, ?, ?)', owner, replacement.clientEventId, JSON.stringify(replacement));
    });
  });
}
