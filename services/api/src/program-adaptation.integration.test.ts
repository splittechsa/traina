import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgliteDatabase, type Database } from './db/database.js';

async function register(app: ReturnType<typeof buildApp>, email: string) {
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password: 'correct-horse', locale: 'en' },
  });
  const box = await app.inject({ method: 'GET', url: `/v1/dev/mailbox?email=${encodeURIComponent(email)}&include=code` });
  await app.inject({
    method: 'POST',
    url: '/v1/auth/verify',
    payload: { email, code: box.json().code },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: 'correct-horse' },
  });
  return login.json().accessToken as string;
}

describe('program adaptation apply loop', () => {
  let database: Database | null = null;
  let app: ReturnType<typeof buildApp> | null = null;

  afterEach(async () => {
    if (app) await app.close();
    app = null;
    if (database) await database.close();
    database = null;
  });

  it('applies a training recommendation only after a real program version bump and is idempotent', async () => {
    database = await createPgliteDatabase();
    await applyMigrationsTo(database);
    app = buildApp({
      authMode: 'session',
      database,
      tokenSecret: 'test-secret-program-adapt',
      mailbox: 'outbox',
      coachProvider: 'development_mock',
    });

    const token = await register(app, 'adapt.member@sahhti.test');
    const auth = { authorization: `Bearer ${token}` };

    const activated = await app.inject({
      method: 'POST',
      url: '/v1/training/programs',
      headers: auth,
      payload: { templateId: 'gym_full_body' },
    });
    expect(activated.statusCode).toBe(200);

    // Seed adherence so a training recovery candidate is likely; force generate then pick training row.
    await app.inject({
      method: 'POST',
      url: '/v1/water',
      headers: auth,
      payload: { milliliters: 300, loggedOn: '2026-10-13' },
    });

    const generated = await app.inject({
      method: 'POST',
      url: '/v1/member/recommendations/generate',
      headers: auth,
    });
    expect(generated.statusCode).toBe(200);
    const training = (generated.json().recommendations as { id: string; category: string; status: string }[]).find(
      (row) => row.category === 'training' && row.status === 'MEMBER_CONFIRMATION_REQUIRED',
    );
    expect(training).toBeDefined();

    const preview = await app.inject({
      method: 'GET',
      url: `/v1/member/recommendations/${training!.id}/preview-apply`,
      headers: auth,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().diff.after.programVersion).toBe(2);
    expect(preview.json().previewOnly).toBe(true);

    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/member/recommendations/${training!.id}/advance`,
      headers: auth,
      payload: { status: 'APPROVED' },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().recommendation.status).toBe('APPROVED');

    const applied = await app.inject({
      method: 'POST',
      url: `/v1/member/recommendations/${training!.id}/advance`,
      headers: auth,
      payload: { status: 'APPLIED' },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().applied).toBe(true);
    expect(applied.json().programVersion).toBe(2);
    expect(applied.json().recommendation.status).toBe('APPLIED');
    expect(applied.json().diff.after.sampleDayExercises[0].sets).toBeLessThan(
      applied.json().diff.before.sampleDayExercises[0].sets,
    );

    const again = await app.inject({
      method: 'POST',
      url: `/v1/member/recommendations/${training!.id}/advance`,
      headers: auth,
      payload: { status: 'APPLIED' },
    });
    expect(again.statusCode).toBe(200);
    expect(again.json().idempotent).toBe(true);
    expect(again.json().programVersion).toBe(2);

    const versions = await database.query<{ version: number }>(
      `SELECT version FROM program_versions ORDER BY version`,
    );
    expect(versions.rows.map((row) => Number(row.version))).toEqual([1, 2]);

    // Nutrition must still fail apply via ENERGY_POLICY when present.
    const nutrition = (generated.json().recommendations as { id: string; category: string; status: string }[]).find(
      (row) => row.category === 'nutrition',
    );
    if (nutrition !== undefined) {
      const blocked = await app.inject({
        method: 'POST',
        url: `/v1/member/recommendations/${nutrition.id}/advance`,
        headers: auth,
        payload: { status: 'APPLIED' },
      });
      expect(blocked.statusCode).toBeGreaterThanOrEqual(400);
    }
  }, 120_000);
});
