import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyMigrationsTo, createPgliteDatabase, type Database } from './db/database.js';

describe('migration apply / recovery (disposable PGlite)', () => {
  const dirs: string[] = [];
  let database: Database | null = null;

  afterEach(async () => {
    if (database !== null) {
      await database.close();
      database = null;
    }
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies migrations including 0021 and is idempotent on re-run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'traina-migrate-'));
    dirs.push(dir);
    database = await createPgliteDatabase(dir);
    const first = await applyMigrationsTo(database);
    expect(first.applied.some((name) => name.includes('0021_coaching_recommendations'))).toBe(true);
    expect(first.applied.some((name) => name.includes('0022_human_coach_ops'))).toBe(true);
    expect(first.applied.some((name) => name.includes('0023_coach_ops_hardening'))).toBe(true);
    const table = await database.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_name = 'coach_assignment_events'
       ) AS exists`,
    );
    expect(table.rows[0]?.exists).toBe(true);

    const second = await applyMigrationsTo(database);
    expect(second.applied).toEqual([]);
    const count = await database.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM schema_migrations WHERE filename LIKE '0021%'`,
    );
    expect(Number(count.rows[0]?.n)).toBe(1);
  }, 120_000);

  it('recovers by re-applying after a fresh disposable database', async () => {
    const dirA = mkdtempSync(join(tmpdir(), 'traina-migrate-a-'));
    const dirB = mkdtempSync(join(tmpdir(), 'traina-migrate-b-'));
    dirs.push(dirA, dirB);
    const dbA = await createPgliteDatabase(dirA);
    await applyMigrationsTo(dbA);
    await dbA.close();

    database = await createPgliteDatabase(dirB);
    const recovered = await applyMigrationsTo(database);
    expect(recovered.applied.some((name) => name.includes('0021'))).toBe(true);
    const water = await database.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name = 'water_logs'
       ) AS exists`,
    );
    expect(water.rows[0]?.exists).toBe(true);
  }, 120_000);
});
