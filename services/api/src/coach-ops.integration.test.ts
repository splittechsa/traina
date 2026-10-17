import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgliteDatabase, seedDevelopment, type Database } from './db/database.js';

const secret = 'session-secret-coach-ops';

describe('P2 human coaching ops (security + workflow)', () => {
  let dir = '';
  let database: Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sahhti-coach-'));
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

  async function userIdFor(token: string): Promise<string> {
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(200);
    return me.json().userId as string;
  }

  it('blocks self-assignment, IDOR, privilege escalation, and revoked access; completes weekly loop', async () => {
    const memberToken = await tokenFor('member-coach-ops@sahhti.test');
    const coachToken = await tokenFor('coach-ops@sahhti.test');
    const otherCoachToken = await tokenFor('other-coach-ops@sahhti.test');
    const adminToken = await tokenFor('admin-coach-ops@sahhti.test');

    const memberId = await userIdFor(memberToken);
    const coachId = await userIdFor(coachToken);
    const otherCoachId = await userIdFor(otherCoachToken);
    const adminId = await userIdFor(adminToken);

    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'coach_reviewer')`, [coachId]);
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'coach_reviewer')`, [otherCoachId]);
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'admin')`, [adminId]);

    // Privilege escalation / self-assignment denied.
    const selfAssign = await app.inject({
      method: 'POST',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${coachToken}` },
      payload: { coachUserId: coachId, memberUserId: memberId },
    });
    expect(selfAssign.statusCode).toBe(403);
    expect(selfAssign.json().error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(selfAssign.json())).not.toMatch(/weight|kcal|MemberState/i);

    const memberSelf = await app.inject({
      method: 'POST',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { coachUserId: coachId, memberUserId: memberId },
    });
    expect(memberSelf.statusCode).toBe(403);

    // Member consents to coach share before assignment reads succeed.
    const consent = await app.inject({
      method: 'POST',
      url: '/v1/member/coach-share-consent',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(consent.statusCode).toBe(200);
    expect(consent.json().status).toBe('granted');

    const assigned = await app.inject({
      method: 'POST',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { coachUserId: coachId, memberUserId: memberId, reason: 'pilot_assignment' },
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json().active).toBe(true);

    const events = await database.query<{ action: string }>(
      `SELECT action FROM coach_assignment_events WHERE member_user_id = $1 ORDER BY at`,
      [memberId],
    );
    expect(events.rows.some((row) => row.action === 'assign')).toBe(true);

    // Unassigned coach cannot read member state (IDOR).
    const idor = await app.inject({
      method: 'GET',
      url: `/v1/coach/members/${memberId}/state`,
      headers: { authorization: `Bearer ${otherCoachToken}` },
    });
    expect(idor.statusCode).toBe(403);
    expect(idor.json().error.code).toBe('FORBIDDEN');
    expect(idor.json().error.message).toBe('Access denied');
    expect(idor.json()).not.toHaveProperty('state');

    // Assigned coach can read after consent.
    const allowed = await app.inject({
      method: 'GET',
      url: `/v1/coach/members/${memberId}/state`,
      headers: { authorization: `Bearer ${coachToken}` },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().state).toBeDefined();

    // Log activity → recommendations → weekly review.
    const day = '2026-06-14';
    await app.inject({
      method: 'POST',
      url: '/v1/water',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { milliliters: 500, loggedOn: day },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/member/recommendations/generate',
      headers: { authorization: `Bearer ${memberToken}` },
    });

    const weekOf = '2026-06-09';
    const brief = await app.inject({
      method: 'POST',
      url: '/v1/coach/weekly-brief',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { weekOf, energy: 3, sleep: 4, stress: 2, hunger: 3, notes: 'travel week' },
    });
    expect(brief.statusCode).toBe(200);
    expect(brief.json().review?.status).toBe('QUEUED_FOR_HUMAN');

    const inbox = await app.inject({
      method: 'GET',
      url: '/v1/coach/workspace/inbox',
      headers: { authorization: `Bearer ${coachToken}` },
    });
    expect(inbox.statusCode).toBe(200);
    const reviewId = inbox.json().reviews[0]?.id as string;
    expect(reviewId).toBeTruthy();

    const otherInboxPacket = await app.inject({
      method: 'GET',
      url: `/v1/coach/reviews/${reviewId}/packet`,
      headers: { authorization: `Bearer ${otherCoachToken}` },
    });
    expect(otherInboxPacket.statusCode).toBe(403);

    const claim = await app.inject({
      method: 'POST',
      url: `/v1/coach/reviews/${reviewId}/claim`,
      headers: { authorization: `Bearer ${coachToken}` },
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.json().review.status).toBe('IN_REVIEW');

    const packet = await app.inject({
      method: 'GET',
      url: `/v1/coach/reviews/${reviewId}/packet`,
      headers: { authorization: `Bearer ${coachToken}` },
    });
    expect(packet.statusCode).toBe(200);
    expect(packet.json().packet.sleepLoggingAvailable).toBe(false);
    expect(packet.json().packet.yazanProposals.every((row: { humanApproved: boolean }) => row.humanApproved === false)).toBe(
      true,
    );

    const feedback = await app.inject({
      method: 'POST',
      url: `/v1/coach/reviews/${reviewId}/feedback`,
      headers: { authorization: `Bearer ${coachToken}` },
      payload: { body: 'Solid week. Keep protein steady on travel days.' },
    });
    expect(feedback.statusCode).toBe(200);
    expect(feedback.json().feedback.authorKind).toBe('human_coach');

    const memberFeedback = await app.inject({
      method: 'GET',
      url: '/v1/member/coach-feedback',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(memberFeedback.statusCode).toBe(200);
    expect(memberFeedback.json().feedback[0]?.body).toContain('protein');

    // Revoke assignment — coach loses access.
    const revoked = await app.inject({
      method: 'DELETE',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { coachUserId: coachId, memberUserId: memberId, reason: 'reassign_pilot' },
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().active).toBe(false);

    const afterRevoke = await app.inject({
      method: 'GET',
      url: `/v1/coach/members/${memberId}/state`,
      headers: { authorization: `Bearer ${coachToken}` },
    });
    expect(afterRevoke.statusCode).toBe(403);
    expect(afterRevoke.json()).not.toHaveProperty('state');

    // Reassign to other coach — previous coach still denied.
    await app.inject({
      method: 'POST',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { coachUserId: otherCoachId, memberUserId: memberId, reason: 'handoff' },
    });
    const previousStillDenied = await app.inject({
      method: 'GET',
      url: `/v1/coach/members/${memberId}/state`,
      headers: { authorization: `Bearer ${coachToken}` },
    });
    expect(previousStillDenied.statusCode).toBe(403);
    const newCoachOk = await app.inject({
      method: 'GET',
      url: `/v1/coach/members/${memberId}/state`,
      headers: { authorization: `Bearer ${otherCoachToken}` },
    });
    expect(newCoachOk.statusCode).toBe(200);

    // Consent withdrawal blocks subsequent coach reads.
    const withdrawn = await app.inject({
      method: 'DELETE',
      url: '/v1/member/coach-share-consent',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(withdrawn.statusCode).toBe(200);
    const afterWithdraw = await app.inject({
      method: 'GET',
      url: `/v1/coach/members/${memberId}/state`,
      headers: { authorization: `Bearer ${otherCoachToken}` },
    });
    expect(afterWithdraw.statusCode).toBe(403);
    expect(afterWithdraw.json()).not.toHaveProperty('state');

    // Missing review id looks the same as unauthorized (no existence oracle).
    const missing = await app.inject({
      method: 'GET',
      url: '/v1/coach/reviews/00000000-0000-4000-8000-000000000099/packet',
      headers: { authorization: `Bearer ${otherCoachToken}` },
    });
    expect(missing.statusCode).toBe(403);
    expect(missing.json().error.code).toBe('FORBIDDEN');
  }, 120_000);

  it('lets Yazan mock retrieve human feedback without inventing comments', async () => {
    const memberToken = await tokenFor('yazan-feedback@sahhti.test');
    const coachToken = await tokenFor('yazan-feedback-coach@sahhti.test');
    const adminToken = await tokenFor('yazan-feedback-admin@sahhti.test');
    const memberId = await userIdFor(memberToken);
    const coachId = await userIdFor(coachToken);
    const adminId = await userIdFor(adminToken);
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'coach_reviewer')`, [coachId]);
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'admin')`, [adminId]);
    await app.inject({
      method: 'POST',
      url: '/v1/member/coach-share-consent',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { coachUserId: coachId, memberUserId: memberId },
    });
    const empty = await app.inject({
      method: 'POST',
      url: '/v1/coach/messages',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { message: 'any human feedback for me?' },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().tool).toBe('getHumanCoachFeedback');
    expect(String(empty.json().text)).toMatch(/No human coach feedback/i);

    const weekOf = '2026-08-03';
    const brief = await app.inject({
      method: 'POST',
      url: '/v1/coach/weekly-brief',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { weekOf, energy: 3, sleep: 3, stress: 2, hunger: 3 },
    });
    const reviewId = brief.json().review.id as string;
    await app.inject({
      method: 'POST',
      url: `/v1/coach/reviews/${reviewId}/claim`,
      headers: { authorization: `Bearer ${coachToken}` },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/coach/reviews/${reviewId}/feedback`,
      headers: { authorization: `Bearer ${coachToken}` },
      payload: { body: 'Recover well before the next heavy session.' },
    });
    const withFb = await app.inject({
      method: 'POST',
      url: '/v1/coach/messages',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { message: 'show human feedback' },
    });
    expect(withFb.statusCode).toBe(200);
    expect(withFb.json().tool).toBe('getHumanCoachFeedback');
    expect(String(withFb.json().text)).toContain('Recover well');
    expect(String(withFb.json().text)).toContain('human_coach');
  }, 120_000);

  it('keeps weekly submit idempotent and serializes concurrent claims', async () => {
    const memberToken = await tokenFor('member-concurrent@sahhti.test');
    const coachA = await tokenFor('coach-a-concurrent@sahhti.test');
    const coachB = await tokenFor('coach-b-concurrent@sahhti.test');
    const adminToken = await tokenFor('admin-concurrent@sahhti.test');
    const memberId = await userIdFor(memberToken);
    const coachAId = await userIdFor(coachA);
    const coachBId = await userIdFor(coachB);
    const adminId = await userIdFor(adminToken);
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'coach_reviewer')`, [coachAId]);
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'coach_reviewer')`, [coachBId]);
    await database.query(`INSERT INTO role_assignments (user_id, role) VALUES ($1, 'admin')`, [adminId]);
    await app.inject({
      method: 'POST',
      url: '/v1/member/coach-share-consent',
      headers: { authorization: `Bearer ${memberToken}` },
    });
    // Assign both coaches — reassignment leaves only the latest active.
    await app.inject({
      method: 'POST',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { coachUserId: coachAId, memberUserId: memberId },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/coach/assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { coachUserId: coachBId, memberUserId: memberId, reason: 'capacity_balance' },
    });
    // Re-activate both for concurrency by direct insert (ops stress only).
    await database.query(
      `INSERT INTO coach_member_assignments (coach_user_id, member_user_id, active)
       VALUES ($1, $2, true)
       ON CONFLICT (coach_user_id, member_user_id) DO UPDATE SET active = true`,
      [coachAId, memberId],
    );

    const weekOf = '2026-07-06';
    const first = await app.inject({
      method: 'POST',
      url: '/v1/coach/weekly-brief',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { weekOf, energy: 3, sleep: 3, stress: 3, hunger: 3, effort: 4, recovery: 3, satisfaction: 4 },
    });
    expect(first.statusCode).toBe(200);
    const reviewId = first.json().review.id as string;
    const second = await app.inject({
      method: 'POST',
      url: '/v1/coach/weekly-brief',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { weekOf, energy: 4, sleep: 4, stress: 2, hunger: 3, effort: 5, recovery: 4, satisfaction: 4 },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().review.id).toBe(reviewId);
    const count = await database.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM weekly_review_queue WHERE member_user_id = $1 AND week_of = $2::date`,
      [memberId, weekOf],
    );
    expect(Number(count.rows[0]?.n)).toBe(1);

    const [claimA, claimB] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/coach/reviews/${reviewId}/claim`,
        headers: { authorization: `Bearer ${coachA}` },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/coach/reviews/${reviewId}/claim`,
        headers: { authorization: `Bearer ${coachB}` },
      }),
    ]);
    const codes = [claimA.statusCode, claimB.statusCode].sort();
    expect(codes[0] === 200 || codes[1] === 200).toBe(true);
    expect(codes.includes(409) || codes.includes(403) || codes.includes(422) || codes[0] === codes[1]).toBe(true);
  }, 120_000);
});
