export default async function handler(req,res) {
  res.setHeader('cache-control','no-store');res.setHeader('content-type','application/json');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  if(req.method!=='POST')return send(405,{error:{code:'METHOD_NOT_ALLOWED'}});
  if(req.headers.origin!==(process.env.WEBSITE_ORIGIN??'https://traina-staging-www.vercel.app'))return send(403,{error:{code:'ORIGIN_REJECTED'}});
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return send(400,{error:{code:'VALIDATION'}});}
  if(Buffer.byteLength(JSON.stringify(body??{}))>4096)return send(413,{error:{code:'BODY_TOO_LARGE'}});
  try{
    const response=await fetch((process.env.TRAINA_API_ORIGIN??'https://traina-staging-api.vercel.app')+'/v1/public/interest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    return send(response.status,await response.json());
  }catch{return send(503,{error:{code:'SERVICE_UNAVAILABLE'}});}
}
