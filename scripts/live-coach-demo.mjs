import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const base = process.env.API_BASE ?? 'http://127.0.0.1:3040';
const session = JSON.parse(readFileSync('.data/live-demo-session.json', 'utf8').replace(/^\uFEFF/, ''));

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

const { memberTok, coachTok, adminTok, otherTok, memberId, coachId } = session;

const selfAssign = await api('POST', '/v1/coach/assignments', coachTok, {
  coachUserId: coachId,
  memberUserId: memberId,
});
const consent = await api('POST', '/v1/member/coach-share-consent', memberTok, {});
const assign = await api('POST', '/v1/coach/assignments', adminTok, {
  coachUserId: coachId,
  memberUserId: memberId,
  reason: 'live_demo',
});
const idor = await api('GET', `/v1/coach/members/${memberId}/state`, otherTok);
const assigned = await api('GET', `/v1/coach/members/${memberId}/state`, coachTok);
await api('POST', '/v1/water', memberTok, { milliliters: 500, loggedOn: '2026-10-13' });
await api('POST', '/v1/member/recommendations/generate', memberTok, {});
const brief = await api('POST', '/v1/coach/weekly-brief', memberTok, {
  weekOf: '2026-10-13',
  energy: 4,
  sleep: 4,
  stress: 2,
  hunger: 3,
  effort: 4,
  recovery: 3,
  satisfaction: 4,
  difficulties: 'Travel mid-week',
  questionForCoach: 'How should I handle hotel gyms?',
});
const inbox = await api('GET', '/v1/coach/workspace/inbox', coachTok);
const reviewId = brief.json.review?.id;
const claim = await api('POST', `/v1/coach/reviews/${reviewId}/claim`, coachTok, {});
const packet = await api('GET', `/v1/coach/reviews/${reviewId}/packet`, coachTok);
const feedback = await api('POST', `/v1/coach/reviews/${reviewId}/feedback`, coachTok, {
  body: 'Strong logging this week. Keep protein steady on travel days.',
});
const memberFeedback = await api('GET', '/v1/member/coach-feedback', memberTok);
const metrics = await api('GET', '/v1/coach/workspace/metrics', coachTok);
const revoke = await api('DELETE', '/v1/coach/assignments', adminTok, {
  coachUserId: coachId,
  memberUserId: memberId,
  reason: 'demo_end',
});
const afterRevoke = await api('GET', `/v1/coach/members/${memberId}/state`, coachTok);

const evidence = {
  at: new Date().toISOString(),
  mergeCommit: 'ff2bb872f0cd7770fff151c6295a1268a84ec2e4',
  selfAssign: { status: selfAssign.status, code: selfAssign.json.error?.code },
  consent: consent.json.status,
  assignPersisted: assign.json.persisted === true,
  idor: { status: idor.status, hasState: idor.json.state !== undefined },
  assignedRead: { status: assigned.status, confidence: assigned.json.state?.confidence },
  briefStatus: brief.json.review?.status,
  reviewId,
  inboxCount: inbox.json.reviews?.length ?? 0,
  claimStatus: claim.json.review?.status,
  packet: {
    sleepLoggingAvailable: packet.json.packet?.sleepLoggingAvailable,
    memberQuestions: packet.json.packet?.memberQuestions,
  },
  feedbackAuthor: feedback.json.feedback?.authorKind,
  memberReceived: memberFeedback.json.feedback?.[0]?.body ?? null,
  metrics: metrics.json,
  revokeActive: revoke.json.active,
  afterRevoke: { status: afterRevoke.status, hasState: afterRevoke.json.state !== undefined },
};

mkdirSync('docs/architecture', { recursive: true });
writeFileSync('docs/architecture/human-coach-live-runtime.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
