import { finishWithReconciliation } from '../../../apps/mobile/src/training/completeWorkout.js';
import { ApiClientError } from '../../../apps/mobile/src/api/client.js';
import type { WorkoutSession } from '@sahhti/domain';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, afterAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgliteDatabase, seedDevelopment, type Database } from './db/database.js';
let db: Database, app: FastifyInstance;
beforeAll(async () => { db=await createPgliteDatabase(mkdtempSync(join(tmpdir(),'traina-history-')));await applyMigrationsTo(db);await seedDevelopment(db,'development');app=buildApp({ authMode:'session',database:db,tokenSecret:'synthetic-history-test-secret',mailbox:'outbox',coachProvider:'development_mock' }); },120000);
afterAll(async () => { await app?.close();await db?.close(); });
async function account() {
  const email='history-'+randomUUID()+'@traina.test',password='synthetic-history-password';
  expect((await app.inject({method:'POST',url:'/v1/auth/register',payload:{email,password,locale:'en'}})).statusCode).toBe(201);
  const code=(await db.query<{body:string}>('SELECT body FROM email_outbox WHERE recipient=$1 ORDER BY created_at DESC LIMIT 1',[email])).rows[0]!.body;
  expect((await app.inject({method:'POST',url:'/v1/auth/verify',payload:{email,code}})).statusCode).toBe(200);
  const token=(await app.inject({method:'POST',url:'/v1/auth/login',payload:{email,password}})).json().accessToken as string;
  const userId=(await app.inject({method:'GET',url:'/v1/me',headers:{authorization:'Bearer '+token}})).json().userId as string;
  return {token,userId,email,password};
}
const get=(token:string,query='')=>app.inject({method:'GET',url:'/v1/training/sessions'+query,headers:{authorization:'Bearer '+token}});
for(const size of [100,500,1000]) it(`pages ${size} sessions with bounded payloads, precise ties, backwards navigation and isolated cursors`,async()=>{
  const a=await account(),b=await account();
  await db.query(`INSERT INTO workout_sessions (user_id,name,discipline,status,planned_exercises,scheduled_for,started_at,completed_at,pauses)
    SELECT $1,'Synthetic history','powerlifting','completed','[]'::jsonb,'2026-10-01 00:00:00.123456Z','2026-10-01','2026-10-01 01:00:00Z','[]'::jsonb FROM generate_series(1,$2::int)`,[a.userId,size]);
  await db.query(`INSERT INTO workout_sessions (user_id,name,discipline,status,planned_exercises,scheduled_for,started_at,pauses) VALUES
    ($1,'Old active','powerlifting','in_progress','[]'::jsonb,'2020-01-01','2020-01-01','[]'::jsonb),
    ($1,'Future','powerlifting','scheduled','[]'::jsonb,'2050-01-01',NULL,'[]'::jsonb)`,[a.userId]);
  const response=await get(a.token,'?limit=20');expect(response.statusCode).toBe(200);const first=response.json();
  expect(first.sessions).toHaveLength(20);expect(response.rawPayload.byteLength).toBeLessThan(16000);expect(first.counts.all).toBe(size+2);expect(first.summary.completed).toBe(size);expect(first.resume.name).toBe('Old active');expect(first.featured.name).toBe('Old active');
  const seen=new Set<string>();let page=first,pages=0;
  while(true){expect(page.sessions.length).toBeLessThanOrEqual(20);for(const row of page.sessions){expect(seen.has(row.id)).toBe(false);seen.add(row.id);}pages++;if(!page.pageInfo.nextCursor)break;const r=await get(a.token,'?limit=20&cursor='+page.pageInfo.nextCursor);expect(r.statusCode).toBe(200);page=r.json();}
  expect(seen.size).toBe(size+2);expect(pages).toBe(Math.ceil((size+2)/20));
  const second=(await get(a.token,'?limit=20&cursor='+first.pageInfo.nextCursor)).json();
  const back=(await get(a.token,'?limit=20&cursor='+second.pageInfo.previousCursor)).json();expect(back.sessions.map((row:{id:string})=>row.id)).toEqual(first.sessions.map((row:{id:string})=>row.id));
  expect((await get(b.token,'?limit=20&cursor='+first.pageInfo.nextCursor)).statusCode).toBe(400);
  expect((await get(a.token,'?limit=20&family=crossfit&cursor='+first.pageInfo.nextCursor)).statusCode).toBe(400);
  const empty=(await get(b.token)).json();expect(empty.sessions).toEqual([]);expect(empty.resume).toBeNull();expect(empty.counts.all).toBe(0);
  const filtered=(await get(a.token,'?family=crossfit')).json();expect(filtered.sessions).toEqual([]);expect(filtered.summary.completed).toBe(0);expect(filtered.featured).toBeNull();
},30000);
it('rejects malformed pagination and requires authentication',async()=>{
  const a=await account();for(const query of ['?limit=0','?limit=41','?limit=-1','?limit=abc','?family=invalid','?cursor=not-json'])expect((await get(a.token,query)).statusCode).toBe(400);
  expect((await app.inject({method:'GET',url:'/v1/training/sessions'})).statusCode).toBe(401);
});

