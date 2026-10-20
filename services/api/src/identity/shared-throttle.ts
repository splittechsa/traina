import { createHash } from 'node:crypto';
import type { Database } from '../db/database.js';
/** Atomic counters shared by all instances; raw email/IP keys are not retained. */
export async function allowAuthAttempt(db: Database, scope: string, key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const hash = createHash('sha256').update(scope + ':' + key.toLowerCase()).digest('hex');
  const bucket = Math.floor(now / windowMs);
  const expires = new Date((bucket + 1) * windowMs).toISOString();
  const rows = await db.query<{ hits: number }>(
    `INSERT INTO auth_rate_limits (key_hash, bucket, hits, expires_at) VALUES ($1, $2, 1, $3)
     ON CONFLICT (key_hash) DO UPDATE SET bucket = EXCLUDED.bucket, expires_at = EXCLUDED.expires_at,
       hits = CASE WHEN auth_rate_limits.bucket = EXCLUDED.bucket THEN LEAST(auth_rate_limits.hits + 1, $4) ELSE 1 END
     RETURNING hits`, [hash, bucket, expires, limit + 1]);
  // Retention is bounded without depending on an in-process background timer.
  await db.query('DELETE FROM auth_rate_limits WHERE expires_at < $1', [new Date(now - 86400000).toISOString()]);
  return Number(rows.rows[0]?.hits ?? limit + 1) <= limit;
}
