/**
 * Synthetic cohort operational probe against a live API (dev mailbox required).
 * After bootstrap, grants roles via printed SQL (or set ROLE_SQL_APPLIED=1 if already granted).
 * Measures claim→feedback wall time; does not invent coach:member capacity ratios.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const base = process.env.API_BASE ?? 'http://127.0.0.1:3040';

async function api(method, path, token, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function bootstrap(email) {
  await api('POST', '/v1/auth/register', null, { email, password: 'correct-horse', locale: 'en' });
  const box = await api('GET', `/v1/dev/mailbox?email=${encodeURIComponent(email)}&include=code`);
  if (!box.json.code) throw new Error(`No verify code for ${email}`);
  await api('POST', '/v1/auth/verify', null, { email, code: box.json.code });
  const login = await api('POST', '/v1/auth/login', null, { email, password: 'correct-horse' });
  return login.json.accessToken;
}

const stamp = Date.now();
const statePath = '.data/cohort-session.json';

let state;
if (existsSync(statePath) && process.env.COHORT_REUSE === '1') {
  state = JSON.parse(readFileSync(statePath, 'utf8').replace(/^\uFEFF/, ''));
} else {
  const adminTok = await bootstrap(`cohort.admin.${stamp}@sahhti.test`);
  const coachA = await bootstrap(`cohort.ca.${stamp}@sahhti.test`);
  const coachB = await bootstrap(`cohort.cb.${stamp}@sahhti.test`);
  const members = [];
  for (let i = 0; i < 3; i += 1) {
    const tok = await bootstrap(`cohort.m${i}.${stamp}@sahhti.test`);
    const id = (await api('GET', '/v1/me', tok)).json.userId;
    members.push({ tok, id });
  }
  state = {
    stamp,
    adminTok,
    adminId: (await api('GET', '/v1/me', adminTok)).json.userId,
    coaches: [
      { tok: coachA, id: (await api('GET', '/v1/me', coachA)).json.userId },
      { tok: coachB, id: (await api('GET', '/v1/me', coachB)).json.userId },
    ],
    members,
  };
  mkdirSync('.data', { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

const roleSql = [
  `INSERT INTO role_assignments (user_id, role) VALUES ('${state.adminId}', 'admin');`,
  ...state.coaches.map((c) => `INSERT INTO role_assignments (user_id, role) VALUES ('${c.id}', 'coach_reviewer');`),
].join('\n');

if (process.env.ROLE_SQL_APPLIED !== '1') {
  writeFileSync('.data/cohort-role-sql.sql', roleSql);
  console.log(
    JSON.stringify(
      {
        paused: true,
        applySqlFile: '.data/cohort-role-sql.sql',
        then: 'ROLE_SQL_APPLIED=1 node scripts/coach-cohort-ops.mjs',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const weekOf = '2026-10-13';
const timings = [];
const results = { assignments: [], reviews: [], revoke: null, metrics: [] };

for (let i = 0; i < state.members.length; i += 1) {
  const member = state.members[i];
  const coach = state.coaches[i % state.coaches.length];
  await api('POST', '/v1/member/coach-share-consent', member.tok, {});
  const assign = await api('POST', '/v1/coach/assignments', state.adminTok, {
    coachUserId: coach.id,
    memberUserId: member.id,
    reason: 'cohort',
  });
  results.assignments.push({ status: assign.status, persisted: assign.json.persisted });
  await api('POST', '/v1/water', member.tok, { milliliters: 400 + i * 50, loggedOn: weekOf });
  const brief = await api('POST', '/v1/coach/weekly-brief', member.tok, {
    weekOf,
    energy: 3,
    sleep: 3,
    stress: 2,
    hunger: 3,
    effort: 3,
    recovery: 3,
    satisfaction: 3,
  });
  const reviewId = brief.json.review?.id;
  const started = Date.now();
  const claim = await api('POST', `/v1/coach/reviews/${reviewId}/claim`, coach.tok, {});
  const feedback = await api('POST', `/v1/coach/reviews/${reviewId}/feedback`, coach.tok, {
    body: `Cohort feedback for member ${i + 1}: keep logging steady.`,
  });
  timings.push({ memberIndex: i, claimToFeedbackMs: Date.now() - started, claim: claim.json.review?.status, author: feedback.json.feedback?.authorKind });
  results.reviews.push({ reviewId, briefStatus: brief.json.review?.status });
}

const escalateTarget = results.reviews[0]?.reviewId;
if (escalateTarget) {
  // reopen path not required; mark overdue then check metrics
  await api('POST', '/v1/coach/workspace/mark-overdue', state.adminTok, { olderThanHours: 1 });
}

for (const coach of state.coaches) {
  results.metrics.push((await api('GET', '/v1/coach/workspace/metrics', coach.tok)).json);
}

const last = state.members[state.members.length - 1];
const lastCoach = state.coaches[(state.members.length - 1) % state.coaches.length];
const revoked = await api('DELETE', '/v1/coach/assignments', state.adminTok, {
  coachUserId: lastCoach.id,
  memberUserId: last.id,
  reason: 'cohort_end',
});
const after = await api('GET', `/v1/coach/members/${last.id}/state`, lastCoach.tok);
results.revoke = { active: revoked.json.active, afterStatus: after.status, hasState: after.json.state !== undefined };

const evidence = {
  at: new Date().toISOString(),
  memberCount: state.members.length,
  coachCount: state.coaches.length,
  timingsMs: timings,
  meanClaimToFeedbackMs: Math.round(timings.reduce((s, t) => s + t.claimToFeedbackMs, 0) / timings.length),
  results,
};
mkdirSync('docs/architecture', { recursive: true });
writeFileSync('docs/architecture/human-coach-cohort-runtime.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
