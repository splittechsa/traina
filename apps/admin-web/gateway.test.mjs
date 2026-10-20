import {test} from 'node:test';import assert from 'node:assert/strict';
import {createGateway} from './api/gateway.mjs';
const origin='https://traina-staging-admin.vercel.app';
async function request(handler,path,method='GET',body,headers={}){let result;const stored={};const res={setHeader:(k,v)=>stored[k]=v,end:s=>result=JSON.parse(s)};await handler({url:'/api/gateway?path='+path,method,body,headers:{origin,...headers}},res);return {status:res.statusCode,body:result,headers:stored};}
test('rejects foreign-origin mutations and arbitrary upstream access',async()=>{
  const handler=createGateway({fetchImpl:()=>{throw Error('must not call');}});
  assert.equal((await request(handler,'login','POST',{}, {origin:'https://attacker.test'})).status,403);
  assert.equal((await request(handler,'https://attacker.test')).status,404);
  assert.equal((await request(handler,'members')).status,401);
});
test('login returns no tokens, sets secure HTTP-only cookies, and enforces admin role',async()=>{
  const calls=[];const handler=createGateway({fetchImpl:async(url,init)=>{calls.push([url,init]);return new Response(JSON.stringify(url.endsWith('/login')?{accessToken:'test-access',refreshToken:'test-refresh',expiresIn:900}:{metrics:{}}));}});
  const r=await request(handler,'login','POST',{email:'test@traina.test',password:'synthetic-password'});assert.equal(r.status,200);assert.deepEqual(r.body,{authenticated:true});assert.ok(r.headers['set-cookie'].every(v=>v.includes('HttpOnly; Secure; SameSite=Strict')));assert.equal(calls.length,2);assert.equal(calls[1][1].headers.authorization,'Bearer test-access');
  const denied=createGateway({fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/login')?{accessToken:'member',refreshToken:'refresh'}:{}),{status:url.endsWith('/overview')?403:200})});
  assert.equal((await request(denied,'login','POST',{})).status,403);
});
test('logout clears cookies even when upstream is unavailable',async()=>{
  const handler=createGateway({fetchImpl:async()=>{throw Error('offline');}});const result=await request(handler,'logout','POST',{}, {cookie:'__Host-traina_admin_access=test'});assert.equal(result.status,200);assert.ok(result.headers['set-cookie'].every(v=>v.includes('Max-Age=0')));
});
test('refresh rotates only server cookies and forwards bounded routes',async()=>{
  let calls=0;const handler=createGateway({fetchImpl:async(url,init)=>{calls++;if(url.endsWith('/refresh'))return new Response(JSON.stringify({accessToken:'new',refreshToken:'rotated'}));return new Response(JSON.stringify({members:[]}),{status:init.headers.authorization==='Bearer new'?200:401});}});
  const result=await request(handler,'members','GET',undefined,{cookie:'__Host-traina_admin_access=old; __Host-traina_admin_refresh=refresh'});assert.equal(result.status,200);assert.deepEqual(result.body,{members:[]});assert.equal(calls,3);assert.ok(result.headers['set-cookie'][1].includes('rotated'));
});
test('can renew after the short-lived access cookie expires',async()=>{
  const handler=createGateway({fetchImpl:async(url,init)=>url.endsWith('/refresh')?new Response(JSON.stringify({accessToken:'renewed',refreshToken:'rotated'})):new Response(JSON.stringify({metrics:{}}),{status:init.headers.authorization==='Bearer renewed'?200:401})});
  assert.equal((await request(handler,'overview','GET',undefined,{cookie:'__Host-traina_admin_refresh=valid-refresh'})).status,200);
});