it('consumes a refresh token exactly once under concurrent serverless-style requests',async()=>{
  const a=await account();const login=(await app.inject({method:'POST',url:'/v1/auth/login',payload:{email:a.email,password:a.password}})).json();
  const replies=await Promise.all(Array.from({length:4},()=>app.inject({method:'POST',url:'/v1/auth/refresh',payload:{refreshToken:login.refreshToken}})));
  expect(replies.filter(r=>r.statusCode===200)).toHaveLength(1);expect(replies.filter(r=>r.statusCode===401)).toHaveLength(3);
  const winner=replies.find(r=>r.statusCode===200)!.json();
  expect((await app.inject({method:'GET',url:'/v1/me',headers:{authorization:'Bearer '+winner.accessToken}})).statusCode).toBe(200);
  expect((await app.inject({method:'GET',url:'/v1/me',headers:{authorization:'Bearer '+login.accessToken}})).statusCode).toBe(401);
});

it('preserves edited sets, pause duration and results after a lost completion response, replay and server restart',async()=>{
  const a=await account(),other=await account(),exerciseId='10000000-0000-4000-8000-000000000001';
  const request=async(method:'POST'|'PUT'|'GET',url:string,payload?:unknown)=>{const r=await app.inject({method,url,headers:{authorization:'Bearer '+a.token},...(payload?{payload}: {})});expect(r.statusCode).toBe(200);return r.json();};
  const create=async(day:string)=>{
    const r=await app.inject({method:'POST',url:'/v1/training/sessions',headers:{authorization:'Bearer '+a.token},payload:{name:'Synthetic closure',discipline:'powerlifting',scheduledFor:day+'T10:00:00Z',exercises:[{exerciseId,prescription:{kind:'strength',sets:3,reps:8,restSeconds:60,loadGrams:20000,rpeTenths:null}}]}});expect(r.statusCode).toBe(200);
    const id=r.json().session.id as string;await request('POST','/v1/training/sessions/'+id+'/start',{at:day+'T10:00:00Z'});return id;
  };
  const baseline=await create('2026-10-01');await request('POST','/v1/training/sessions/'+baseline+'/sets',{id:randomUUID(),exerciseId,setIndex:1,reps:8,loadGrams:20000,rpeTenths:null,completedAt:'2026-10-01T10:01:00Z'});await request('POST','/v1/training/sessions/'+baseline+'/complete',{at:'2026-10-01T10:10:00Z'});
  const initial=await request('GET','/v1/training/sessions/'+baseline+'/results');expect(initial.improvements).toEqual([]);expect(initial.firstRecorded).toHaveLength(1);
  const id=await create('2026-10-02'),prefix='/v1/training/sessions/'+id;
  const body={id:randomUUID(),exerciseId,setIndex:1,reps:8,loadGrams:20000,rpeTenths:null,completedAt:'2026-10-02T10:01:00Z'};
  await Promise.all([request('POST',prefix+'/sets',body),request('POST',prefix+'/sets',body)]);
  await request('POST',prefix+'/sets',{...body,id:randomUUID(),setIndex:2});
  const before=(await request('GET',prefix)).session as WorkoutSession;expect(before.sets).toHaveLength(2);
  await request('PUT',prefix+'/sets/'+body.id,{...body,reps:10,loadGrams:25000,expectedSet:before.sets.find(set=>set.id===body.id)});
  await request('POST',prefix+'/pause',{at:'2026-10-02T10:02:00Z'});await request('POST',prefix+'/resume',{at:'2026-10-02T10:04:00Z'});
  let committed=false;
  const finished=await finishWithReconciliation(async()=>{await request('POST',prefix+'/complete',{at:'2026-10-02T10:10:00Z'});committed=true;throw new ApiClientError(0,'TIMEOUT','Synthetic discarded response after commit');},async()=>request('GET',prefix));
  expect(committed).toBe(true);expect(finished.session.status).toBe('completed');expect(finished.session.sets).toHaveLength(2);
  const replay=await request('POST',prefix+'/complete',{at:'2026-10-02T10:11:00Z'});expect(replay.session.completedAt).toBe(finished.session.completedAt);
  const results=await request('GET',prefix+'/results');expect(results.summary).toMatchObject({sets:2,exercises:1,durationSeconds:480,volumeGrams:410000});expect(results.improvements).toHaveLength(1);expect(results.improvements[0]).toMatchObject({loadGrams:25000,reps:10,previous:{loadGrams:20000,reps:8}});
  expect((await app.inject({method:'GET',url:prefix+'/results',headers:{authorization:'Bearer '+other.token}})).statusCode).toBe(404);
  await app.close();app=buildApp({authMode:'session',database:db,tokenSecret:'synthetic-history-test-secret',mailbox:'outbox',coachProvider:'development_mock'});
  expect((await request('GET',prefix)).session).toEqual(finished.session);expect(await request('GET',prefix+'/results')).toEqual(results);
},30000);
