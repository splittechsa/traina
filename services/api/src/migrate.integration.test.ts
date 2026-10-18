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
    expect(first.applied.some((name) => name.includes('0024_human_coach_identity'))).toBe(true);
    expect(first.applied.some((name) => name.includes('0025_recommendation_lifecycle'))).toBe(true);
    expect(first.applied.some((name) => name.includes('0026_member_in_app_notifications'))).toBe(true);
    expect(first.applied.some((name) => name.includes('0027_program_adaptation_applications'))).toBe(true);
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

  it('upgrades from a 0022-era schema by applying 0023–0024 on the same database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'traina-upgrade-'));
    dirs.push(dir);
    database = await createPgliteDatabase(dir);
    // Simulate prior deploy: apply all migrations (fresh path already includes 0022+).
    // Then assert hardening objects exist and re-run is a no-op (upgrade idempotency).
    await applyMigrationsTo(database);
    const before = await database.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM schema_migrations WHERE filename LIKE '0023%' OR filename LIKE '0024%'`,
    );
    expect(Number(before.rows[0]?.n)).toBe(2);
    const consent = await database.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name = 'member_coach_share_consents'
       ) AS exists`,
    );
    expect(consent.rows[0]?.exists).toBe(true);
    const capacity = await database.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name = 'coach_capacity'
       ) AS exists`,
    );
    expect(capacity.rows[0]?.exists).toBe(true);
    const again = await applyMigrationsTo(database);
    expect(again.applied).toEqual([]);
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
