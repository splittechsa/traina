import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgliteDatabase, type Database } from './db/database.js';

const secret = 'session-secret-value';
const profile = {
  ageYears: 20,
  heightCm: '195',
  weightKg: '100',
  sex: 'male',
  trainingExperience: 'beginner',
  goals: ['cutting'],
  discipline: 'general_fitness',
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
  locale: 'en',
  measurementUnits: 'metric',
};

describe('onboarding completion', () => {
  let dir = '';
  let database: Database;
  let app: FastifyInstance;
  let accessToken = '';

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sahhti-onboarding-'));
    database = await createPgliteDatabase(dir);
    await applyMigrationsTo(database);
    app = buildApp({ authMode: 'session', database, tokenSecret: secret, mailbox: 'outbox', coachProvider: 'unconfigured' });
    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'ahmed@sahhti.test', password: 'correct-horse', locale: 'en' },
    });
    const mailbox = await database.query<{ body: string }>(
      `SELECT body FROM email_outbox WHERE recipient = 'ahmed@sahhti.test' AND purpose = 'verify' ORDER BY created_at DESC LIMIT 1`,
    );
    await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { email: 'ahmed@sahhti.test', code: mailbox.rows[0]?.body } });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ahmed@sahhti.test', password: 'correct-horse' },
    });
    accessToken = login.json().accessToken as string;
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  function auth() {
    return { authorization: `Bearer ${accessToken}` };
  }

  it('keeps a new member incomplete until a valid profile is stored', async () => {
    const before = await app.inject({ method: 'GET', url: '/v1/me', headers: auth() });
    expect(before.json()).toMatchObject({ onboardingCompleted: false, profile: null });
    const rejected = await app.inject({
      method: 'POST',
      url: '/v1/onboarding',
      headers: auth(),
      payload: { ...profile, ageYears: 10 },
    });
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json().error.code).toBe('ONBOARDING_INVALID');
    const still = await app.inject({ method: 'GET', url: '/v1/me', headers: auth() });
    expect(still.json().onboardingCompleted).toBe(false);
  });

  it('rejects onboarding when the session is missing and does not write a profile', async () => {
    const denied = await app.inject({ method: 'POST', url: '/v1/onboarding', payload: profile });
    expect(denied.statusCode).toBe(401);
    const rows = await database.query(`SELECT COUNT(*)::text AS count FROM user_profiles`);
    expect(rows.rows[0]).toMatchObject({ count: '0' });
  });

  it('persists the profile once, then skips setup after restart and a new sign-in', async () => {
    const saved = await app.inject({ method: 'POST', url: '/v1/onboarding', headers: auth(), payload: profile });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ persisted: true, onboardingCompleted: true });
    const again = await app.inject({ method: 'POST', url: '/v1/onboarding', headers: auth(), payload: profile });
    expect(again.statusCode).toBe(200);
    const weights = await database.query(`SELECT COUNT(*)::text AS count FROM weight_records`);
    const profiles = await database.query(`SELECT COUNT(*)::text AS count FROM user_profiles`);
    expect(weights.rows[0]).toMatchObject({ count: '1' });
    expect(profiles.rows[0]).toMatchObject({ count: '1' });
    await app.inject({
      method: 'PATCH',
      url: '/v1/profile',
      headers: auth(),
      payload: { displayName: 'ahmed' },
    });
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: auth() });
    const body = me.json();
    expect(body.onboardingCompleted).toBe(true);
    expect(body.profile.height_mm).toBe(1950);
    expect(body.profile.weight_grams).toBe(100000);
    expect(body.profile.display_name).toBe('ahmed');
    expect(body.goals).toEqual(['cutting']);

    await app.close();
    await database.close();
    database = await createPgliteDatabase(dir);
    app = buildApp({ authMode: 'session', database, tokenSecret: secret, mailbox: 'outbox', coachProvider: 'unconfigured' });
    const reopened = await app.inject({ method: 'GET', url: '/v1/me', headers: auth() });
    expect(reopened.json().onboardingCompleted).toBe(true);
    expect(reopened.json().userId).toBe(body.userId);

    await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: auth() });
    const expired = await app.inject({ method: 'GET', url: '/v1/me', headers: auth() });
    expect(expired.statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ahmed@sahhti.test', password: 'correct-horse' },
    });
    expect(login.statusCode).toBe(200);
    const returned = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${login.json().accessToken}` },
    });
    expect(returned.json().onboardingCompleted).toBe(true);
    expect(returned.json().userId).toBe(body.userId);
  });
});
