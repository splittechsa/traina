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
  return {
    token: login.json().accessToken as string,
    userId: (await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${login.json().accessToken}` } })).json()
      .userId as string,
  };
}

async function prepareTrainingRec(app: ReturnType<typeof buildApp>, auth: { authorization: string }) {
  const activated = await app.inject({
    method: 'POST',
    url: '/v1/training/programs',
    headers: auth,
    payload: { templateId: 'gym_full_body' },
  });
  expect(activated.statusCode).toBe(200);
  const programId = activated.json().program.id as string;

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
  return { programId, trainingId: training!.id, all: generated.json().recommendations as { id: string; category: string; status: string }[] };
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

  it('applies training rec atomically, updates workout sets, and stays idempotent under concurrency', async () => {
    database = await createPgliteDatabase();
    await applyMigrationsTo(database);
    app = buildApp({
      authMode: 'session',
      database,
      tokenSecret: 'test-secret-program-adapt',
      mailbox: 'outbox',
      coachProvider: 'development_mock',
    });

    const { token } = await register(app, 'adapt.member@sahhti.test');
    const auth = { authorization: `Bearer ${token}` };
    const { programId, trainingId, all } = await prepareTrainingRec(app, auth);

    const preview = await app.inject({
      method: 'GET',
      url: `/v1/member/recommendations/${trainingId}/preview-apply`,
      headers: auth,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().diff.after.programVersion).toBe(2);
    expect(preview.json().previewOnly).toBe(true);

    const confirm = await app.inject({
      method: 'POST',
      url: `/v1/member/recommendations/${trainingId}/advance`,
      headers: auth,
      payload: { status: 'APPROVED' },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().recommendation.status).toBe('APPROVED');

    const [first, second, third] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/member/recommendations/${trainingId}/advance`,
        headers: auth,
        payload: { status: 'APPLIED' },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/member/recommendations/${trainingId}/advance`,
        headers: auth,
        payload: { status: 'APPLIED' },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/member/recommendations/${trainingId}/advance`,
        headers: auth,
        payload: { status: 'APPLIED' },
      }),
    ]);
    for (const response of [first, second, third]) {
      expect(response.statusCode).toBe(200);
      expect(response.json().applied).toBe(true);
      expect(response.json().programVersion).toBe(2);
    }
    const winners = [first, second, third].filter((row) => row.json().idempotent !== true);
    expect(winners.length).toBe(1);

    const versions = await database.query<{ version: number }>(
      `SELECT version FROM program_versions WHERE program_id = $1 ORDER BY version`,
      [programId],
    );
    expect(versions.rows.map((row) => Number(row.version))).toEqual([1, 2]);
    const audits = await database.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM program_adaptation_applications WHERE recommendation_id = $1`,
      [trainingId],
    );
    expect(Number(audits.rows[0]?.n)).toBe(1);

    const started = await app.inject({
      method: 'POST',
      url: `/v1/training/programs/${programId}/start-day`,
      headers: auth,
      payload: { dayIndex: 0, startNow: true },
    });
    expect(started.statusCode).toBe(200);
    const exercises = started.json().session.plannedExercises as { prescription: { kind: string; sets?: number } }[];
    expect(Array.isArray(exercises)).toBe(true);
    const strength = exercises.find((row) => row.prescription.kind === 'strength');
    expect(strength?.prescription.sets).toBe(2);
    const linked = await database.query<{ version: number }>(
      `SELECT pv.version
       FROM workout_sessions ws
       JOIN program_versions pv ON pv.id = ws.program_version_id
       WHERE ws.id = $1`,
      [started.json().session.id],
    );
    expect(Number(linked.rows[0]?.version)).toBe(2);

    // Stale expectedProgramVersion after apply must fail for a new recovery draft stamped at v1.
    const stale = await app.inject({
      method: 'POST',
      url: `/v1/member/recommendations/generate`,
      headers: auth,
    });
    const nextTraining = (stale.json().recommendations as { id: string; category: string; status: string; payload?: { expectedProgramVersion?: number } }[]).find(
      (row) => row.category === 'training' && row.status === 'MEMBER_CONFIRMATION_REQUIRED',
    );
    if (nextTraining !== undefined) {
      await app.inject({
        method: 'POST',
        url: `/v1/member/recommendations/${nextTraining.id}/advance`,
        headers: auth,
        payload: { status: 'APPROVED' },
      });
      // Force stale stamp
      await database.query(
        `UPDATE coaching_recommendations
         SET payload = jsonb_set(payload, '{expectedProgramVersion}', '1'::jsonb)
         WHERE id = $1`,
        [nextTraining.id],
      );
      const blockedStale = await app.inject({
        method: 'POST',
        url: `/v1/member/recommendations/${nextTraining.id}/advance`,
        headers: auth,
        payload: { status: 'APPLIED' },
      });
      expect(blockedStale.statusCode).toBeGreaterThanOrEqual(400);
    }

    // Unauthorized / cross-user
    const other = await register(app, 'adapt.other@sahhti.test');
    const stolen = await app.inject({
      method: 'POST',
      url: `/v1/member/recommendations/${trainingId}/advance`,
      headers: { authorization: `Bearer ${other.token}` },
      payload: { status: 'APPLIED' },
    });
    expect(stolen.statusCode).toBe(404);

    // Nutrition cannot be applied (ENERGY_POLICY)
    const nutrition = all.find((row) => row.category === 'nutrition');
    if (nutrition !== undefined) {
      await database.query(
        `UPDATE coaching_recommendations SET status = 'APPROVED' WHERE id = $1`,
        [nutrition.id],
      );
      const blocked = await app.inject({
        method: 'POST',
        url: `/v1/member/recommendations/${nutrition.id}/advance`,
        headers: auth,
        payload: { status: 'APPLIED' },
      });
      expect(blocked.statusCode).toBeGreaterThanOrEqual(400);
      const code = blocked.json().error?.code as string | undefined;
      expect(['ENERGY_POLICY_UNAPPROVED', 'POLICY_BLOCKED', 'USE_PROGRAM_APPLY', 'NOT_TRAINING_ADAPTATION'].includes(code ?? '')).toBe(
        true,
      );
    }

    const nutritionProgram = await app.inject({
      method: 'POST',
      url: '/v1/training/programs/nutrition',
      headers: auth,
      payload: { phase: 'cutting', maintenanceKcal: 2500, pace: 'steady' },
    });
    expect(nutritionProgram.statusCode).toBeGreaterThanOrEqual(400);
    expect(nutritionProgram.json().error.code).toBe('ENERGY_POLICY_UNAPPROVED');
  }, 180_000);
});
