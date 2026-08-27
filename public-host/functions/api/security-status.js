function json(data,status=200,origin=''){const h={'content-type':'application/json','cache-control':'no-store','vary':'Origin'};if(origin)h['access-control-allow-origin']=origin;return new Response(JSON.stringify(data),{status,headers:h})}
async function call(env,path,method='GET',body=null,auth=''){
 const h={'apikey':env.SUPABASE_PUBLISHABLE_KEY,'authorization':auth};
 if(body!==null)h['content-type']='application/json';
 const r=await fetch(`${env.SUPABASE_URL}${path}`,{method,headers:h,body:body===null?null:JSON.stringify(body)});
 let data=null;try{data=await r.json()}catch(_){}
 return {ok:r.ok,status:r.status,data};
}
function allowedOrigin(request,env){const origin=request.headers.get('Origin')||'';return env.ADMIN_ORIGIN&&origin===String(env.ADMIN_ORIGIN).replace(/\/+$/,'')?origin:''}
export async function onRequestOptions({request,env}){const origin=allowedOrigin(request,env);if(!origin)return new Response(null,{status:403});return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type','access-control-max-age':'600','vary':'Origin'}})}
export async function onRequestPost({request,env}){const origin=allowedOrigin(request,env);if(request.headers.get('Origin')&&!origin)return json({error:'Origin not allowed'},403,'');
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return json({error:'Host not configured'},503,origin);
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))return json({error:'Unauthorised'},401,origin);
 const user=await call(env,'/auth/v1/user','GET',null,auth);
 if(!user.ok||!user.data?.id)return json({error:'Unauthorised'},401,origin);
 const verified=!!env.TURNSTILE_SECRET_KEY;
 const r=await call(env,'/rest/v1/rpc/local_set_captcha_server_verification','POST',{p_verified:verified},auth);
 if(!r.ok)return json({error:'Could not update verifier state'},400,origin);
 return json({server_verification:verified,security:r.data},200,origin);
}