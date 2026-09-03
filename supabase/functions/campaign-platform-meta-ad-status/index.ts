import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization")||"",url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,user=createClient(url,anon,{global:{headers:{Authorization:auth}}}),db=createClient(url,service),body=await req.json(),rolloutId=String(body.rollout_id||""),siteId=String(body.site_id||""),status=String(body.status||"PAUSED").toUpperCase();
  if(!rolloutId||!siteId||!["ACTIVE","PAUSED"].includes(status))return json({error:"rollout_id, site_id and ACTIVE/PAUSED status required"},400);
  const {data:ctx,error}=await user.rpc("org_admin_central_campaign_rollout",{p_rollout:rolloutId});if(error||!ctx?.rollout)return json({error:"Not authorised"},403);const orgId=String(ctx.rollout.organisation_id||""),{data:isGlobal}=await user.rpc("is_org_global_admin",{p_org:orgId});if(!isGlobal)return json({error:"Global admin required"},403);
  const {data:conn}=await db.from("central_campaign_meta_connections").select("access_token,graph_version").eq("rollout_id",rolloutId).maybeSingle();if(!conn)return json({error:"Connect Meta first"},400);
  const {data:assets}=await db.from("central_campaign_meta_assets").select("ad_id").eq("rollout_id",rolloutId).eq("site_id",siteId).not("ad_id","is",null);let updated=0;for(const a of assets||[]){const b=new URLSearchParams({access_token:String(conn.access_token),status}),r=await fetch(`https://graph.facebook.com/${conn.graph_version||"v26.0"}/${a.ad_id}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:b}),d=await r.json();if(!r.ok||d.error)throw new Error(d?.error?.message||`Meta ad status ${r.status}`);updated++}
  return json({ok:true,status,updated});
 }catch(e){return json({error:e instanceof Error?e.message:String(e)},500)}
});
