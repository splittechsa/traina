import * as SQLite from 'expo-sqlite';
import type { PendingSetCommand } from './queue';

const DATABASE = 'sahhti-offline.db';

async function database() {
  const db = await SQLite.openDatabaseAsync(DATABASE);
  await db.execAsync('CREATE TABLE IF NOT EXISTS pending_sets (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
  return db;
}

export async function readPendingSets(): Promise<PendingSetCommand[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ body: string }>('SELECT body FROM pending_sets ORDER BY id');
  return rows.map((row) => JSON.parse(row.body) as PendingSetCommand);
}

export async function writePendingSets(commands: readonly PendingSetCommand[]): Promise<void> {
  const db = await database();
  await db.execAsync('DELETE FROM pending_sets');
  for (const command of commands) {
    await db.runAsync('INSERT INTO pending_sets (id, body) VALUES (?, ?)', command.clientEventId, JSON.stringify(command));
  }
}
