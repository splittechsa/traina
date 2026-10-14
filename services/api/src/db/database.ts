import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';

export type QueryResult<T> = { rows: T[]; rowCount: number };

export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

type PgQueryable = {
  query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
};

function fromPg(client: PgQueryable, release?: () => void): Pick<Database, 'query' | 'exec'> {
  return {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length };
    },
    async exec(sql: string) {
      await client.query(sql);
    },
  };
}

export function databaseTlsMode(connectionString: string): 'required' | 'plain' {
  return /sslmode=(require|verify-full|verify-ca)/i.test(connectionString) ? 'required' : 'plain';
}

const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  '57P01',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '53300',
]);

export function sanitizeDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'database unavailable';
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgres://[redacted]');
}

export function isRetryableDatabaseError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === '28P01' || code === '28000' || code === '3D000') return false;
    if (RETRYABLE_CODES.has(code)) return true;
  }
  const message = error instanceof Error ? error.message : '';
  if (/password authentication failed|does not exist|sslmode|self-signed|certificate/i.test(message)) return false;
  return /timeout|ECONN|terminated|Connection refused|starting up|recovering/i.test(message);
}

export async function pingDatabase(
  db: Database,
  options?: { attempts?: number; sleep?: (ms: number) => Promise<void> },
): Promise<void> {
  const attempts = options?.attempts ?? 5;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await db.query('SELECT 1 AS ok');
      return;
    } catch (error) {
      if (attempt === attempts || !isRetryableDatabaseError(error)) throw error;
      await sleep(200 * attempt);
    }
  }
}

export type DatabaseSelection = {
  databaseUrl?: string | undefined;
  migrationUrl?: string | undefined;
  pgliteDir?: string | undefined;
  nodeEnv?: string | undefined;
};

export function assertNoPgliteFallback(selection: DatabaseSelection): 'postgres' | 'pglite' | 'none' {
  const url = selection.databaseUrl?.trim() ?? '';
  if (url.length > 0) {
    if (selection.nodeEnv === 'production' && databaseTlsMode(url) !== 'required') {
      throw new Error('Production PostgreSQL requires sslmode=require');
    }
    return 'postgres';
  }
  const dir = selection.pgliteDir?.trim() ?? '';
  if (dir.length > 0) {
    if (selection.nodeEnv === 'production') throw new Error('PGlite cannot be the production database');
    return 'pglite';
  }
  return 'none';
}

export function migrationConnectionString(env: { DATABASE_URL?: string | undefined; DATABASE_URL_UNPOOLED?: string | undefined }): string {
  const direct = env.DATABASE_URL_UNPOOLED?.trim() ?? '';
  if (direct.length > 0) return direct;
  const pooled = env.DATABASE_URL?.trim() ?? '';
  if (pooled.length > 0) return pooled;
  throw new Error('DATABASE_NOT_CONFIGURED');
}

export async function openConfiguredDatabase(
  selection: DatabaseSelection,
  adapters: {
    postgres: (url: string) => Database;
    pglite: (dir: string) => Promise<Database>;
    migrate?: (db: Database) => Promise<unknown>;
    ping?: (db: Database) => Promise<void>;
  },
): Promise<{ database: Database | null; kind: 'postgres' | 'pglite' | 'none' }> {
  const kind = assertNoPgliteFallback(selection);
  const ping = adapters.ping ?? pingDatabase;
  if (kind === 'none') return { database: null, kind };
  if (kind === 'pglite') {
    const database = await adapters.pglite(selection.pgliteDir!.trim());
    if (adapters.migrate) await adapters.migrate(database);
    return { database, kind };
  }
  const pooled = selection.databaseUrl!.trim();
  const direct = selection.migrationUrl?.trim() || pooled;
  const migrator = adapters.postgres(direct);
  try {
    await ping(migrator);
    if (adapters.migrate) await adapters.migrate(migrator);
  } catch (error) {
    await migrator.close();
    throw error;
  }
  if (direct === pooled) return { database: migrator, kind };
  await migrator.close();
  const database = adapters.postgres(pooled);
  try {
    await ping(database);
    return { database, kind };
  } catch (error) {
    await database.close();
    throw error;
  }
}

