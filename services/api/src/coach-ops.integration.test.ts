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
  }, 120_000);
});
