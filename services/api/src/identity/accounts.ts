import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ROLES, type Actor, type Role } from '@sahhti/domain';
import type { Database } from '../db/database.js';
import { signDevToken } from '../auth.js';
import { deliverEmail, type DeliveryState } from './mail.js';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './passwords.js';

const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 30 * 24 * 60 * 60;
const DUMMY_HASH = `scrypt:16384:8:1:${'00'.repeat(16)}:${'11'.repeat(32)}`;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message = code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function token(): string {
  return randomBytes(32).toString('base64url');
}

function oneTimeCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

const CODE_ATTEMPTS = 5;

export async function sendMailbox(
  db: Database,
  message: { to: string; purpose: 'verify' | 'reset'; token: string },
): Promise<void> {
  await db.query('INSERT INTO email_outbox (recipient, purpose, body) VALUES ($1, $2, $3)', [
    message.to,
    message.purpose,
    message.token,
  ]);
}

export async function registerAccount(
  db: Database,
  input: { email: string; password: string; locale: 'ar' | 'en' },
  env: Record<string, string | undefined> = process.env,
): Promise<{ accepted: true; delivery: DeliveryState }> {
  try {
    assertPasswordPolicy(input.password);
  } catch {
    throw new ApiError(422, 'WEAK_PASSWORD', 'Password must be 10 to 128 characters');
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(422, 'INVALID_EMAIL', 'Email is not valid');
  }
  const userId = randomUUID();
  const code = oneTimeCode();
  const passwordHash = await hashPassword(input.password);
  try {
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, email, status, locale) VALUES ($1, $2, 'pending', $3)`,
        [userId, email, input.locale],
      );
      await tx.query('INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)', [userId, passwordHash]);
      await tx.query(
        `INSERT INTO role_assignments (user_id, role, gym_organization_id) VALUES ($1, 'member', NULL)`,
        [userId],
      );
      await tx.query(
        `INSERT INTO email_verifications (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '10 minutes')`,
        [userId, sha256(code)],
      );
      await sendMailbox(tx, { to: email, purpose: 'verify', token: code });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    return { accepted: true, delivery: await replacePendingCode(db, email, passwordHash, env) };
  }
  return { accepted: true, delivery: await deliverEmail(env, { to: email, purpose: 'verify', code }) };
}

async function replacePendingCode(
  db: Database,
  email: string,
  passwordHash: string,
  env: Record<string, string | undefined>,
): Promise<DeliveryState> {
  const found = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email],
  );
  const row = found.rows[0];
  if (row === undefined || row.status !== 'pending') {
    return deliverEmail(env, { to: email, purpose: 'notice' });
  }
  const code = oneTimeCode();
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE user_credentials SET password_hash = $2, updated_at = now() WHERE user_id = $1`, [row.id, passwordHash]);
    await tx.query(`UPDATE email_verifications SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [row.id]);
    await tx.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '10 minutes')`,
      [row.id, sha256(code)],
    );
    await sendMailbox(tx, { to: email, purpose: 'verify', token: code });
  });
  return deliverEmail(env, { to: email, purpose: 'verify', code });
}

