import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Database } from '../db/database.js';
import { ApiError } from '../identity/accounts.js';
import { allowAuthAttempt } from '../identity/shared-throttle.js';

function validated<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError(400, 'VALIDATION', 'Check the submitted fields');
  return result.data;
}
const page = z.object({ offset: z.coerce.number().int().min(0).max(10000).default(0), q: z.string().trim().max(80).default('') });
const uuid = z.object({ id: z.string().uuid() });

export function registerAdminRoutes(app: FastifyInstance, database: Database | null) {
  function db() { if (!database) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'Database unavailable'); return database; }
  function admin(request: FastifyRequest) {
    if (!request.claims?.roles.includes('admin')) throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
    return request.claims.sub;
  }
  app.post('/v1/public/interest', { bodyLimit: 4096 }, async (request, reply) => {
    const body = validated(z.object({ email: z.string().trim().email().max(254), name: z.string().trim().min(1).max(80), goal: z.enum(['strength','fitness','nutrition']), locale: z.enum(['ar','en']), consent: z.literal(true) }).strict(), request.body);
    if (!(await allowAuthAttempt(db(), 'website-interest-email', body.email.toLowerCase(), 3, 3600000)) || !(await allowAuthAttempt(db(), 'website-interest-source', request.ip, 250, 3600000))) throw new ApiError(429, 'RATE_LIMITED', 'Please try again later');
    await db().query(`INSERT INTO website_interests (email,name,goal,locale) VALUES ($1,$2,$3,$4) ON CONFLICT (lower(email)) DO NOTHING`, [body.email.toLowerCase(),body.name,body.goal,body.locale]);
    return reply.code(202).send({ accepted: true });
  });
  app.get('/v1/admin/overview', async request => {
    admin(request);
    const counts = await db().query(`SELECT
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS members,
      (SELECT count(*)::int FROM users WHERE status='active' AND deleted_at IS NULL) AS active_members,
      (SELECT count(*)::int FROM workout_sessions WHERE status='completed' AND completed_at >= now()-interval '30 days') AS completed_workouts_30d,
      (SELECT count(*)::int FROM programs WHERE active=true AND archived_at IS NULL) AS active_programs,
      (SELECT count(*)::int FROM weekly_review_queue WHERE status NOT IN ('FEEDBACK_SENT','ACKNOWLEDGED')) AS pending_reviews,
      (SELECT count(*)::int FROM website_interests WHERE status='new') AS new_interests,
      (SELECT count(*)::int FROM support_tickets WHERE status IN ('open','pending')) AS open_tickets`);
    const trend = await db().query(`SELECT (completed_at AT TIME ZONE 'Asia/Riyadh')::date::text AS day, count(*)::int AS count FROM workout_sessions WHERE status='completed' AND completed_at >= now()-interval '14 days' GROUP BY 1 ORDER BY 1`);
    return { metrics: counts.rows[0], workoutTrend: trend.rows, asOf: new Date().toISOString(), environment: process.env.SAHHTI_ENVIRONMENT ?? 'unspecified', purchasesEnabled: false };
  });
  app.get('/v1/admin/members', async request => {
    admin(request); const query = validated(page, request.query);
    const result = await db().query(`SELECT u.id,u.email,u.status,u.created_at,p.display_name,
      ARRAY(SELECT r.role FROM role_assignments r WHERE r.user_id=u.id ORDER BY r.role) AS roles,
      (SELECT count(*)::int FROM workout_sessions w WHERE w.user_id=u.id AND w.status='completed') AS completed_workouts
      FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id
      WHERE u.deleted_at IS NULL AND ($1='' OR strpos(lower(coalesce(u.email,'')||' '||coalesce(p.display_name,'')),lower($1))>0)
      ORDER BY u.created_at DESC,u.id LIMIT 51 OFFSET $2`, [query.q,query.offset]);
    return { members: result.rows.slice(0,50), hasMore: result.rows.length>50, nextOffset: query.offset+50 };
  });
  app.get('/v1/admin/coaching', async request => {
    admin(request);
    const coaches = await db().query(`SELECT u.id,p.display_name,u.email FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.status='active' AND u.deleted_at IS NULL AND EXISTS (SELECT 1 FROM role_assignments r WHERE r.user_id=u.id AND r.role IN ('coach_reviewer','admin')) ORDER BY u.created_at LIMIT 100`);
    const reviews = await db().query(`SELECT id,member_user_id,coach_user_id,status,week_of,updated_at FROM weekly_review_queue ORDER BY updated_at DESC,id LIMIT 50`);
    const assignments = await db().query(`SELECT coach_user_id,member_user_id,assigned_at FROM coach_member_assignments WHERE active=true ORDER BY assigned_at DESC LIMIT 100`);
    return { coaches: coaches.rows, reviews: reviews.rows, assignments: assignments.rows };
  });
  app.get('/v1/admin/interests', async request => {
    admin(request); const query = validated(page, request.query);
    const result = await db().query(`SELECT id,name,email,goal,status,locale,consent_version,created_at FROM website_interests ORDER BY created_at DESC,id LIMIT 51 OFFSET $1`, [query.offset]);
    return { interests: result.rows.slice(0,50), hasMore: result.rows.length>50, nextOffset:query.offset+50 };
  });
  app.patch('/v1/admin/interests/:id', async request => {
    const actor = admin(request); const { id }=validated(uuid,request.params);
    const body=validated(z.object({status:z.enum(['new','contacted','closed']),expectedStatus:z.enum(['new','contacted','closed'])}).strict(),request.body);
    return db().transaction(async tx => {
      const result=await tx.query(`UPDATE website_interests SET status=$1 WHERE id=$2 AND status=$3 RETURNING id,status`,[body.status,id,body.expectedStatus]);
      if(!result.rowCount) throw new ApiError(409,'CONFLICT','Refresh before changing this interest');
      await tx.query(`INSERT INTO audit_logs (actor_user_id,action,resource_type,resource_id) VALUES ($1,$2,'website_interest',$3)`,[actor,'interest.'+body.status,id]);
      return { interest:result.rows[0] };
    });
  });
  app.get('/v1/admin/support',async request=>{
    admin(request); const query=validated(page,request.query);
    const result=await db().query(`SELECT id,user_id,status,priority,subject,created_at FROM support_tickets ORDER BY created_at DESC,id LIMIT 51 OFFSET $1`,[query.offset]);
    return {tickets:result.rows.slice(0,50),hasMore:result.rows.length>50,nextOffset:query.offset+50};
  });
  app.patch('/v1/admin/support/:id',async request=>{
    const actor=admin(request); const {id}=validated(uuid,request.params);
    const body=validated(z.object({status:z.enum(['open','pending','resolved','closed']),expectedStatus:z.enum(['open','pending','resolved','closed'])}).strict(),request.body);
    return db().transaction(async tx=>{
      const result=await tx.query(`UPDATE support_tickets SET status=$1 WHERE id=$2 AND status=$3 RETURNING id,status`,[body.status,id,body.expectedStatus]);
      if(!result.rowCount)throw new ApiError(409,'CONFLICT','Refresh before changing this ticket');
      await tx.query(`INSERT INTO audit_logs (actor_user_id,action,resource_type,resource_id) VALUES ($1,$2,'support_ticket',$3)`,[actor,'support.'+body.status,id]);
      return {ticket:result.rows[0]};
    });
  });
  app.get('/v1/admin/audit',async request=>{
    admin(request);const query=validated(page,request.query);
    const result=await db().query(`SELECT id,actor_user_id,action,resource_type,resource_id,created_at FROM audit_logs ORDER BY created_at DESC,id LIMIT 51 OFFSET $1`,[query.offset]);
    return {events:result.rows.slice(0,50),hasMore:result.rows.length>50,nextOffset:query.offset+50};
  });
}
