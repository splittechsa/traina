import { z } from 'zod';
import { calendarDayInTimeZone, workoutElapsedSeconds, type PauseInterval } from '@sahhti/domain';
import type { Database } from '../db/database.js';
import { ApiError } from '../identity/accounts.js';

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(20),
  cursor: z.string().min(1).max(1024).optional(),
  family: z.enum(['all', 'strength', 'crossfit', 'calisthenics']).default('all'),
});
type Query = z.infer<typeof historyQuerySchema>;
const disciplines = { all: null, strength: ['bodybuilding', 'powerlifting', 'strength'], crossfit: ['crossfit', 'functional_training'], calisthenics: ['calisthenics'] };
const cursorSchema = z.object({ v: z.literal(1), owner: z.string().uuid(), direction: z.enum(['older','newer']), family: historyQuerySchema.shape.family, time: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/), id: z.string().uuid() }).strict();
const columns = 'id, name, discipline, status, scheduled_for, started_at, completed_at, pauses';
const timestamp = (value: unknown) => value == null ? null : value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
function summary(row: Record<string, unknown>) {
  const startedAt = timestamp(row.started_at), completedAt = timestamp(row.completed_at);
  const pauses = (typeof row.pauses === 'string' ? JSON.parse(row.pauses) : row.pauses ?? []) as PauseInterval[];
  return { id: String(row.id), name: String(row.name), discipline: String(row.discipline), status: String(row.status), scheduled_for: timestamp(row.scheduled_for)!, started_at: startedAt, completed_at: completedAt,
    duration_seconds: startedAt === null ? 0 : workoutElapsedSeconds({ startedAt, completedAt, pauses }, completedAt ?? new Date().toISOString()) };
}
export async function listSessionPage(db: Database, userId: string, query: Query) {
  let cursor: z.infer<typeof cursorSchema> | null = null;
  if (query.cursor) {
    try {
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')));
      if (cursor.owner !== userId || cursor.family !== query.family || !Number.isFinite(Date.parse(cursor.time)) || new Date(cursor.time).toISOString().slice(0, 19) !== cursor.time.slice(0, 19)) throw Error('cursor');
    } catch { throw new ApiError(400, 'INVALID_CURSOR', 'History cursor is not valid for this account and filter'); }
  }
  const today = calendarDayInTimeZone(new Date().toISOString(), 'Asia/Riyadh');
  const family = disciplines[query.family];
  const newer = cursor?.direction === 'newer';
  const [page, totals, focus, week] = await Promise.all([
    db.query<Record<string, unknown>>(`SELECT ${columns}, to_char(scheduled_for AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time
      FROM workout_sessions WHERE user_id=$1 AND ($2::text[] IS NULL OR discipline=ANY($2::text[]))
      AND ($3::timestamptz IS NULL OR (scheduled_for,id)${newer ? '>' : '<'}($3::timestamptz,$4::uuid))
      ORDER BY scheduled_for ${newer ? 'ASC' : 'DESC'},id ${newer ? 'ASC' : 'DESC'} LIMIT $5`, [userId,family,cursor?.time ?? null,cursor?.id ?? null,query.limit+1]),
    db.query<Record<string, string>>(`SELECT COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE discipline IN ('bodybuilding','powerlifting','strength'))::text AS strength,
      COUNT(*) FILTER (WHERE discipline IN ('crossfit','functional_training'))::text AS crossfit,
      COUNT(*) FILTER (WHERE discipline='calisthenics')::text AS calisthenics,
      COUNT(*) FILTER (WHERE ($2::text[] IS NULL OR discipline=ANY($2::text[])) AND status='completed')::text AS completed,
      COUNT(*) FILTER (WHERE ($2::text[] IS NULL OR discipline=ANY($2::text[])) AND status IN ('in_progress','paused'))::text AS active,
      COUNT(*) FILTER (WHERE ($2::text[] IS NULL OR discipline=ANY($2::text[])) AND (scheduled_for AT TIME ZONE 'Asia/Riyadh')::date=$3::date)::text AS today
      FROM workout_sessions WHERE user_id=$1`,[userId,family,today]),
    db.query<Record<string, unknown>>(`(SELECT ${columns},'resume' AS kind FROM workout_sessions WHERE user_id=$1 AND status IN ('in_progress','paused') ORDER BY scheduled_for DESC,id DESC LIMIT 1)
      UNION ALL
      (SELECT ${columns},'featured' AS kind FROM workout_sessions WHERE user_id=$1 AND ($2::text[] IS NULL OR discipline=ANY($2::text[])) AND status IN ('in_progress','paused','scheduled')
      ORDER BY CASE WHEN status IN ('in_progress','paused') THEN 0 WHEN (scheduled_for AT TIME ZONE 'Asia/Riyadh')::date >= $3::date THEN 1 ELSE 2 END,
      CASE WHEN status='scheduled' THEN scheduled_for END ASC,scheduled_for DESC,id DESC LIMIT 1)`,[userId,family,today]),
    db.query<{ day: string }>(`SELECT DISTINCT to_char(scheduled_for AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AS day FROM workout_sessions
      WHERE user_id=$1 AND ($2::text[] IS NULL OR discipline=ANY($2::text[]))
      AND scheduled_for >= (($3::date-3)::timestamp AT TIME ZONE 'Asia/Riyadh') AND scheduled_for < (($3::date+4)::timestamp AT TIME ZONE 'Asia/Riyadh') ORDER BY day LIMIT 7`,[userId,family,today]),
  ]);
  const selected = page.rows.slice(0,query.limit), rows = newer ? selected.reverse() : selected;
  const last = rows.at(-1), first = rows[0], overfetch = page.rows.length > query.limit;
  const hasOlder = newer ? Boolean(cursor) : overfetch, hasNewer = newer ? overfetch : Boolean(cursor);
  const encode = (row: Record<string, unknown> | undefined, direction: 'older' | 'newer') => row ? Buffer.from(JSON.stringify({ v:1,owner:userId,family:query.family,direction,time:row.cursor_time,id:row.id })).toString('base64url') : null;
  const counts = totals.rows[0]!;
  const pick = (kind: string) => { const row=focus.rows.find(row=>row.kind===kind); return row ? summary(row) : null; };
  return { sessions: rows.map(summary), pageInfo: { hasMore: hasOlder, nextCursor: hasOlder ? encode(last,'older') : null, previousCursor: hasNewer ? encode(first,'newer') : null },
    resume: pick('resume'), featured: pick('featured'), counts: { all:Number(counts.total),strength:Number(counts.strength),crossfit:Number(counts.crossfit),calisthenics:Number(counts.calisthenics) },
    summary: { today:Number(counts.today),completed:Number(counts.completed),active:Number(counts.active) }, scheduledDays:week.rows.map(row=>row.day) };
}
