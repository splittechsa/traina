import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculateCommissionPosting } from '@sahhti/domain';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgliteDatabase, seedDevelopment, type Database } from './db/database.js';
import { insertLedgerStatement } from './ledger-sql.js';
import { insertLedgerLines } from './member/store.js';

const secret = 'session-secret-value';
const exerciseId = '10000000-0000-4000-8000-000000000001';

describe('persisted product', () => {
  let dir = '';
  let database: Database;
  let app: FastifyInstance;
  let accessToken = '';
  let secondToken = '';
  let sessionId = '';

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sahhti-'));
    database = await createPgliteDatabase(dir);
    await applyMigrationsTo(database);
    await seedDevelopment(database, 'development');
    app = buildApp({
      authMode: 'session',
      database,
      tokenSecret: secret,
      mailbox: 'outbox',
      coachProvider: 'development_mock',
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  async function tokenFor(email: string): Promise<string> {
    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password: 'correct-horse', locale: 'ar' },
    });
    expect(register.statusCode).toBe(201);
    const mailbox = await database.query<{ body: string }>(
      `SELECT body FROM email_outbox WHERE recipient = $1 AND purpose = 'verify' ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify',
      payload: { email, code: mailbox.rows[0]?.body },
    });
    expect(verify.statusCode).toBe(200);
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'correct-horse' },
    });
    expect(login.statusCode).toBe(200);
    return login.json().accessToken as string;
  }

  it('refuses development seeds without an explicit confirmation', async () => {
    await expect(seedDevelopment(database, 'production')).rejects.toThrow('SEED_REFUSED');
  });

  it('registers, verifies, and keeps the profile after the database is reopened', async () => {
    const pending = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'nobody@sahhti.test', password: 'correct-horse' },
    });
    expect(pending.statusCode).toBe(401);

    accessToken = await tokenFor('member@sahhti.test');
    const onboard = await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        ageYears: 29,
        heightCm: '170.5',
        weightKg: '70.25',
        trainingExperience: 'intermediate',
        goals: ['strength'],
        discipline: 'powerlifting',
        sessionsPerWeek: 4,
        environment: 'gym',
        equipment: ['barbell'],
        activityLevel: 'moderate',
        dietaryPreferences: [],
        allergies: [],
        supplements: [],
        injuries: [],
        preferredWorkoutTimes: ['evening'],
        hasGymMembership: true,
        locale: 'ar',
        userReportedCalorieTarget: 1400,
      },
    });
    expect(onboard.statusCode).toBe(200);
    expect(onboard.json().persisted).toBe(true);
    expect(onboard.json().record.authoritativeCalorieTarget).toBeNull();
    expect(onboard.json().record.riskFlags).toContain('self_reported_calorie_target_ignored');
    const sameDay = '2026-10-12';
    const firstWeight = await app.inject({
      method: 'POST',
      url: '/v1/weight',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { weightKg: '80', recordedOn: sameDay },
    });
    const secondWeight = await app.inject({
      method: 'POST',
      url: '/v1/weight',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { weightKg: '80', recordedOn: sameDay },
    });
    expect(firstWeight.statusCode).toBe(200);
    expect(secondWeight.statusCode).toBe(200);
    expect(firstWeight.json().id).not.toBe(secondWeight.json().id);
    const progress = await app.inject({
      method: 'GET',
      url: '/v1/progress',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const weights = progress.json().weights as { id: string; recorded_on: string; weight_grams: number }[];
    const pair = weights.filter((row) => row.id === firstWeight.json().id || row.id === secondWeight.json().id);
    expect(pair).toHaveLength(2);
    expect(String(pair[0]?.recorded_on).slice(0, 10)).toBe(sameDay);
    expect(String(pair[1]?.recorded_on).slice(0, 10)).toBe(sameDay);
    expect(Number(pair[0]?.weight_grams)).toBe(80_000);
    expect(Number(pair[1]?.weight_grams)).toBe(80_000);
    expect(new Set(weights.map((row) => row.id)).size).toBe(weights.length);
    await app.inject({
      method: 'PATCH',
      url: '/v1/profile',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { displayName: 'نورة' },
    });

    await app.close();
    await database.close();
    database = await createPgliteDatabase(dir);
    app = buildApp({
      authMode: 'session',
      database,
      tokenSecret: secret,
      mailbox: 'outbox',
      coachProvider: 'development_mock',
    });
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${accessToken}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().profile.display_name).toBe('نورة');
    expect(me.json().profile.height_mm).toBe(1705);
  });

  it('logs a workout from sets and a food diary that another member cannot read', async () => {
    const scheduled = await app.inject({
      method: 'POST',
      url: '/v1/training/sessions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Lower strength',
        discipline: 'powerlifting',
        scheduledFor: '2026-06-01T15:00:00.000Z',
        exercises: [
          {
            exerciseId,
            prescription: { kind: 'strength', sets: 3, reps: 5, restSeconds: 180, loadGrams: 100000, rpeTenths: 80 },
          },
        ],
      },
    });
    expect(scheduled.statusCode).toBe(200);
    sessionId = scheduled.json().session.id as string;
    const started = await app.inject({
      method: 'POST',
      url: `/v1/training/sessions/${sessionId}/start`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { at: '2026-06-01T15:05:00.000Z' },
    });
    expect(started.statusCode).toBe(200);
    const logged = await app.inject({
      method: 'POST',
      url: `/v1/training/sessions/${sessionId}/sets`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        id: '20000000-0000-4000-8000-000000000010',
        exerciseId,
        setIndex: 1,
        reps: 5,
        loadGrams: 100000,
        rpeTenths: 80,
        completedAt: '2026-06-01T15:10:00.000Z',
      },
    });
    expect(logged.statusCode).toBe(200);
    const completed = await app.inject({
      method: 'POST',
      url: `/v1/training/sessions/${sessionId}/complete`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { at: '2026-06-01T15:30:00.000Z' },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().session.status).toBe('completed');

    const food = await app.inject({
      method: 'POST',
      url: '/v1/nutrition/entries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { loggedOn: '2026-06-01', energyKcal: 200, proteinMg: 1000, carbohydrateMg: 2000, fatMg: 3000, source: 'manual' },
    });
    const food2 = await app.inject({
      method: 'POST',
      url: '/v1/nutrition/entries',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { loggedOn: '2026-06-01', energyKcal: 50, proteinMg: 0, carbohydrateMg: 0, fatMg: 0, source: 'image_estimate' },
    });
    expect(food2.statusCode).toBe(200);
    expect(food2.json().summary.consumed.energyKcal).toBe(250);
    expect(food2.json().summary.consumed.imageEstimateEnergyKcal).toBe(50);
    expect(food2.json().target).toBeNull();
    expect(food.statusCode).toBe(200);

    secondToken = await tokenFor('other@sahhti.test');
    const hidden = await app.inject({
      method: 'GET',
      url: `/v1/training/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(hidden.statusCode).toBe(404);
    const ownDiary = await app.inject({
      method: 'GET',
      url: '/v1/nutrition/diary?on=2026-06-01',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(ownDiary.json().summary.consumed.energyKcal).toBe(0);
  });

  it('reports progress history: per-session top sets, personal records, and empty-history safety', async () => {
    // Dynamic, "now"-relative timestamps rather than fixed calendar dates: progressFor's new
    // queries bound completed sessions to the last 120 days, so a hardcoded historical date
    // would make this test's pass/fail depend on how long ago it happens to run relative to
    // that window (exactly the kind of fragility that bit the 2026-06-01 fixture dates used
    // elsewhere in this file once enough real time had passed).
    const daysAgo = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const progressToken = await tokenFor('progress@sahhti.test');
    const onboard = await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: { authorization: `Bearer ${progressToken}` },
      payload: {
        ageYears: 31,
        heightCm: '165',
        weightKg: '62',
        trainingExperience: 'beginner',
        goals: ['strength'],
        discipline: 'powerlifting',
        sessionsPerWeek: 3,
        environment: 'gym',
        equipment: ['barbell'],
        activityLevel: 'moderate',
        dietaryPreferences: [],
        allergies: [],
        supplements: [],
        injuries: [],
        preferredWorkoutTimes: ['evening'],
        hasGymMembership: true,
        locale: 'ar',
      },
    });
    expect(onboard.statusCode).toBe(200);

    // Empty-history safety: right after onboarding, no workout has ever been scheduled or
    // completed. The only non-empty field should be `weights` (onboarding itself records one).
    const empty = await app.inject({
      method: 'GET',
      url: '/v1/progress',
      headers: { authorization: `Bearer ${progressToken}` },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().completedWorkouts).toBe(0);
    expect(empty.json().completedSessionDates).toEqual([]);
    expect(empty.json().exerciseSets).toEqual([]);
    expect(empty.json().personalRecords).toEqual([]);

    async function completedSession(scheduledFor: string, sets: { loadGrams: number; reps: number }[]): Promise<void> {
      const scheduled = await app.inject({
        method: 'POST',
        url: '/v1/training/sessions',
        headers: { authorization: `Bearer ${progressToken}` },
        payload: {
          name: 'Progress check session',
          discipline: 'powerlifting',
          scheduledFor,
          exercises: [
            { exerciseId, prescription: { kind: 'strength', sets: sets.length, reps: 5, restSeconds: 90, loadGrams: 50000, rpeTenths: null } },
          ],
        },
      });
      expect(scheduled.statusCode).toBe(200);
      const thisSessionId = scheduled.json().session.id as string;
      const startedAt = scheduledFor;
      const started = await app.inject({
        method: 'POST',
        url: `/v1/training/sessions/${thisSessionId}/start`,
        headers: { authorization: `Bearer ${progressToken}` },
        payload: { at: startedAt },
      });
      expect(started.statusCode).toBe(200);
      for (const [index, set] of sets.entries()) {
        const logged = await app.inject({
          method: 'POST',
          url: `/v1/training/sessions/${thisSessionId}/sets`,
          headers: { authorization: `Bearer ${progressToken}` },
          payload: {
            id: randomUUID(),
            exerciseId,
            setIndex: index + 1,
            reps: set.reps,
            loadGrams: set.loadGrams,
            rpeTenths: null,
            completedAt: startedAt,
          },
        });
        expect(logged.statusCode).toBe(200);
      }
      const completed = await app.inject({
        method: 'POST',
        url: `/v1/training/sessions/${thisSessionId}/complete`,
        headers: { authorization: `Bearer ${progressToken}` },
        payload: { at: startedAt },
      });
      expect(completed.statusCode).toBe(200);
    }

    // Session A, 10 days ago: two sets at different loads. Only the heavier one should survive
    // into exerciseSets (DISTINCT ON ... ORDER BY load_grams DESC, reps DESC picks one row per
    // session per exercise), proving this isn't just "the first set logged".
    await completedSession(daysAgo(10), [
      { loadGrams: 40_000, reps: 8 },
      { loadGrams: 60_000, reps: 5 },
    ]);
    // Session B, 3 days ago: a single, heavier set — this becomes the new personal record.
    await completedSession(daysAgo(3), [{ loadGrams: 70_000, reps: 3 }]);

    const progress = await app.inject({
      method: 'GET',
      url: '/v1/progress',
      headers: { authorization: `Bearer ${progressToken}` },
    });
    expect(progress.statusCode).toBe(200);
    const body = progress.json() as {
      completedWorkouts: number;
      completedSessionDates: string[];
      exerciseSets: { exercise_id: string; date: string; load_grams: number; reps: number }[];
      personalRecords: { exercise_id: string; load_grams: number; reps: number }[];
    };
    expect(body.completedWorkouts).toBe(2);
    expect(body.completedSessionDates).toHaveLength(2);

    const forExercise = body.exerciseSets.filter((row) => row.exercise_id === exerciseId);
    expect(forExercise).toHaveLength(2);
    expect(Number(forExercise[0]?.load_grams)).toBe(60_000); // best set of session A, not the first-logged 40,000
    expect(Number(forExercise[1]?.load_grams)).toBe(70_000); // session B's single set

    const records = body.personalRecords.filter((row) => row.exercise_id === exerciseId);
    expect(records).toHaveLength(1); // personal_records keeps exactly one current-best row per exercise
    expect(Number(records[0]?.load_grams)).toBe(70_000); // the heaviest set across both sessions

    // The exercise id on both the progression rows and the personal record is the same id the
    // exercise library actually serves, so a mobile client's name lookup (library.find by id)
    // will resolve rather than silently falling back to a generic "Exercise" label.
    const library = await app.inject({
      method: 'GET',
      url: '/v1/exercises',
      headers: { authorization: `Bearer ${progressToken}` },
    });
    const knownIds = new Set((library.json().exercises as { id: string }[]).map((row) => row.id));
    expect(knownIds.has(exerciseId)).toBe(true);
  });

  it('isolates gym tenants and locks the first attribution', async () => {
    const gymA = '30000000-0000-4000-8000-000000000001';
    const gymB = '30000000-0000-4000-8000-000000000002';
    const branch = '30000000-0000-4000-8000-000000000003';
    const contract = '30000000-0000-4000-8000-000000000004';
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${accessToken}` } });
    const userId = me.json().userId as string;
    await database.query(
      `INSERT INTO gym_organizations (id, legal_name, display_name, city, status) VALUES
       ($1, 'Gym A LLC', 'Gym A', 'Riyadh', 'active'),
       ($2, 'Gym B LLC', 'Gym B', 'Jeddah', 'active')`,
      [gymA, gymB],
    );
    await database.query(
      `INSERT INTO gym_branches (id, organization_id, name, city) VALUES ($1, $2, 'Olaya', 'Riyadh')`,
      [branch, gymA],
    );
    await database.query(
      `INSERT INTO gym_contracts (
         id, organization_id, status, commission_model, commission_base, rate_bps, attribution_window_days, currency, policy_version, effective_from
       ) VALUES ($1, $2, 'active', 'first_payment_only', 'net_of_store_fee_and_tax', 2000, 30, 'SAR', 1, '2026-01-01')`,
      [contract, gymA],
    );
    await database.query(
      `INSERT INTO gym_referral_codes (code, organization_id, branch_id, contract_id, status) VALUES ('RIYADH-1', $1, $2, $3, 'active')`,
      [gymA, branch, contract],
    );
    await database.query(
      `INSERT INTO role_assignments (user_id, role, gym_organization_id) VALUES ($1, 'gym_owner', $2)`,
      [userId, gymA],
    );
    const allowed = await app.inject({
      method: 'GET',
      url: `/v1/gyms/${gymA}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const denied = await app.inject({
      method: 'GET',
      url: `/v1/gyms/${gymB}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(allowed.statusCode).toBe(200);
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('TENANT_ISOLATION');
    const first = await app.inject({
      method: 'POST',
      url: '/v1/referrals',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'RIYADH-1' },
    });
    expect(first.json().result).toBe('created');
    const second = await app.inject({
      method: 'POST',
      url: '/v1/referrals',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: 'RIYADH-1' },
    });
    expect(second.json().result).toBe('existing');
  });

  it('answers the coach from the signed-in member only and labels the mock', async () => {
    const answer = await app.inject({
      method: 'POST',
      url: '/v1/coach/messages',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { message: 'What is my workout?' },
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json().productionIntelligence).toBe(false);
    expect(answer.json().provider).toBe('development_mock');
    expect(answer.json().text).toContain('Lower strength');
    const other = await app.inject({
      method: 'POST',
      url: '/v1/coach/messages',
      headers: { authorization: `Bearer ${secondToken}` },
      payload: { message: 'What is my workout?' },
    });
    expect(other.json().text).not.toContain('Lower strength');
    expect(other.json().toolUserId).not.toBe(answer.json().toolUserId);
    const history = await app.inject({
      method: 'GET',
      url: '/v1/coach/messages',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().providerConfigured).toBe(true);
    const ids = (history.json().messages as { id: string }[]).map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
    const hidden = await app.inject({
      method: 'GET',
      url: '/v1/coach/messages',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect((hidden.json().messages as { body: string }[]).some((message) => message.body.includes('Lower strength'))).toBe(false);
  });

  it('does not show another member a private community post', async () => {
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${secondToken}` } });
    await database.query(
      `INSERT INTO community_posts (author_user_id, body, visibility) VALUES ($1, 'ملاحظة خاصة', 'private')`,
      [me.json().userId],
    );
    const own = await app.inject({
      method: 'GET',
      url: '/v1/community/posts',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    const other = await app.inject({
      method: 'GET',
      url: '/v1/community/posts',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().publishing).toBe(true);
    expect(own.json().mediaStorage).toBe(false);
    expect(own.json().posts).toHaveLength(1);
    expect(other.json().posts).toEqual([]);
  });

  it('does not publish an unapproved rule and does not let the author self-approve', async () => {
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${accessToken}` } });
    const reviewer = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${secondToken}` } });
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'coach_reviewer'), ($2, 'coach_reviewer')`, [
      me.json().userId,
      reviewer.json().userId,
    ]);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/coaching/rules',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        ruleKey: 'sessions-flag',
        priority: 10,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        conditions: { type: 'fact', fact: 'sessions_completed', op: 'gte', value: 1 },
        actions: [{ type: 'set_flag', flag: 'showed_up' }],
        safetyBlocks: [],
      },
    });
    expect(created.statusCode).toBe(200);
    const ruleId = created.json().ruleId as string;
    const early = await app.inject({
      method: 'POST',
      url: `/v1/admin/coaching/rules/${ruleId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(early.statusCode).toBe(422);
    await app.inject({
      method: 'POST',
      url: `/v1/admin/coaching/rules/${ruleId}/submit`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const self = await app.inject({
      method: 'POST',
      url: `/v1/admin/coaching/rules/${ruleId}/decide`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { decision: 'approved' },
    });
    expect(self.statusCode).toBe(422);
    const approved = await app.inject({
      method: 'POST',
      url: `/v1/admin/coaching/rules/${ruleId}/decide`,
      headers: { authorization: `Bearer ${secondToken}` },
      payload: { decision: 'approved' },
    });
    expect(approved.statusCode).toBe(200);
    const published = await app.inject({
      method: 'POST',
      url: `/v1/admin/coaching/rules/${ruleId}/publish`,
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(published.statusCode).toBe(200);
    const simulation = await app.inject({
      method: 'POST',
      url: '/v1/admin/coaching/simulate',
      headers: { authorization: `Bearer ${secondToken}` },
      payload: { asOf: '2026-06-02T00:00:00.000Z', facts: { sessions_completed: 2 } },
    });
    expect(simulation.json().persistedPlan).toBe(false);
    const plans = await database.query(`SELECT COUNT(*)::text AS count FROM user_plan_versions`);
    expect(plans.rows[0]).toMatchObject({ count: '0' });
  });

  it('keeps the ledger immutable and refuses client settlement', async () => {
    const gym = '30000000-0000-4000-8000-000000000001';
    const contract = '30000000-0000-4000-8000-000000000004';
    const attribution = await database.query<{ id: string }>(`SELECT id FROM gym_attributions LIMIT 1`);
    const posting = calculateCommissionPosting({
      purpose: 'settle',
      policy: {
        contractId: contract,
        policyVersion: 1,
        model: 'recurring_revenue',
        rateBps: 2000,
        commissionBase: 'net_of_store_fee_and_tax',
        currency: 'SAR',
      },
      charge: {
        paymentEventId: 'pay-db-1',
        currency: 'SAR',
        cashCollectedMinor: 11500,
        storeFeeMinor: 1725,
        taxMinor: 1500,
        isRenewal: false,
        verifier: 'app_store_server_notification',
      },
      gymOrganizationId: gym,
      attributionId: String(attribution.rows[0]?.id),
      priorPostings: [],
      taxPolicy: { id: 'test-vat-not-a-legal-determination', treatment: 'inclusive', rateBps: 1500, legalReview: 'reviewed' },
      allowTestFixtures: false,
    });
    expect(posting.decision.settlementAllowed).toBe(true);
    const statement = insertLedgerStatement(posting.lines);
    await insertLedgerLines(database, statement.text, statement.values);
    await expect(
      database.query(`UPDATE financial_ledger_entries SET amount_minor = 0 WHERE payment_event_id = 'pay-db-1'`),
    ).rejects.toThrow(/append-only/);
    const settle = await app.inject({
      method: 'POST',
      url: '/v1/internal/commissions/settle',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(settle.statusCode).toBe(503);
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/internal/billing/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { receipt: 'client' },
    });
    expect(verify.statusCode).toBe(501);
  });

  it('scales a member-entered food, hides it from another member, and deletes the diary row', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/nutrition/foods',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { nameAr: 'شوفان العضو', nameEn: 'Member oats', energyKcal: 200, proteinMg: 10_000, carbohydrateMg: 40_000, fatMg: 4_000 },
    });
    expect(created.statusCode).toBe(200);
    const foodId = created.json().id as string;
    const hidden = await app.inject({
      method: 'GET',
      url: '/v1/nutrition/foods?q=oats',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(hidden.json().foods).toEqual([]);
    expect(hidden.json().referenceDatabase).toBe(false);
    const logged = await app.inject({
      method: 'POST',
      url: '/v1/nutrition/portions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { foodItemId: foodId, quantityGrams: 50, loggedOn: '2026-06-02' },
    });
    expect(logged.statusCode).toBe(200);
    const entry = (logged.json().entries as { id: string; energyKcal: number; label: string }[]).find((item) => item.label?.includes('شوفان'));
    expect(entry?.energyKcal).toBe(100);
    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/nutrition/entries/${entry?.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(removed.statusCode).toBe(200);
    expect((removed.json().entries as { id: string }[]).some((item) => item.id === entry?.id)).toBe(false);
  });

  it('pauses and resumes an owned workout', async () => {
    const scheduled = await app.inject({
      method: 'POST',
      url: '/v1/training/sessions',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: 'Pause check',
        discipline: 'general_fitness',
        scheduledFor: '2026-06-03T15:00:00.000Z',
        exercises: [{ exerciseId, prescription: { kind: 'strength', sets: 1, reps: 5, restSeconds: 60, loadGrams: 20000, rpeTenths: null } }],
      },
    });
    const id = scheduled.json().session.id as string;
    const started = await app.inject({
      method: 'POST',
      url: `/v1/training/sessions/${id}/start`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { at: '2026-06-03T15:01:00.000Z' },
    });
    expect(started.statusCode).toBe(200);
    const paused = await app.inject({
      method: 'POST',
      url: `/v1/training/sessions/${id}/pause`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { at: '2026-06-03T15:02:00.000Z' },
    });
    expect(paused.json().session.status).toBe('paused');
    const resumed = await app.inject({
      method: 'POST',
      url: `/v1/training/sessions/${id}/resume`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { at: '2026-06-03T15:03:00.000Z' },
    });
    expect(resumed.json().session.status).toBe('in_progress');
  });

  it('lets members comment and support a shared post, and hides it after a block', async () => {
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${accessToken}` } });
    const other = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${secondToken}` } });
    const post = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { body: 'تمرين اليوم تم', visibility: 'members' },
    });
    expect(post.statusCode).toBe(200);
    const postId = post.json().id as string;
    const comment = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${secondToken}` },
      payload: { body: 'استمر' },
    });
    expect(comment.statusCode).toBe(200);
    const support = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/support`,
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(support.json().supported).toBe(true);
    const feed = await app.inject({
      method: 'GET',
      url: '/v1/community/posts',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect((feed.json().posts as { id: string }[]).some((item) => item.id === postId)).toBe(true);
    const blocked = await app.inject({
      method: 'POST',
      url: `/v1/community/blocks/${me.json().userId}`,
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect(blocked.statusCode).toBe(200);
    const after = await app.inject({
      method: 'GET',
      url: '/v1/community/posts',
      headers: { authorization: `Bearer ${secondToken}` },
    });
    expect((after.json().posts as { id: string }[]).some((item) => item.id === postId)).toBe(false);
    expect(other.json().userId).not.toBe(me.json().userId);
  });
});
