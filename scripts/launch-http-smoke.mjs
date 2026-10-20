import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildApp } from '../services/api/dist/app.js';
import { applyMigrationsTo, createPgliteDatabase, seedDevelopment } from '../services/api/dist/db/database.js';

// Deliberately creates a disposable synthetic database; never reads .env or DATABASE_URL.
const dir = await mkdtemp(join(tmpdir(), 'traina-launch-http-'));
const db = await createPgliteDatabase(dir);
const evidence = { at: new Date().toISOString(), transport: 'actual HTTP over loopback', database: 'disposable PGlite',
  productionDataUsed: false, status: 'IN_PROGRESS', steps: [] };
let app;
let origin;
async function request(method, path, body, token, expected = 200) {
  const response = await fetch(origin + path, { method, headers: {
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(token ? { authorization: 'Bearer ' + token } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, expected, method + ' ' + path + ' returned ' + response.status);
  return response.json();
}
async function account(email) {
  const password = 'synthetic-only-' + randomBytes(12).toString('hex');
  await request('POST', '/v1/auth/register', { email, password, locale: 'en' }, undefined, 201);
  const mail = await request('GET', '/v1/dev/mailbox?email=' + encodeURIComponent(email) + '&include=code');
  await request('POST', '/v1/auth/verify', { email, code: mail.code });
  return (await request('POST', '/v1/auth/login', { email, password })).accessToken;
}
try {
  await applyMigrationsTo(db);
  await seedDevelopment(db, 'development');
  app = buildApp({ authMode: 'session', database: db, databaseKind: 'pglite', tokenSecret: randomBytes(32).toString('hex'),
    mailbox: 'outbox', coachProvider: 'development_mock' });
  origin = await app.listen({ port: 0, host: '127.0.0.1' });
  const token = await account('http-member-' + randomUUID() + '@sahhti.test');
  evidence.steps.push({ id: 'register-verify-login', status: 'PASS' });
  await request('POST', '/v1/onboarding', { ageYears: 29, heightCm: '170.5', weightKg: '70.25', sex: 'male',
    trainingExperience: 'intermediate', goals: ['strength'], discipline: 'powerlifting', sessionsPerWeek: 4,
    environment: 'gym', equipment: ['barbell'], activityLevel: 'moderate', dietaryPreferences: [], allergies: [],
    supplements: [], injuries: [], preferredWorkoutTimes: ['evening'], hasGymMembership: true, locale: 'ar' }, token);
  evidence.steps.push({ id: 'onboarding', status: 'PASS' });
  const { program } = await request('POST', '/v1/training/programs', { templateId: 'push_pull_legs' }, token);
  const days = program.days.map(day => ({ name_ar: day.name_ar, name_en: day.name_en, exerciseIds: [...day.exerciseIds].reverse() }));
  days[0].strengthOverrides = { [days[0].exerciseIds[0]]: { sets: 5, reps: 12, restSeconds: 120 } };
    const edited = await request('PUT', '/v1/training/programs/' + program.id, { name: 'Synthetic customized PPL', expectedVersion: 1, days }, token);
  assert.equal(edited.program.version, 2);
  await request('PUT', '/v1/training/programs/' + program.id, { expectedVersion: 1, days }, token, 409);
  evidence.steps.push({ id: 'program-customize-stale-write-rejected', status: 'PASS' });
  const { session } = await request('POST', '/v1/training/programs/' + program.id + '/start-day', { dayIndex: 0, startNow: true }, token);
  assert.equal(session.plannedExercises[0].exerciseId, days[0].exerciseIds[0]);
    assert.equal(session.plannedExercises[0].prescription.sets, 5);
    assert.equal(session.plannedExercises[0].prescription.reps, 12);
    assert.equal(session.plannedExercises[0].prescription.restSeconds, 120);
  const set = { id: randomUUID(), exerciseId: days[0].exerciseIds[0], setIndex: 1, reps: 8, loadGrams: 20000,
    rpeTenths: null, completedAt: new Date().toISOString() };
  await request('POST', '/v1/training/sessions/' + session.id + '/sets', set, token);
  await request('PUT', '/v1/training/sessions/' + session.id + '/sets/' + set.id, { ...set, reps: 9 }, token);
  const logged = await request('GET', '/v1/training/sessions/' + session.id, undefined, token);
  assert.equal(logged.session.sets.length, 1);
  assert.equal(logged.session.sets[0].reps, 9);
  const other = await account('http-other-' + randomUUID() + '@sahhti.test');
  await request('GET', '/v1/training/sessions/' + session.id, undefined, other, 404);
  evidence.steps.push({ id: 'workout-log-edit-and-cross-member-denial', status: 'PASS' });
  await request('POST', '/v1/training/sessions/' + session.id + '/complete', { at: new Date().toISOString() }, token);
  assert.equal((await request('GET', '/v1/training/sessions/' + session.id, undefined, token)).session.status, 'completed');
  evidence.steps.push({ id: 'workout-completion', status: 'PASS' });
  const copy = await request('POST', '/v1/training/programs/' + program.id + '/actions', { action: 'duplicate', expectedVersion: 2, name: 'Synthetic copy' }, token);
  await request('GET', '/v1/training/programs/' + copy.program.id + '/history', undefined, other, 404);
  await request('POST', '/v1/training/programs/' + program.id + '/actions', { action: 'restore', expectedVersion: 2, version: 1 }, token);
  const history = await request('GET', '/v1/training/programs/' + program.id + '/history', undefined, token);
  assert.deepEqual(history.versions.map(row => row.version), [3, 2, 1]);
  assert.equal(history.versions[0].document.restoredFromVersion, 1);
  await request('POST', '/v1/training/programs/' + copy.program.id + '/actions', { action: 'activate', expectedVersion: 1 }, token);
  await request('POST', '/v1/training/programs/' + copy.program.id + '/actions', { action: 'archive', expectedVersion: 1 }, token);
  await request('POST', '/v1/training/programs/' + copy.program.id + '/start-day', { dayIndex: 0 }, token, 404);
  evidence.steps.push({ id: 'program-history-copy-restore-activate-archive-owner-isolation', status: 'PASS' });
  const entitlement = await request('GET', '/v1/member/entitlements', undefined, token);
  assert.equal(entitlement.purchasesEnabled, false);
  assert.equal(entitlement.nutritionAdaptationsBlocked, true);
  await request('DELETE', '/v1/account', undefined, token);
  await request('GET', '/v1/me', undefined, token, 401);
  evidence.steps.push({ id: 'entitlement-safety-gates-delete-revokes-session', status: 'PASS' });
  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'FAILED';
  evidence.failure = error.message;
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  await db.close();
  const output = process.argv[2] ?? 'docs/evidence/launch-2026-10-20/http-smoke.json';
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
}
