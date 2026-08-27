function json(data,status=200,origin=''){const h={'content-type':'application/json','cache-control':'no-store','vary':'Origin'};if(origin)h['access-control-allow-origin']=origin;return new Response(JSON.stringify(data),{status,headers:h})}
function allowedOrigin(request,env){const origin=request.headers.get('Origin')||'';return env.ADMIN_ORIGIN&&origin===String(env.ADMIN_ORIGIN).replace(/\/+$/,'')?origin:''}
async function sb(env,path,method='GET',body=null,auth=''){
 const h={'apikey':env.SUPABASE_PUBLISHABLE_KEY,'authorization':auth};if(body!==null)h['content-type']='application/json';
 const r=await fetch(`${env.SUPABASE_URL}${path}`,{method,headers:h,body:body===null?null:JSON.stringify(body)});
 let data=null;try{data=await r.json()}catch(_){}
 return {ok:r.ok,data,status:r.status};
}
export async function onRequestOptions({request,env}){const origin=allowedOrigin(request,env);if(!origin)return new Response(null,{status:403});return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type','access-control-max-age':'600','vary':'Origin'}})}
export async function onRequestPost({request,env}){
 const origin=allowedOrigin(request,env);if(request.headers.get('Origin')&&!origin)return json({error:'Origin not allowed'},403);
 if(!env.CLOUDFLARE_API_TOKEN||!env.CLOUDFLARE_ACCOUNT_ID||!env.CLOUDFLARE_PAGES_PROJECT)return json({error:'Cloudflare domain automation is not configured.'},503,origin);
 const auth=request.headers.get('authorization')||'';const user=await sb(env,'/auth/v1/user','GET',null,auth);if(!user.ok||!user.data?.id)return json({error:'Unauthorised'},401,origin);
 let body;try{body=await request.json()}catch(_){return json({error:'Invalid request'},400,origin)}
 const domainId=String(body?.domain_id||'');if(!/^[0-9a-f-]{36}$/i.test(domainId))return json({error:'Invalid domain'},400,origin);
 const domains=await sb(env,'/rest/v1/rpc/local_domains_detail','POST',{},auth);const d=(domains.data||[]).find(x=>x.id===domainId);if(!d)return json({error:'Domain not found'},404,origin);
 const cf=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${encodeURIComponent(env.CLOUDFLARE_PAGES_PROJECT)}/domains/${encodeURIComponent(d.hostname)}`,{headers:{'authorization':`Bearer ${env.CLOUDFLARE_API_TOKEN}`}});
 const result=await cf.json();if(!cf.ok||result?.success===false)return json({error:'Cloudflare domain status could not be loaded.'},400,origin);
 const state=result.result||{},active=state.status==='active';
 if(active)await sb(env,'/rest/v1/rpc/local_domain_verify_result','POST',{p_domain_id:d.id,p_ownership_verified:true,p_routing_verified:true,p_error:null,p_ssl_status:'active'},auth);
 return json({domain:state,active},200,origin);
}