export async function resendVerification(
  db: Database,
  emailRaw: string,
  env: Record<string, string | undefined> = process.env,
): Promise<{ accepted: true; delivery: DeliveryState; cooldownSeconds: number }> {
  const email = emailRaw.trim().toLowerCase();
  const found = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email],
  );
  const row = found.rows[0];
  if (row === undefined || row.status !== 'pending') {
    return { accepted: true, delivery: 'unconfigured', cooldownSeconds: 60 };
  }
  const recent = await db.query<{ fresh: boolean }>(
    `SELECT created_at > now() - interval '60 seconds' AS fresh
     FROM email_verifications
     WHERE user_id = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [row.id],
  );
  if (recent.rows[0] !== undefined && isTrue(recent.rows[0].fresh)) {
    return { accepted: true, delivery: 'unconfigured', cooldownSeconds: 60 };
  }
  const code = oneTimeCode();
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE email_verifications SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [row.id]);
    await tx.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
      [row.id, sha256(code)],
    );
    await sendMailbox(tx, { to: email, purpose: 'verify', token: code });
  });
  return { accepted: true, delivery: await deliverEmail(env, { to: email, purpose: 'verify', code }), cooldownSeconds: 60 };
}

export async function verifyEmail(db: Database, rawToken: string): Promise<string> {
  const found = await db.query<{ user_id: string }>(
    `UPDATE email_verifications
     SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < $2
     RETURNING user_id`,
    [sha256(rawToken), CODE_ATTEMPTS],
  );
  const row = found.rows[0];
  if (row === undefined) {
    throw new ApiError(400, 'INVALID_CODE', 'Verification code is invalid or expired');
  }
  await db.query(`UPDATE users SET status = 'active' WHERE id = $1 AND status = 'pending'`, [row.user_id]);
  return row.user_id;
}

export async function verifyEmailCode(db: Database, emailRaw: string, code: string): Promise<string> {
  const email = emailRaw.trim().toLowerCase();
  const current = await db.query<{ id: string; token_hash: string; expires_at: string; attempts: number; user_id: string }>(
    `SELECT email_verifications.id, email_verifications.token_hash, email_verifications.expires_at,
            email_verifications.attempts, email_verifications.user_id
     FROM email_verifications
     JOIN users ON users.id = email_verifications.user_id
     WHERE lower(users.email) = $1 AND email_verifications.consumed_at IS NULL
     ORDER BY email_verifications.created_at DESC
     LIMIT 1`,
    [email],
  );
  const row = current.rows[0];
  if (row === undefined) {
    throw new ApiError(400, 'INVALID_CODE', 'Verification code is invalid or expired');
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ApiError(400, 'CODE_EXPIRED', 'Verification code expired');
  }
  if (row.attempts >= CODE_ATTEMPTS) {
    await db.query(`UPDATE email_verifications SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`, [row.id]);
    throw new ApiError(429, 'RATE_LIMITED', 'Too many verification attempts');
  }
  if (row.token_hash !== sha256(code)) {
    const next = await db.query<{ attempts: number }>(
      `UPDATE email_verifications
       SET attempts = attempts + 1,
           consumed_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE consumed_at END
       WHERE id = $1 AND consumed_at IS NULL
       RETURNING attempts`,
      [row.id, CODE_ATTEMPTS],
    );
    if ((next.rows[0]?.attempts ?? 0) >= CODE_ATTEMPTS) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many verification attempts');
    }
    throw new ApiError(400, 'INVALID_CODE', 'Verification code is invalid or expired');
  }
  const consumed = await db.query<{ user_id: string }>(
    `UPDATE email_verifications
     SET consumed_at = now()
     WHERE id = $1 AND token_hash = $2 AND consumed_at IS NULL AND attempts < $3 AND expires_at > now()
     RETURNING user_id`,
    [row.id, sha256(code), CODE_ATTEMPTS],
  );
  const winner = consumed.rows[0];
  if (winner === undefined) {
    throw new ApiError(400, 'INVALID_CODE', 'Verification code is invalid or expired');
  }
  await db.query(`UPDATE users SET status = 'active' WHERE id = $1 AND status = 'pending'`, [winner.user_id]);
  return winner.user_id;
}

export async function loginAccount(
  db: Database,
  secret: string,
  input: { email: string; password: string },
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const email = input.email.trim().toLowerCase();
  const found = await db.query<{ id: string; status: string; password_hash: string }>(
    `SELECT users.id, users.status, user_credentials.password_hash
     FROM users
     JOIN user_credentials ON user_credentials.user_id = users.id
     WHERE lower(users.email) = $1 AND users.deleted_at IS NULL`,
    [email],
  );
  const row = found.rows[0];
  const passwordOk = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH);
  if (row === undefined || !passwordOk) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (row.status !== 'active') {
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify the email before signing in');
  }
  return issueSession(db, secret, row.id);
}

export async function refreshSession(
  db: Database,
  secret: string,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const hashed = sha256(refreshToken);
  return db.transaction(async tx => {
    // A single conditional UPDATE consumes the token once, including across serverless instances.
    const found = await tx.query<{ user_id: string }>(
      `UPDATE device_sessions SET revoked_at=now()
       WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() RETURNING user_id`, [hashed]);
    const row=found.rows[0];
    if (!row) throw new ApiError(401, 'INVALID_REFRESH', 'Refresh token is invalid');
    return issueSession(tx, secret, row.user_id);
  });
}

export async function logoutSession(db: Database, sessionId: string): Promise<void> {
  await db.query(`UPDATE device_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [sessionId]);
}

export async function requestPasswordReset(
  db: Database,
  emailRaw: string,
  env: Record<string, string | undefined> = process.env,
): Promise<DeliveryState> {
  const email = emailRaw.trim().toLowerCase();
  const found = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL AND status = 'active'`,
    [email],
  );
  const row = found.rows[0];
  if (row === undefined) {
    return 'unconfigured';
  }
  const recent = await db.query<{ fresh: boolean }>(
    `SELECT created_at > now() - interval '60 seconds' AS fresh
     FROM password_resets WHERE user_id = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [row.id],
  );
  if (recent.rows[0] !== undefined && isTrue(recent.rows[0].fresh)) {
    return 'unconfigured';
  }
  const code = oneTimeCode();
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE password_resets SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`, [row.id]);
    await tx.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '15 minutes')`,
      [row.id, sha256(code)],
    );
    await sendMailbox(tx, { to: email, purpose: 'reset', token: code });
  });
  return deliverEmail(env, { to: email, purpose: 'reset', code });
}

export async function resetPassword(db: Database, rawToken: string, password: string): Promise<void> {
  await applyNewPassword(db, sha256(rawToken), password, null);
}