export function postgresTransport(connectionString: string): 'tcp' | 'websocket' {
  return new URL(connectionString).hostname.endsWith('.neon.tech') ? 'websocket' : 'tcp';
}

export function driverConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  if (url.hostname.endsWith('.neon.tech')) url.searchParams.delete('channel_binding');
  return url.toString();
}

let neonSocketReady = false;

function neonPool(connectionString: string): PgPool {
  if (!neonSocketReady) {
    neonConfig.webSocketConstructor = ws;
    neonConfig.useSecureWebSocket = true;
    neonSocketReady = true;
  }
  return new NeonPool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  });
}

type PgPool = PgQueryable & {
  connect: () => Promise<PgQueryable & { release: () => void }>;
  end: () => Promise<void>;
  on: (event: 'error', listener: (error: unknown) => void) => void;
};

export function createPgDatabase(connectionString: string): Database {
  const tls = databaseTlsMode(connectionString);
  if (process.env.NODE_ENV === 'production' && tls !== 'required') {
    throw new Error('Production PostgreSQL requires sslmode=require');
  }
  const transport = postgresTransport(connectionString);
  const connection = driverConnectionString(connectionString);
  const pool: PgPool =
    transport === 'websocket'
      ? neonPool(connection)
      : new pg.Pool({
          connectionString: connection,
          max: 10,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 15_000,
          allowExitOnIdle: true,
          ssl: tls === 'required' ? { rejectUnauthorized: true } : undefined,
        });
  pool.on('error', (error) => {
    console.error(JSON.stringify({ service: 'sahhti-api', database: 'postgres', error: sanitizeDatabaseError(error) }));
  });
  return {
    ...fromPg(pool),
    async transaction(fn) {
      const client = await pool.connect();
      const tx = fromPg(client);
      const bound: Database = {
        ...tx,
        transaction: (inner) => inner(bound),
        close: async () => undefined,
      };
      try {
        await client.query('BEGIN');
        const result = await fn(bound);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function createPgliteDatabase(dataDir: string): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite');
  const client = new PGlite(dataDir);
  return wrapPglite(client as unknown as PgliteLike);
}

type PgliteLike = {
  query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>;
  exec: (sql: string) => Promise<unknown>;
  transaction: <T>(fn: (tx: PgliteLike) => Promise<T>) => Promise<T>;
  close?: () => Promise<void>;
};

function wrapPglite(client: PgliteLike): Database {
  const database: Database = {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.affectedRows ?? result.rows.length };
    },
    async exec(sql: string) {
      await client.exec(sql);
    },
    async transaction(fn) {
      return client.transaction(async (tx) => fn(wrapPglite(tx)));
    },
    async close() {
      await client.close?.();
    },
  };
  return database;
}

export function migrationsDirectory(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let hop = 0; hop < 8; hop += 1) {
    const candidate = resolve(current, 'database', 'migrations');
    if (existsSync(candidate)) {
      return candidate;
    }
    current = resolve(current, '..');
  }
  throw new Error('MIGRATIONS_NOT_FOUND');
}

export function seedsDirectory(): string {
  return resolve(migrationsDirectory(), '..', 'seeds');
}

export async function applyMigrationsTo(db: Database): Promise<{ applied: string[] }> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const dir = migrationsDirectory();
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    const existing = await db.query('SELECT 1 AS ok FROM schema_migrations WHERE filename = $1', [file]);
    if (existing.rows.length > 0) {
      continue;
    }
    const sql = await readFile(resolve(dir, file), 'utf8');
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    });
    applied.push(file);
  }
  return { applied };
}

export async function seedDevelopment(db: Database, confirm: string): Promise<void> {
  if (confirm !== 'development') {
    throw new Error('SEED_REFUSED');
  }
  const sql = await readFile(resolve(seedsDirectory(), '0001_dev_exercises.sql'), 'utf8');
  await db.exec(sql);
}
