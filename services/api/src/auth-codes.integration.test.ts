import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgliteDatabase, type Database } from './db/database.js';

const secret = 'session-secret-value';

describe('email codes', () => {
  let database: Database;
  let app: FastifyInstance;

  beforeAll(async () => {
    database = await createPgliteDatabase(mkdtempSync(join(tmpdir(), 'sahhti-otp-')));
    await applyMigrationsTo(database);
    app = buildApp({ authMode: 'session', database, tokenSecret: secret, mailbox: 'outbox', coachProvider: 'unconfigured' });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  async function codeFor(email: string): Promise<string> {
    const rows = await database.query<{ body: string }>(
      `SELECT body FROM email_outbox WHERE recipient = $1 ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    return String(rows.rows[0]?.body ?? '');
  }

  it('registers without returning a code, then opens a session from the six-digit code', async () => {
    const email = 'new@sahhti.test';
    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password: 'correct-horse', locale: 'ar' },
    });
    expect(register.statusCode).toBe(201);
    expect(register.json()).toEqual({ accepted: true });
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify',
      payload: { email, code: await codeFor(email) },
    });
    expect(verify.statusCode).toBe(200);
    expect(typeof verify.json().accessToken).toBe('string');
  });

  it('keeps an existing email indistinguishable and does not replace an active password', async () => {
    const again = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'new@sahhti.test', password: 'another-horse', locale: 'ar' },
    });
    expect(again.statusCode).toBe(201);
    expect(again.json().accepted).toBe(true);
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'new@sahhti.test', password: 'correct-horse' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('expires a code and limits resend to one fresh code', async () => {
    const email = 'wait@sahhti.test';
    await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, password: 'correct-horse', locale: 'en' } });
    const first = await codeFor(email);
    const resent = await app.inject({ method: 'POST', url: '/v1/auth/verify/resend', payload: { email } });
    expect(resent.statusCode).toBe(200);
    expect(await codeFor(email)).toBe(first);
    await database.query(
      `UPDATE email_verifications SET expires_at = now() - interval '1 minute', created_at = now() - interval '2 minutes'
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    const expired = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { email, code: first } });
    expect(expired.statusCode).toBe(400);
    expect(expired.json().error.code).toBe('CODE_EXPIRED');
    const again = await app.inject({ method: 'POST', url: '/v1/auth/verify/resend', payload: { email } });
    expect(again.statusCode).toBe(200);
    expect(await codeFor(email)).not.toBe(first);
  });

  it('resets a password with a single-use code and revokes the old session', async () => {
    const email = 'reset@sahhti.test';
    await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, password: 'correct-horse', locale: 'ar' } });
    await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { email, code: await codeFor(email) } });
    const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: 'correct-horse' } });
    const access = login.json().accessToken as string;
    const recover = await app.inject({ method: 'POST', url: '/v1/auth/recover', payload: { email } });
    expect(recover.statusCode).toBe(202);
    expect(recover.json().resetToken).toBeUndefined();
    const reset = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset',
      payload: { email, code: await codeFor(email), password: 'new-horse-battery' },
    });
    expect(reset.statusCode).toBe(200);
    const oldSession = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${access}` } });
    expect(oldSession.statusCode).toBe(401);
    const next = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: 'new-horse-battery' } });
    expect(next.statusCode).toBe(200);
  });

  it('locks a code after five wrong attempts', async () => {
    const email = 'lock@sahhti.test';
    await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, password: 'correct-horse', locale: 'ar' } });
    const real = await codeFor(email);
    const wrongCode = real === '111111' ? '222222' : '111111';
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const wrong = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { email, code: wrongCode } });
      expect(wrong.statusCode).toBe(400);
    }
    const locked = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { email, code: wrongCode } });
    expect(locked.statusCode).toBe(429);
    const after = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { email, code: real } });
    expect(after.statusCode).toBe(400);
  });
});