export async function resetPasswordWithCode(db: Database, emailRaw: string, code: string, password: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const current = await db.query<{ id: string; token_hash: string; expires_at: string; attempts: number }>(
    `SELECT password_resets.id, password_resets.token_hash, password_resets.expires_at, password_resets.attempts
     FROM password_resets
     JOIN users ON users.id = password_resets.user_id
     WHERE lower(users.email) = $1 AND password_resets.consumed_at IS NULL
     ORDER BY password_resets.created_at DESC
     LIMIT 1`,
    [email],
  );
  const row = current.rows[0];
  if (row === undefined) {
    throw new ApiError(400, 'INVALID_CODE', 'Reset code is invalid or expired');
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ApiError(400, 'CODE_EXPIRED', 'Reset code expired');
  }
  if (row.token_hash !== sha256(code)) {
    const next = await db.query<{ attempts: number }>(
      `UPDATE password_resets
       SET attempts = attempts + 1,
           consumed_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE consumed_at END
       WHERE id = $1 AND consumed_at IS NULL
       RETURNING attempts`,
      [row.id, CODE_ATTEMPTS],
    );
    if ((next.rows[0]?.attempts ?? 0) >= CODE_ATTEMPTS) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many reset attempts');
    }
    throw new ApiError(400, 'INVALID_CODE', 'Reset code is invalid or expired');
  }
  await applyNewPassword(db, sha256(code), password, row.id);
}

async function applyNewPassword(db: Database, tokenHash: string, password: string, resetId: string | null): Promise<void> {
  try {
    assertPasswordPolicy(password);
  } catch {
    throw new ApiError(422, 'WEAK_PASSWORD', 'Password must be 10 to 128 characters');
  }
  const found = await db.query<{ user_id: string }>(
    `UPDATE password_resets SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < $2
       AND ($3::text IS NULL OR id::text = $3)
     RETURNING user_id`,
    [tokenHash, CODE_ATTEMPTS, resetId],
  );
  const row = found.rows[0];
  if (row === undefined) {
    throw new ApiError(400, 'INVALID_CODE', 'Reset code is invalid or expired');
  }
  const passwordHash = await hashPassword(password);
  await db.query(`UPDATE user_credentials SET password_hash = $2, updated_at = now() WHERE user_id = $1`, [
    row.user_id,
    passwordHash,
  ]);
  await db.query(`UPDATE device_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [row.user_id]);
}

export async function latestDevCode(db: Database, emailRaw: string): Promise<{ purpose: string; code: string } | null> {
  const email = emailRaw.trim().toLowerCase();
  const found = await db.query<{ purpose: string; body: string }>(
    `SELECT purpose, body FROM email_outbox WHERE recipient = $1 ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  const row = found.rows[0];
  return row === undefined ? null : { purpose: row.purpose, code: row.body };
}

export async function startSession(db: Database, secret: string, userId: string) {
  return issueSession(db, secret, userId);
}

export async function deleteAccount(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE users SET status = 'deleted', deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    await tx.query(`UPDATE device_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
  });
}

export async function loadActor(db: Database, userId: string): Promise<Actor | null> {
  const users = await db.query<{ status: string }>(
    `SELECT status FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const user = users.rows[0];
  if (user === undefined || user.status !== 'active') {
    return null;
  }
  const assigned = await db.query<{ role: string; gym_organization_id: string | null }>(
    `SELECT role, gym_organization_id FROM role_assignments WHERE user_id = $1`,
    [userId],
  );
  const roles: Role[] = [];
  const gymOrganizationIds: string[] = [];
  for (const row of assigned.rows) {
    if ((ROLES as readonly string[]).includes(row.role) && !roles.includes(row.role as Role)) {
      roles.push(row.role as Role);
    }
    if (row.gym_organization_id !== null && !gymOrganizationIds.includes(row.gym_organization_id)) {
      gymOrganizationIds.push(row.gym_organization_id);
    }
  }
  return { userId, roles, gymOrganizationIds };
}

export async function assertLiveSession(db: Database, sessionId: string, userId: string): Promise<void> {
  const found = await db.query<{ user_id: string }>(
    `SELECT user_id FROM device_sessions
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [sessionId, userId],
  );
  if (found.rows[0] === undefined) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Session is not active');
  }
}

async function issueSession(db: Database, secret: string, userId: string) {
  const actor = await loadActor(db, userId);
  if (actor === null) {
    throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Account is not active');
  }
  const sessionId = randomUUID();
  const refresh = token();
  await db.query(
    `INSERT INTO device_sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(secs => $4::int))`,
    [sessionId, userId, sha256(refresh), REFRESH_SECONDS],
  );
  const accessToken = signDevToken(secret, {
    sub: userId,
    sid: sessionId,
    roles: [...actor.roles],
    gymOrganizationIds: [...actor.gymOrganizationIds],
    exp: Math.floor(Date.now() / 1000) + ACCESS_SECONDS,
  });
  return { accessToken, refreshToken: refresh, expiresIn: ACCESS_SECONDS };
}

function isTrue(value: unknown): boolean {
  return value === true || value === 't' || value === 'true';
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
