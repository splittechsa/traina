import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createPgDatabase } from '../services/api/dist/db/database.js';
const origin = process.argv[2];
const dbUrl = process.env.TRAINA_STAGING_OWNER_URL;
if (origin !== 'https://traina-staging-api.vercel.app' || !dbUrl || new URL(dbUrl).pathname !== '/traina_staging' || process.env.TRAINA_STAGING_PROJECT_ID !== 'solitary-pond-59179148') throw new Error('EXPLICIT_ISOLATED_STAGING_REQUIRED');
const db = createPgDatabase(dbUrl, { maxConnections: 2 });
const output = process.argv[3] ?? 'docs/evidence/staging-2026-10-20/public-https-smoke.json';
const run = randomBytes(6).toString('hex');
const evidence = { at: new Date().toISOString(), origin, projectId: process.env.TRAINA_STAGING_PROJECT_ID, syntheticOnly: true, status: 'IN_PROGRESS', calls: [], checks: [] };
async function request(method, path, body, token, expected = 200, headers = {}) {
  const start = Date.now(); const response = await fetch(origin + path, { method, headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
  const contentType = response.headers.get('content-type') ?? ''; const result = contentType.includes('text/event-stream') ? await response.text() : await response.json().catch(() => ({}));
  evidence.calls.push({ method, path, status: response.status, latencyMs: Date.now() - start });
  assert.equal(response.status, expected, method + ' ' + path + ': ' + JSON.stringify(result).slice(0,250)); return result;
}
async function member(label, role) {
  const email = `staging-${run}-${label}@traina.test`, password = randomBytes(24).toString('base64url');
  await request('POST', '/v1/auth/register', { email, password, locale: 'ar' }, null, 201);
  const code = (await db.query("SELECT body FROM email_outbox WHERE recipient = $1 AND purpose = 'verify' ORDER BY created_at DESC LIMIT 1", [email])).rows[0]?.body;
  assert.ok(code); await request('POST', '/v1/auth/verify', { email, code });
  let login = await request('POST', '/v1/auth/login', { email, password });
  const me = await request('GET', '/v1/me', null, login.accessToken);
  if (role) { await db.query('INSERT INTO role_assignments (user_id, role, gym_organization_id) VALUES ($1, $2, NULL)', [me.userId, role]); login = await request('POST', '/v1/auth/login', { email, password }); }
  return { token: login.accessToken, refreshToken: login.refreshToken, userId: me.userId };
}
try {
  assert.equal((await request('GET', '/v1/health')).database, 'postgres');
  const readiness = await request('GET', '/v1/ready', null, null, 503); assert.ok(readiness.missing.includes('store_verifier'));
  await request('GET', '/v1/me', null, null, 401);
  const owner = await member('owner'), other = await member('other');
  await request('POST', '/v1/onboarding', { ageYears: 29, heightCm: '170', weightKg: '70', sex: 'male', trainingExperience: 'intermediate', goals: ['strength'], discipline: 'powerlifting', sessionsPerWeek: 4, environment: 'gym', equipment: ['barbell'], activityLevel: 'moderate', dietaryPreferences: [], allergies: [], supplements: [], injuries: [], preferredWorkoutTimes: ['evening'], hasGymMembership: true, locale: 'ar' }, owner.token);
  evidence.checks.push({ id: 'STG-AUTH-01', status: 'PASS', scope: 'Register, operator-read staging verification code, public verify/login/me/onboarding; no outbound email configured' });
  const original = (await request('POST', '/v1/training/programs', { templateId: 'gym_full_body' }, owner.token)).program;
  const days = original.days.map(day => ({ name_ar: day.name_ar, name_en: day.name_en, exerciseIds: day.exerciseIds }));
  days[0].strengthOverrides = { [days[0].exerciseIds[0]]: { sets: 5, reps: 12, restSeconds: 120 } };
  await request('PUT', '/v1/training/programs/' + original.id, { expectedVersion: 1, name: 'Synthetic HTTPS plan', days }, owner.token);
  await request('GET', '/v1/training/programs/' + original.id + '/history', null, other.token, 404);
  const workout = (await request('POST', '/v1/training/programs/' + original.id + '/start-day', { dayIndex: 0, startNow: true }, owner.token)).session;
  assert.equal(workout.plannedExercises[0].prescription.sets, 5);
  const set = { id: randomUUID(), exerciseId: days[0].exerciseIds[0], setIndex: 1, reps: 8, loadGrams: 20000, rpeTenths: null, completedAt: new Date().toISOString() };
  await Promise.all([request('POST', '/v1/training/sessions/' + workout.id + '/sets', set, owner.token), request('POST', '/v1/training/sessions/' + workout.id + '/sets', set, owner.token)]);
  const edit = { ...set, reps: 9 };
  await request('PUT', '/v1/training/sessions/' + workout.id + '/sets/' + set.id, { ...edit, expectedSet: set }, owner.token);
  await request('PUT', '/v1/training/sessions/' + workout.id + '/sets/' + set.id, { ...set, reps: 10, expectedSet: set }, owner.token, 409);
  const saved = (await request('GET', '/v1/training/sessions/' + workout.id, null, owner.token)).session;
  assert.equal(saved.sets.length, 1); assert.equal(saved.sets[0].reps, 9);
  await request('GET', '/v1/training/sessions/' + workout.id, null, other.token, 404);
  await request('POST', '/v1/training/sessions/' + workout.id + '/complete', { at: new Date().toISOString() }, owner.token);
  assert.equal((await request('GET', '/v1/progress', null, owner.token)).completedWorkouts, 1);
  await request('POST', '/v1/training/programs/' + original.id + '/actions', { action: 'restore', expectedVersion: 2, version: 1 }, owner.token);
  assert.deepEqual((await request('GET', '/v1/training/programs/' + original.id + '/history', null, owner.token)).versions.map(v => v.version), [3,2,1]);
  const copy = (await request('POST', '/v1/training/programs/' + original.id + '/actions', { action: 'duplicate', expectedVersion: 3, name: 'Synthetic copy' }, owner.token)).program;
  await request('POST', '/v1/training/programs/' + copy.id + '/actions', { action: 'activate', expectedVersion: 1 }, owner.token);
  await request('POST', '/v1/training/programs/' + copy.id + '/actions', { action: 'archive', expectedVersion: 1 }, owner.token);
  evidence.checks.push({ id: 'STG-TRAIN-01', status: 'PASS', scope: 'Program customization, prescriptions, concurrent idempotent creates, stale-edit rejection, completed history, restore/copy/activate/archive and cross-account denial over public HTTPS' });
  const admin = await member('synthetic-admin', 'admin'), coach = await member('synthetic-coach', 'coach_reviewer');
  await request('GET', '/v1/coach/workspace/inbox', null, owner.token, 403);
  await request('POST', '/v1/coach/assignments', { coachUserId: coach.userId, memberUserId: owner.userId, reason: 'Synthetic staging endpoint test only' }, admin.token);
  await request('POST', '/v1/member/coach-share-consent', {}, owner.token);
  await request('GET', '/v1/coach/members/' + owner.userId + '/state', null, coach.token);
  await request('GET', '/v1/coach/members/' + other.userId + '/state', null, coach.token, 403);
  const today = new Date(); const day = today.getUTCDay(); today.setUTCDate(today.getUTCDate() + (day === 0 ? -6 : 1-day)); const weekOf = today.toISOString().slice(0,10);
  const review = await request('POST', '/v1/coach/reviews/prepare', { memberUserId: owner.userId, weekOf }, owner.token);
  await request('POST', '/v1/coach/reviews/' + review.review.id + '/claim', {}, coach.token);
  await request('POST', '/v1/coach/reviews/' + review.review.id + '/feedback', { body: 'SYNTHETIC ENDPOINT TEST: logging records are present. This is a software fixture, not professional coaching.' }, coach.token);
  await request('GET', '/v1/member/coach-feedback', null, owner.token);
  evidence.checks.push({ id: 'STG-COACH-01', status: 'PASS', scope: 'Synthetic staff roles, assignment, consent, authorized/denied state, prepare/claim/feedback; no professional review implied' });
  const ai = await request('POST', '/v1/coach/messages', { message: 'هل توجد ملاحظة مسجلة من المدرب؟ اذكر أنها تجريبية إذا كانت كذلك، ولا تخترع تغييرات على خطتي.' }, owner.token);
  assert.equal(ai.provider, 'openai_compatible'); assert.equal(ai.toolUserId, owner.userId); assert.ok(ai.text.length > 0);
  evidence.checks.push({ id: 'STG-AI-01', status: 'REVIEW', scope: 'Real Gemini over public HTTPS and owned authorized tools; language/safety/quality still need qualified review', text: ai.text, tool: ai.tool });
  const streamed = await request('POST', '/v1/coach/messages', { message: 'Summarize what is known about my training without changing anything.' }, owner.token, 200, { accept: 'text/event-stream' }); assert.match(streamed, /^data: /);
  evidence.checks.push({ id: 'STG-SSE-01', status: 'PASS', scope: 'Existing buffered SSE response completes inside function lifetime; incremental token delivery is not implemented' });
  await request('DELETE', '/v1/coach/assignments', { coachUserId: coach.userId, memberUserId: owner.userId, reason: 'Synthetic revocation test' }, admin.token);
  await request('GET', '/v1/coach/members/' + owner.userId + '/state', null, coach.token, 403);
  const refresh = await request('POST', '/v1/auth/refresh', { refreshToken: owner.refreshToken });
  await request('POST', '/v1/auth/logout', {}, refresh.accessToken); await request('GET', '/v1/me', null, refresh.accessToken, 401);
  const entitlements = await request('GET', '/v1/member/entitlements', null, other.token); assert.equal(entitlements.purchasesEnabled, false);
  const privileges = await db.query("SELECT has_table_privilege('traina_staging_app', 'schema_migrations', 'INSERT') AS can_migrate"); assert.equal(privileges.rows[0].can_migrate, false);
  evidence.checks.push({ id: 'STG-GATES-01', status: 'PASS', scope: 'Refresh/logout revocation, assignment revocation, purchases disabled, runtime cannot change migration ledger; commercial readiness remains 503' });
  evidence.status = 'PASS_WITH_REVIEW';
} catch (error) { evidence.status = 'FAILED'; evidence.failure = String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,'[redacted]'); process.exitCode=1; }
finally { await db.close(); await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(evidence,null,2)); console.log(JSON.stringify({ status:evidence.status,calls:evidence.calls.length,checks:evidence.checks.map(row=>({id:row.id,status:row.status})),failure:evidence.failure })); }
