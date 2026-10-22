const ACCESS = '__Host-traina_admin_access';
const REFRESH = '__Host-traina_admin_refresh';
const routes = {
  overview: ['GET','/v1/admin/overview'], members: ['GET','/v1/admin/members'],
  coaching: ['GET','/v1/admin/coaching'], interests: ['GET','/v1/admin/interests'],
  support: ['GET','/v1/admin/support'], audit: ['GET','/v1/admin/audit'],
  assignments: ['POST','/v1/coach/assignments'], revoke: ['DELETE','/v1/coach/assignments'],
};
function cookies(header='') { return Object.fromEntries(header.split(';').map(p=>{ const i=p.indexOf('='); return i<0?['','']:[p.slice(0,i).trim(),p.slice(i+1)]; })); }
function cookie(name,value,age) { return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
function clear(res) { res.setHeader('set-cookie',[cookie(ACCESS,'',0),cookie(REFRESH,'',0)]); }
function persist(res,tokens) { res.setHeader('set-cookie',[cookie(ACCESS,tokens.accessToken,Math.min(tokens.expiresIn??900,3600)),cookie(REFRESH,tokens.refreshToken,30*86400)]); }

/** Same-origin BFF: browser never receives access/refresh tokens; no arbitrary upstream paths. */
export function createGateway({fetchImpl=fetch,apiOrigin='https://traina-staging-api.vercel.app',origin='https://traina-staging-admin.vercel.app'}={}) {
  if (!/^https:\/\//.test(apiOrigin)) throw new Error('HTTPS upstream required');
  return async function handler(req,res) {
    res.setHeader('cache-control','no-store'); res.setHeader('content-type','application/json'); res.setHeader('x-content-type-options','nosniff');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    const path=new URL(req.url,'https://local.invalid').searchParams.get('path')??'';
    if (req.method!=='GET' && req.headers.origin!==origin) return send(403,{error:{code:'ORIGIN_REJECTED'}});
    let body;
    try { if(typeof req.body==='string')body=JSON.parse(req.body);else body=req.body; } catch {return send(400,{error:{code:'VALIDATION'}});}
    if (Buffer.byteLength(JSON.stringify(body??{}))>8192)return send(413,{error:{code:'BODY_TOO_LARGE'}});
    const call=(method,path,token,payload)=>fetchImpl(apiOrigin+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(15000)});
    try {
      if(path==='login' && req.method==='POST') {
        const response=await call('POST','/v1/auth/login',null,{email:body?.email,password:body?.password});
        if(!response.ok) {clear(res);return send(response.status,{error:{code:'LOGIN_FAILED'}});}
        const tokens=await response.json();
        const check=await call('GET','/v1/admin/overview',tokens.accessToken);
        if(!check.ok){await call('POST','/v1/auth/logout',tokens.accessToken,{}).catch(()=>{});clear(res);return send(check.status,{error:{code:'ADMIN_REQUIRED'}});}
        persist(res,tokens);return send(200,{authenticated:true});
      }
      const stored=cookies(req.headers.cookie); const access=decodeURIComponent(stored[ACCESS]??'');
      if(path==='logout' && req.method==='POST') {
        clear(res); if(access)await call('POST','/v1/auth/logout',access,{}).catch(()=>{});return send(200,{signedOut:true});
      }
      let route=routes[path];
      if (/^(interests|support)\/[0-9a-f-]{36}$/i.test(path))route=['PATCH','/v1/admin/'+path];
      if(!route||req.method!==route[0])return send(404,{error:{code:'NOT_FOUND'}});
      if(!access&&!stored[REFRESH])return send(401,{error:{code:'UNAUTHENTICATED'}});
      const query=new URL(req.url,'https://local.invalid').searchParams;const params=new URLSearchParams();
      for(const key of ['q','offset'])if(query.has(key))params.set(key,query.get(key));
      const upstream=route[1]+(params.size?'?'+params:'');
      let response=await call(route[0],upstream,access,req.method==='GET'?undefined:body);
      if(response.status===401 && stored[REFRESH]) {
        const refresh=await call('POST','/v1/auth/refresh',null,{refreshToken:decodeURIComponent(stored[REFRESH])});
        if(refresh.ok){const tokens=await refresh.json();persist(res,tokens);response=await call(route[0],upstream,tokens.accessToken,req.method==='GET'?undefined:body);}
        else if(refresh.status===401)return send(409,{error:{code:'SESSION_REFRESH_RETRY'}});
        else if(refresh.status===403){clear(res);return send(403,{error:{code:'ADMIN_REQUIRED'}});}
        else return send(503,{error:{code:'UPSTREAM_UNAVAILABLE'}});
      }
      if(response.status===401||response.status===403)clear(res);
      return send(response.status,await response.json());
    }catch{return send(503,{error:{code:'UPSTREAM_UNAVAILABLE'}});}
  };
}
export default createGateway({apiOrigin:process.env.TRAINA_API_ORIGIN,origin:process.env.ADMIN_ORIGIN});
