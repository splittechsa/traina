import { describe, expect, it } from 'vitest';
import { calculateCommissionPosting } from '@sahhti/domain';
import { signDevToken } from './auth.js';
import { buildApp } from './app.js';
import { insertLedgerStatement } from './ledger-sql.js';
import { applyMigrations } from './migrate.js';

const secret = 'test-secret-value';

function app() {
  return buildApp({ authMode: 'hmac_dev', devTokenSecret: secret });
}

function memberToken(): string {
  return signDevToken(secret, {
    sub: 'user-1',
    roles: ['member'],
    gymOrganizationIds: [],
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

describe('api', () => {
  it('stays live and not ready', async () => {
    const server = buildApp({ authMode: 'unconfigured' });
    const health = await server.inject({ method: 'GET', url: '/v1/health' });
    const ready = await server.inject({ method: 'GET', url: '/v1/ready' });
    const meta = await server.inject({ method: 'GET', url: '/v1/meta' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ live: true });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({ ready: false });
    expect(meta.json().capabilities.scale.validated).toBe(false);
    await server.close();
  });

  it('fails closed when production auth is not configured', async () => {
    const server = buildApp({ authMode: 'unconfigured' });
    const response = await server.inject({ method: 'POST', url: '/v1/onboarding/validate', payload: {} });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('AUTH_NOT_CONFIGURED');
    expect(response.json().error.message).toBeTruthy();
    await server.close();
  });

  it('explains why sign-in is unavailable', async () => {
    const server = buildApp({ authMode: 'unconfigured' });
    const response = await server.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'member@sahhti.test', password: 'correct-horse' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('AUTH_NOT_CONFIGURED');
    expect(String(response.json().error.message)).toContain('SAHHTI_TOKEN_SECRET');
    await server.close();
  });

  it('validates onboarding without creating an account', async () => {
    const server = app();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/onboarding/validate',
      headers: { authorization: `Bearer ${memberToken()}` },
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
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.persisted).toBe(false);
    expect(body.result.record.authoritativeCalorieTarget).toBeNull();
    expect(body.result.record.heightMm).toBe(1705);
    await server.close();
  });

  it('summarizes a diary and rejects a client target', async () => {
    const server = app();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/nutrition/diary/summarize',
      headers: { authorization: `Bearer ${memberToken()}` },
      payload: {
        entries: [
          { id: 'a', energyKcal: 200, proteinMg: 1000, carbohydrateMg: 2000, fatMg: 3000, source: 'manual' },
          { id: 'b', energyKcal: 50, proteinMg: 0, carbohydrateMg: 0, fatMg: 0, source: 'image_estimate' },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().summary.consumed.energyKcal).toBe(250);
    expect(response.json().summary.consumed.imageEstimateEnergyKcal).toBe(50);
    expect(response.json().target).toBeNull();

    const rejected = await server.inject({
      method: 'POST',
      url: '/v1/nutrition/diary/summarize',
      headers: { authorization: `Bearer ${memberToken()}` },
      payload: { entries: [], target: { energyKcal: 1 } },
    });
    expect(rejected.statusCode).toBe(400);
    await server.close();
  });

  it('quotes a commission without settling it', async () => {
    const server = app();
    const payload = {
      policy: {
        contractId: 'contract-1',
        policyVersion: 3,
        model: 'recurring_revenue',
        rateBps: 2000,
        commissionBase: 'net_of_store_fee_and_tax',
        currency: 'SAR',
      },
      charge: {
        paymentEventId: 'pay-1',
        currency: 'SAR',
        cashCollectedMinor: 11500,
        storeFeeMinor: 1725,
        taxMinor: 1500,
        isRenewal: false,
      },
      gymOrganizationId: 'gym-1',
      attributionId: 'attr-1',
      priorPaymentEventIds: [],
      taxPolicy: { id: 'tax', treatment: 'inclusive', rateBps: 1500, legalReview: 'reviewed' },
    };
    const response = await server.inject({
      method: 'POST',
      url: '/v1/partnerships/commissions/quote',
      headers: { authorization: `Bearer ${memberToken()}` },
      payload,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.persisted).toBe(false);
    expect(body.settlementAllowed).toBe(false);
    expect(body.posting.decision.commissionMinor).toBe(1655);

    const forged = await server.inject({
      method: 'POST',
      url: '/v1/partnerships/commissions/quote',
      headers: { authorization: `Bearer ${memberToken()}` },
      payload: { ...payload, charge: { ...payload.charge, commissionMinor: 1 } },
    });
    expect(forged.statusCode).toBe(400);

    const settle = await server.inject({
      method: 'POST',
      url: '/v1/internal/commissions/settle',
      headers: { authorization: `Bearer ${memberToken()}` },
      payload,
    });
    expect(settle.statusCode).toBe(503);
    expect(settle.json().error.code).toBe('LEDGER_DATABASE_REQUIRED');
    await server.close();
  });

  it('does not verify store purchases', async () => {
    const server = app();
    const response = await server.inject({
      method: 'POST',
      url: '/v1/internal/billing/verify',
      headers: { authorization: `Bearer ${memberToken()}` },
      payload: { receipt: 'client-callback' },
    });
    expect(response.statusCode).toBe(501);
    await server.close();
  });

  it('parameterizes ledger inserts', () => {
    const posting = calculateCommissionPosting({
      purpose: 'quote',
      policy: {
        contractId: 'contract-1',
        policyVersion: 1,
        model: 'recurring_revenue',
        rateBps: 0,
        commissionBase: 'gross',
        currency: 'SAR',
      },
      charge: {
        paymentEventId: 'pay-keep-out-of-sql',
        currency: 'SAR',
        cashCollectedMinor: 100,
        storeFeeMinor: 0,
        taxMinor: 0,
        isRenewal: false,
        verifier: 'test_fixture',
      },
      gymOrganizationId: 'gym-1',
      attributionId: 'attr-1',
      priorPostings: [],
      taxPolicy: { id: 'tax', treatment: 'none', rateBps: 0, legalReview: 'unreviewed' },
      allowTestFixtures: true,
    });
    const statement = insertLedgerStatement(posting.lines);
    expect(statement.text).not.toContain('pay-keep-out-of-sql');
    expect(statement.values).toContain('pay-keep-out-of-sql');
    expect(statement.text).toContain('$1');
  });

  it('refuses to migrate without a database url', async () => {
    await expect(applyMigrations(undefined)).rejects.toThrow('DATABASE_NOT_CONFIGURED');
  });
});
