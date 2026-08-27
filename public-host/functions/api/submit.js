const ALLOWED_RPCS=new Set([
  'public_submit_survey_attributed',
  'public_capture_action_attributed',
  'public_capture_campaign_action_attributed'
]);
function json(data,status=200){
 return new Response(JSON.stringify(data),{status,headers:{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer'
 }});
}
async function supabaseRpc(env,name,body,authorization){
 const key=env.SUPABASE_PUBLISHABLE_KEY;
 const url=env.SUPABASE_URL;
 const r=await fetch(`${url}/rest/v1/rpc/${name}`,{
  method:'POST',
  headers:{'content-type':'application/json','apikey':key,'authorization':authorization||`Bearer ${key}`},
  body:JSON.stringify(body||{})
 });
 let data=null;try{data=await r.json()}catch(_){}
 return {ok:r.ok,status:r.status,data};
}
async function publicConfig(env,rpc,params,host){
 let entityType='website',identifier=params?.p_website_id||null;
 if(rpc==='public_capture_campaign_action_attributed'){entityType='campaign';identifier=params?.p_campaign_id||null}
 if(!identifier)return null;
 const r=await supabaseRpc(env,'public_privacy_config',{p_entity_type:entityType,p_identifier:String(identifier),p_hostname:host||null});
 return r.ok?r.data:null;
}
async function verifyTurnstile(env,token,ip){
 if(!env.TURNSTILE_SECRET_KEY)return {success:false,error_codes:['secret-not-configured']};
 const body={secret:env.TURNSTILE_SECRET_KEY,response:token||''};
 if(ip)body.remoteip=ip;
 const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
 });
 try{return await r.json()}catch(_){return {success:false,error_codes:['invalid-response']}}
}
export async function onRequestPost(context){
 const {request,env}=context;
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return json({error:'Public host is not configured.'},503);
 let body;try{body=await request.json()}catch(_){return json({error:'Invalid request.'},400)}
 if(!ALLOWED_RPCS.has(body?.rpc))return json({error:'Invalid request.'},400);
 if(JSON.stringify(body?.params||{}).length>100000)return json({error:'Request too large.'},413);
 const cfg=await publicConfig(env,body.rpc,body.params,new URL(request.url).hostname);
 if(!cfg)return json({error:'Campaign page is not available.'},404);
 const captcha=cfg?.security?.captcha||{};
 if(captcha.enabled){
  if(!captcha.server_verification)return json({error:'Verification is not configured.'},503);
  const verified=await verifyTurnstile(env,body.turnstile_token,request.headers.get('CF-Connecting-IP'));
  if(!verified?.success)return json({error:'Please complete the verification and try again.'},403);
 }
 const result=await supabaseRpc(env,body.rpc,body.params);
 if(!result.ok){
  const msg=String(result.data?.message||'');
  const status=/too many requests/i.test(msg)?429:400;
  return json({error:status===429?'Too many requests. Please try again later.':'We could not complete that request.'},status);
 }
 return json({data:result.data},200);
}
