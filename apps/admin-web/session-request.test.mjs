import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSessionTransport} from './session-request.mjs';
test('serializes requests across tabs sharing Web Locks',async()=>{
  let lockTail=Promise.resolve(),active=0,maximum=0;
  const locks={request:(_name,work)=>{const next=lockTail.then(work);lockTail=next.catch(()=>{});return next;}};
  const fetchImpl=async()=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return new Response('{}');};
  const a=createSessionTransport({fetchImpl,locks}),b=createSessionTransport({fetchImpl,locks});await Promise.all([a('/api/a'),b('/api/b')]);assert.equal(maximum,1);
});
test('retries a stale refresh-cookie race without retrying business conflicts',async()=>{
  let calls=0;const run=createSessionTransport({locks:null,wait:async()=>{},fetchImpl:async()=>++calls===1?new Response('{"error":{"code":"SESSION_REFRESH_RETRY"}}',{status:409}):new Response('{}')});
  assert.equal((await run('/api/a')).status,200);assert.equal(calls,2);
  calls=0;const conflict=createSessionTransport({locks:null,fetchImpl:async()=>{calls++;return new Response('{"error":{"code":"CONFLICT"}}',{status:409});}});assert.equal((await conflict('/api/a')).status,409);assert.equal(calls,1);
});
