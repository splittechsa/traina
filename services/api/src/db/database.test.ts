import { describe, expect, it, vi } from 'vitest';
import {
  assertNoPgliteFallback,
  databaseTlsMode,
  driverConnectionString,
  isRetryableDatabaseError,
  migrationConnectionString,
  openConfiguredDatabase,
  pingDatabase,
  postgresTransport,
  sanitizeDatabaseError,
  type Database,
} from './database.js';

function fakeDatabase(query: Database['query']): Database {
  return {
    query,
    exec: async () => undefined,
    transaction: async (fn) => fn(fakeDatabase(query)),
    close: async () => undefined,
  };
}

describe('postgres tls', () => {
  it('requires tls only when the connection string asks for it', () => {
    expect(databaseTlsMode('postgres://sahhti@db/sahhti?sslmode=require')).toBe('required');
    expect(databaseTlsMode('postgres://sahhti@127.0.0.1:5432/sahhti')).toBe('plain');
  });
});

describe('database selection', () => {
  it('uses postgres and ignores pglite when a url is configured', () => {
    expect(assertNoPgliteFallback({ databaseUrl: 'postgres://sahhti@db/sahhti?sslmode=require', pgliteDir: '.data/pglite' })).toBe('postgres');
  });

  it('refuses pglite in production and a postgres url without tls', () => {
    expect(() => assertNoPgliteFallback({ pgliteDir: '.data/pglite', nodeEnv: 'production' })).toThrow('PGlite cannot be the production database');
    expect(() => assertNoPgliteFallback({ databaseUrl: 'postgres://sahhti@db/sahhti', nodeEnv: 'production' })).toThrow('sslmode=require');
  });

  it('prefers the direct url for migrations', () => {
    expect(migrationConnectionString({ DATABASE_URL: 'postgres://pooled', DATABASE_URL_UNPOOLED: 'postgres://direct' })).toBe('postgres://direct');
    expect(() => migrationConnectionString({})).toThrow('DATABASE_NOT_CONFIGURED');
  });

  it('does not open pglite when postgres is configured and the connection fails', async () => {
    const pglite = vi.fn();
    const postgres = vi.fn(() => fakeDatabase(async () => {
      throw Object.assign(new Error('password authentication failed'), { code: '28P01' });
    }));
    await expect(
      openConfiguredDatabase(
        { databaseUrl: 'postgres://pooled?sslmode=require', migrationUrl: 'postgres://direct?sslmode=require', pgliteDir: '.data/pglite' },
        { postgres, pglite },
      ),
    ).rejects.toThrow('password authentication failed');
    expect(pglite).not.toHaveBeenCalled();
    expect(postgres).toHaveBeenCalledTimes(1);
  });

  it('migrates through the direct url and serves the pooled url', async () => {
    const opened: string[] = [];
    const closed: string[] = [];
    const postgres = (url: string): Database => {
      opened.push(url);
      return {
        query: async () => ({ rows: [{ ok: 1 }], rowCount: 1 }),
        exec: async () => undefined,
        transaction: async (fn) => fn(postgres(url)),
        close: async () => {
          closed.push(url);
        },
      };
    };
    const migrated: string[] = [];
    const result = await openConfiguredDatabase(
      { databaseUrl: 'postgres://pooled?sslmode=require', migrationUrl: 'postgres://direct?sslmode=require' },
      { postgres, pglite: async () => fakeDatabase(async () => ({ rows: [], rowCount: 0 })), migrate: async () => { migrated.push(opened[0] ?? ''); } },
    );
    expect(migrated).toEqual(['postgres://direct?sslmode=require']);
    expect(closed).toEqual(['postgres://direct?sslmode=require']);
    expect(result.kind).toBe('postgres');
    expect(opened).toEqual(['postgres://direct?sslmode=require', 'postgres://pooled?sslmode=require']);
  });
});

describe('database ping', () => {
  it('retries a transient failure and then succeeds', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const db = fakeDatabase(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('connection terminated'), { code: 'ECONNRESET' });
      return { rows: [{ ok: 1 }], rowCount: 1 };
    });
    await pingDatabase(db, { attempts: 5, sleep: async (ms) => { sleeps.push(ms); } });
    expect(calls).toBe(3);
    expect(sleeps).toEqual([200, 400]);
  });

  it('does not retry an authentication failure', async () => {
    let calls = 0;
    const db = fakeDatabase(async () => {
      calls += 1;
      throw Object.assign(new Error('password authentication failed'), { code: '28P01' });
    });
    await expect(pingDatabase(db, { attempts: 5, sleep: async () => undefined })).rejects.toThrow('password authentication failed');
    expect(calls).toBe(1);
    expect(isRetryableDatabaseError(Object.assign(new Error('starting up'), { code: '57P03' }))).toBe(true);
  });

  it('uses a secure websocket for Neon and keeps tls required', () => {
    const input = 'postgres://user:secret@ep-example.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require';
    expect(postgresTransport(input)).toBe('websocket');
    expect(postgresTransport('postgres://sahhti@127.0.0.1:5432/sahhti')).toBe('tcp');
    const url = new URL(driverConnectionString(input));
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.has('channel_binding')).toBe(false);
    expect(url.password).toBe('secret');
  });

  it('redacts connection strings from logged errors', () => {
    expect(sanitizeDatabaseError(new Error('failed postgres://user:secret@ep.neon.tech/neondb?sslmode=require'))).toBe('failed postgres://[redacted]');
  });
});
