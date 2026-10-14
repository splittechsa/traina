import { existsSync, readFileSync } from 'node:fs';
import { createPgDatabase, applyMigrationsTo, migrationConnectionString, sanitizeDatabaseError } from './db/database.js';

export async function applyMigrations(databaseUrl: string | undefined): Promise<{ applied: string[] }> {
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  const database = createPgDatabase(databaseUrl);
  try {
    return await applyMigrationsTo(database);
  } finally {
    await database.close();
  }
}

export { migrationConnectionString };

const isDirectRun = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));

function loadDatabaseEnv(file = '.env'): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== 'DATABASE_URL' && key !== 'DATABASE_URL_UNPOOLED') continue;
    if (process.env[key] !== undefined && process.env[key] !== '') continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value.length > 0) process.env[key] = value;
  }
}

if (isDirectRun) {
  loadDatabaseEnv();
  applyMigrations(migrationConnectionString(process.env))
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error: unknown) => {
      console.error(sanitizeDatabaseError(error));
      process.exitCode = 1;
    });
}
