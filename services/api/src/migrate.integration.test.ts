import { cpSync, mkdtempSync, rmSync } from 'node:fs';
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
    await applyMigrationsTo(database, { through: '0022_human_coach_ops.sql' });
    const before = await database.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM schema_migrations WHERE filename LIKE '0023%' OR filename LIKE '0024%'`,
    );
    expect(Number(before.rows[0]?.n)).toBe(0);
    const upgraded = await applyMigrationsTo(database, { through: '0024_human_coach_identity.sql' });
    expect(upgraded.applied).toEqual(['0023_coach_ops_hardening.sql', '0024_human_coach_identity.sql']);
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
    const again = await applyMigrationsTo(database, { through: '0024_human_coach_identity.sql' });
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

  async function legacyFixture(dir: string) {
    database = await createPgliteDatabase(dir);
    await applyMigrationsTo(database, { through: '0030_member_push_devices.sql' });
    const userId = '70000000-0000-4000-8000-000000000001';
    const programId = '70000000-0000-4000-8000-000000000002';
    const versionId = '70000000-0000-4000-8000-000000000003';
    await database.query("INSERT INTO users (id, email, status) VALUES ($1, 'synthetic-migration@sahhti.test', 'active')", [userId]);
    await database.query("INSERT INTO programs (id, user_id, name, discipline, template_id) VALUES ($1, $2, 'Existing plan', 'bodybuilding', 'push_pull_legs')", [programId, userId]);
    await database.query("INSERT INTO program_versions (id, program_id, version, source, template) VALUES ($1, $2, 1, 'explicit', $3::jsonb)",
      [versionId, programId, JSON.stringify({ templateId: 'push_pull_legs', days: [] })]);
    await database.query("INSERT INTO program_versions (program_id, version, source, template) VALUES ($1, 2, 'approved_rules', $2::jsonb)",
      [programId, JSON.stringify({ templateId: 'push_pull_legs', days: [], adaptation: null })]);
    await database.query("INSERT INTO workout_sessions (user_id, program_version_id, name, discipline, status, planned_exercises, scheduled_for) VALUES ($1, $2, 'Historical workout', 'bodybuilding', 'completed', '[]', now())", [userId, versionId]);
    return { programId, versionId };
  }

  it('upgrades a populated 0030 database, preserves versions/workouts, and restores its cold backup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'traina-0031-upgrade-'));
    const backup = mkdtempSync(join(tmpdir(), 'traina-0030-backup-'));
    dirs.push(dir, backup);
    const { programId, versionId } = await legacyFixture(dir);
    const before = await database!.query('SELECT id, program_id, version, source, template FROM program_versions ORDER BY version');
    await database!.close(); database = null;
    // The database is closed before copying. This is a synthetic local backup, not a Neon restore drill.
    cpSync(dir, backup, { recursive: true });
    database = await createPgliteDatabase(dir);
    expect((await applyMigrationsTo(database, { through: '0031_program_member_customize.sql' })).applied)
      .toEqual(['0031_program_member_customize.sql']);
    expect((await database.query('SELECT id, program_id, version, source, template FROM program_versions ORDER BY version')).rows).toEqual(before.rows);
    expect((await database.query('SELECT program_version_id FROM workout_sessions')).rows[0]?.program_version_id).toBe(versionId);
    await database.query("INSERT INTO program_versions (program_id, version, source, template) VALUES ($1, 3, 'member_customize', $2::jsonb)", [programId, JSON.stringify({ templateId: 'push_pull_legs', days: [] })]);
    // Narrowing the source check is unsafe once valid member customizations exist; the failed down attempt must roll back.
    await expect(database.transaction(async tx => {
      await tx.exec('ALTER TABLE program_versions DROP CONSTRAINT program_versions_source_check');
      await tx.exec("ALTER TABLE program_versions ADD CONSTRAINT program_versions_source_check CHECK (source IN ('explicit', 'approved_rules'))");
    })).rejects.toThrow();
    expect((await database.query("SELECT version FROM program_versions WHERE source = 'member_customize'")).rows).toHaveLength(1);
    expect((await applyMigrationsTo(database, { through: '0031_program_member_customize.sql' })).applied).toEqual([]);
    await database.close(); database = null;
    database = await createPgliteDatabase(backup);
    expect((await database.query('SELECT id, program_id, version, source, template FROM program_versions ORDER BY version')).rows).toEqual(before.rows);
    const restored = await applyMigrationsTo(database, { through: '0031_program_member_customize.sql' });
    expect(restored.applied).toEqual(['0031_program_member_customize.sql']);
  }, 120_000);

  it('rolls back the 0031 DDL when its ledger write fails and safely retries exactly once', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'traina-0031-failure-')); dirs.push(dir);
    const { programId } = await legacyFixture(dir);
    const underlying = database!;
    const interrupted: Database = { ...underlying, transaction: fn => underlying.transaction(tx => fn({ ...tx,
      async query<T>(sql: string, params: readonly unknown[] = []) {
        if (sql.includes('INSERT INTO schema_migrations') && params[0] === '0031_program_member_customize.sql') throw new Error('simulated ledger failure');
        return tx.query<T>(sql, params);
      },
    })) };
    await expect(applyMigrationsTo(interrupted, { through: '0031_program_member_customize.sql' })).rejects.toThrow('simulated ledger failure');
    expect((await underlying.query("SELECT filename FROM schema_migrations WHERE filename LIKE '0031%'")).rows).toEqual([]);
    await expect(underlying.query("INSERT INTO program_versions (program_id, version, source, template) VALUES ($1, 3, 'member_customize', '{}')", [programId])).rejects.toThrow();
    expect((await applyMigrationsTo(underlying, { through: '0031_program_member_customize.sql' })).applied).toEqual(['0031_program_member_customize.sql']);
    expect((await applyMigrationsTo(underlying, { through: '0031_program_member_customize.sql' })).applied).toEqual([]);
    expect((await underlying.query("SELECT filename FROM schema_migrations WHERE filename LIKE '0031%'")).rows).toHaveLength(1);
  }, 120_000);

});
