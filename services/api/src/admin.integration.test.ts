import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { buildApp } from './app.js';
import { applyMigrationsTo, createPgliteDatabase, type Database } from './db/database.js';
import { startSession } from './identity/accounts.js';
import type { FastifyInstance } from 'fastify';

describe('admin workspace and public website persistence',()=>{
  let db:Database,app:FastifyInstance,adminToken:string,memberToken:string,adminId:string;
  beforeAll(async()=>{
    db=await createPgliteDatabase('memory://');await applyMigrationsTo(db);
    adminId=randomUUID();const memberId=randomUUID();
    await db.query(`INSERT INTO users (id,email,status) VALUES ($1,'synthetic.admin@traina.test','active'),($2,'synthetic.member@traina.test','active')`,[adminId,memberId]);
    await db.query(`INSERT INTO role_assignments (user_id,role) VALUES ($1,'admin'),($2,'member')`,[adminId,memberId]);
    adminToken=(await startSession(db,'synthetic-admin-test-secret',adminId)).accessToken;
    memberToken=(await startSession(db,'synthetic-admin-test-secret',memberId)).accessToken;
    app=buildApp({database:db,tokenSecret:'synthetic-admin-test-secret',authMode:'session'});
  },120000);
  afterAll(async()=>{await app?.close();await db?.close();});
  const headers=()=>({authorization:'Bearer '+adminToken});
  it('denies anonymous and ordinary-member access on every read',async()=>{
    for(const path of ['overview','members','coaching','interests','support','audit']){
      expect((await app.inject({url:'/v1/admin/'+path})).statusCode).toBe(401);
      expect((await app.inject({url:'/v1/admin/'+path,headers:{authorization:'Bearer '+memberToken}})).statusCode).toBe(403);
    }
  });
  it('requires consent, persists a lead exactly once, and audits a conflict-safe follow-up',async()=>{
    const body={email:'Interest@traina.test',name:'Synthetic interest',goal:'strength',locale:'ar',consent:true};
    expect((await app.inject({method:'POST',url:'/v1/public/interest',payload:{...body,consent:false}})).statusCode).toBe(400);
    for(const email of [body.email,body.email.toLowerCase()])expect((await app.inject({method:'POST',url:'/v1/public/interest',payload:{...body,email}})).statusCode).toBe(202);
    const list=await app.inject({url:'/v1/admin/interests',headers:headers()});expect(list.statusCode).toBe(200);expect(list.json().interests).toHaveLength(1);
    const id=list.json().interests[0].id;
    expect((await app.inject({method:'PATCH',url:'/v1/admin/interests/'+id,headers:{authorization:'Bearer '+memberToken},payload:{status:'closed',expectedStatus:'new'}})).statusCode).toBe(403);
    expect((await app.inject({method:'PATCH',url:'/v1/admin/interests/'+id,headers:headers(),payload:{status:'contacted',expectedStatus:'new'}})).statusCode).toBe(200);
    expect((await app.inject({method:'PATCH',url:'/v1/admin/interests/'+id,headers:headers(),payload:{status:'closed',expectedStatus:'new'}})).statusCode).toBe(409);
    const audit=await app.inject({url:'/v1/admin/audit',headers:headers()});expect(audit.json().events).toEqual(expect.arrayContaining([expect.objectContaining({action:'interest.contacted',actor_user_id:adminId})]));
  });
  it('returns actual counts and bounded searchable members without credentials or health data',async()=>{
    const overview=await app.inject({url:'/v1/admin/overview',headers:headers()});expect(overview.statusCode).toBe(200);expect(overview.json().metrics).toMatchObject({members:2,active_members:2,new_interests:0});
    const members=await app.inject({url:'/v1/admin/members?q=synthetic.member',headers:headers()});expect(members.json().members).toHaveLength(1);expect(JSON.stringify(members.json())).not.toMatch(/password|injuries|allergies|token/);
    expect((await app.inject({url:'/v1/admin/members?offset=-1',headers:headers()})).statusCode).toBe(400);
    expect((await app.inject({url:'/v1/admin/members?q=%27%20OR%201%3D1',headers:headers()})).json().members).toHaveLength(0);
    expect((await app.inject({url:'/v1/admin/coaching',headers:headers()})).json().coaches).toHaveLength(1);
  });
  it('updates support with an audit and immediately honors revoked administrator roles',async()=>{
    const id=randomUUID();await db.query(`INSERT INTO support_tickets (id,user_id,status,priority,subject) VALUES ($1,$2,'open','normal','Synthetic ticket')`,[id,adminId]);
    expect((await app.inject({method:'PATCH',url:'/v1/admin/support/'+id,headers:headers(),payload:{status:'resolved',expectedStatus:'open'}})).statusCode).toBe(200);
    expect((await app.inject({method:'PATCH',url:'/v1/admin/support/'+id,headers:headers(),payload:{status:'closed',expectedStatus:'open'}})).statusCode).toBe(409);
    await db.query(`DELETE FROM role_assignments WHERE user_id=$1 AND role='admin'`,[adminId]);
    expect((await app.inject({url:'/v1/admin/overview',headers:headers()})).statusCode).toBe(403);
  });
});
