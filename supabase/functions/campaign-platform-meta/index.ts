import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const VERSION="v26.0";
const GRAPH=`https://graph.facebook.com/${VERSION}`;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json"}});
const cleanAct=(v:string)=>String(v||"").trim().replace(/^act_/i,"");
const num=(v:any)=>Number(v||0)||0;
const norm=(v:string)=>String(v||"").normalize("NFKD").replace(/[^a-zA-Z0-9]/g,"").toLowerCase();

function fill(pattern:string,campaign:string,site:any){
  return String(pattern||"")
    .replaceAll("{{campaign}}",campaign||"Campaign")
    .replaceAll("{{area}}",site?.area||"")
    .replaceAll("{{slug}}",site?.slug||"")
    .replace(/\s*\|\s*\|\s*/g," | ")
    .replace(/^\s*\|\s*|\s*\|\s*$/g,"")
    .trim();
}
function fillUrl(pattern:string,campaign:string,site:any){
  return String(pattern||"")
    .replaceAll("{{campaign}}",encodeURIComponent(campaign||"Campaign"))
    .replaceAll("{{area}}",encodeURIComponent(site?.area||""))
    .replaceAll("{{slug}}",site?.slug||"");
}
async function graphGet(path:string,token:string,params:Record<string,string>={}){
  const u=new URL(`${GRAPH}/${path.replace(/^\//,"")}`);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  u.searchParams.set("access_token",token);
  const r=await fetch(u),d=await r.json();
  if(!r.ok||d.error) throw new Error(d?.error?.message||`Meta API ${r.status}`);
  return d;
}
async function graphPost(path:string,token:string,params:Record<string,string>={}){
  const b=new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>b.set(k,v));
  b.set("access_token",token);
  const r=await fetch(`${GRAPH}/${path.replace(/^\//,"")}`,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:b
  }),d=await r.json();
  if(!r.ok||d.error){
    throw new Error(`${d?.error?.message||`Meta API ${r.status}`}${d?.error?.error_user_title?` — ${d.error.error_user_title}`:""}${d?.error?.error_user_msg?` — ${d.error.error_user_msg}`:""}${d?.error?.code?` [code ${d.error.code}${d.error.error_subcode?`/${d.error.error_subcode}`:""}]`:""}`);
  }
  return d;
}
async function allAudiences(account:string,token:string){
  let next=`${GRAPH}/act_${account}/customaudiences?fields=id,name&limit=200&access_token=${encodeURIComponent(token)}`;
  const out:any[]=[]; let guard=0;
  while(next&&guard++<30){
    const r=await fetch(next),d=await r.json();
    if(!r.ok||d.error) throw new Error(d?.error?.message||`Meta audience lookup failed (${r.status})`);
    out.push(...(d.data||[]));
    next=d.paging?.next||"";
  }
  return out;
}
function bytesFromDataUrl(v:string){
  const raw=atob(v.includes(",")?v.split(",").pop()!:v);
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}
async function uploadImage(account:string,token:string,raw:Uint8Array,name:string,mime:string){
  const f=new FormData();
  f.append("access_token",token);
  f.append("filename",new Blob([raw],{type:mime||"image/jpeg"}),name);
  const r=await fetch(`${GRAPH}/act_${account}/adimages`,{method:"POST",body:f}),d=await r.json();
  if(!r.ok||d.error) throw new Error(d?.error?.message||`Meta image upload ${r.status}`);
  const x=Object.values(d.images||{})[0] as any;
  if(!x?.hash) throw new Error("Meta did not return image hash");
  return String(x.hash);
}
async function uploadVideo(account:string,token:string,raw:Uint8Array,name:string,mime:string){
  const f=new FormData();
  f.append("access_token",token);
  f.append("source",new Blob([raw],{type:mime||"video/mp4"}),name);
  const r=await fetch(`${GRAPH}/act_${account}/advideos`,{method:"POST",body:f}),d=await r.json();
  if(!r.ok||d.error) throw new Error(d?.error?.message||`Meta video upload ${r.status}`);
  if(!d?.id) throw new Error("Meta did not return video ID");
  return String(d.id);
}
function actionValue(a:any[],type:string){
  const x=(a||[]).find((z:any)=>z.action_type===type);
  return x?num(x.value):0;
}
async function insights(adId:string,token:string){
  const u=new URL(`${GRAPH}/${adId}/insights`);
  u.searchParams.set("fields","spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,actions,cost_per_action_type,date_start,date_stop");
  u.searchParams.set("date_preset","maximum");
  u.searchParams.set("access_token",token);
  const r=await fetch(u),d=await r.json();
  if(!r.ok||d.error) throw new Error(d?.error?.message||`Meta insights ${r.status}`);
  return (d.data||[])[0]||null;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  let db:any=null,rolloutId="";
  try{
    const auth=req.headers.get("Authorization")||"";
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const user=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    db=createClient(url,service);

    const body=await req.json();
    rolloutId=String(body.rollout_id||"");
    const action=String(body.action||"");
    if(!rolloutId) return json({error:"rollout_id required"},400);

    const {data:ctx,error:ctxErr}=await user.rpc("org_admin_central_campaign_rollout",{p_rollout:rolloutId});
    if(ctxErr||!ctx?.rollout) return json({error:"Not authorised"},403);
    const orgId=String(ctx.rollout.organisation_id||"");
    const {data:isGlobal}=await user.rpc("is_org_global_admin",{p_org:orgId});
    if(!isGlobal) return json({error:"Global admin access required"},403);

    const rollout=ctx.rollout;
    const sites=ctx.sites||[];

    if(action==="summary"){
      const [{data:conn},{data:batches},{data:drafts},{data:assets},{data:perf}]=await Promise.all([
        db.from("central_campaign_meta_connections").select("*").eq("rollout_id",rolloutId).maybeSingle(),
        db.from("central_campaign_meta_batches").select("*").eq("rollout_id",rolloutId).order("created_at",{ascending:false}).limit(10),
        db.from("central_campaign_meta_drafts").select("*").eq("rollout_id",rolloutId).order("area"),
        db.from("central_campaign_meta_assets").select("*").eq("rollout_id",rolloutId).order("area"),
        db.from("central_campaign_meta_performance").select("*").eq("rollout_id",rolloutId).order("area")
      ]);
      const safeConn=conn?{...conn,access_token:undefined,connected:true}:null;
      const rows=perf||[];
      const summary={
        spend:rows.reduce((a:any,x:any)=>a+num(x.spend),0),
        impressions:rows.reduce((a:any,x:any)=>a+num(x.impressions),0),
        clicks:rows.reduce((a:any,x:any)=>a+num(x.clicks),0),
        landing_page_views:rows.reduce((a:any,x:any)=>a+num(x.landing_page_views),0)
      };
      return json({ok:true,connection:safeConn,batches:batches||[],drafts:drafts||[],assets:assets||[],performance:{summary,areas:rows}});
    }

    if(action==="connect"){
      const token=String(body.access_token||"").trim();
      const accountId=cleanAct(body.ad_account_id);
      const pageId=String(body.page_id||"").trim();
      if(!token||!accountId||!pageId) return json({error:"Access token, ad account ID and Facebook Page ID are required"},400);
      const me=await graphGet("me",token,{fields:"id,name"});
      const acct=await graphGet(`act_${accountId}`,token,{fields:"id,name,account_status,currency"});
      let page:any=null;
      try{page=await graphGet(pageId,token,{fields:"id,name"})}catch(e){return json({error:`Facebook Page check failed: ${e instanceof Error?e.message:String(e)}`},400)}
      const row={
        organisation_id:orgId,rollout_id:rolloutId,ad_account_id:accountId,page_id:pageId,access_token:token,
        meta_user_id:me.id||null,meta_user_name:me.name||null,ad_account_name:acct.name||null,currency:acct.currency||null,
        account_status:acct.account_status??null,graph_version:VERSION,connected_at:new Date().toISOString(),
        last_checked_at:new Date().toISOString(),last_error:null,metadata:{page_name:page?.name||null},updated_at:new Date().toISOString()
      };
      const {error}=await db.from("central_campaign_meta_connections").upsert(row,{onConflict:"rollout_id"});
      if(error) throw error;
      return json({ok:true,connection:{ad_account_id:accountId,page_id:pageId,meta_user_name:me.name||null,ad_account_name:acct.name||null,currency:acct.currency||null,account_status:acct.account_status??null,graph_version:VERSION,page_name:page?.name||null}});
    }

    if(action==="disconnect"){
      await db.from("central_campaign_meta_connections").delete().eq("rollout_id",rolloutId);
      return json({ok:true});
    }

    const {data:conn}=await db.from("central_campaign_meta_connections").select("*").eq("rollout_id",rolloutId).maybeSingle();
    if(!conn) return json({error:"Connect Meta first"},400);
    const token=String(conn.access_token||"");
    const accountId=cleanAct(conn.ad_account_id);

    if(action==="test"){
      const account=await graphGet(`act_${accountId}`,token,{fields:"id,name,account_status,currency"});
      return json({ok:true,account});
    }

    const savedConfig=(await db.from("central_campaign_ad_settings").select("config").eq("rollout_id",rolloutId).eq("platform","facebook").maybeSingle()).data?.config||{};
    const config={...savedConfig,...(body.config||{})};
    const campaignPattern=String(config.campaignPattern||"{{campaign}}");
    const adSetPattern=String(config.adSetPattern||"{{campaign}} | {{area}}");
    const adPattern=String(config.adPattern||"{{campaign}} | {{area}} | A");
    const audiencePattern=String(config.audiencePattern||"{{area}}AUDIENCE.CSV");
    const campaignName=fill(campaignPattern,rollout.title,sites[0]||{});
    const audiences=await allAudiences(accountId,token);
    const byName=new Map(audiences.map((a:any)=>[String(a.name||"").trim(),String(a.id||"")]));
    const planned=sites.map((site:any)=>{
      const audienceName=fill(audiencePattern,rollout.title,site);
      return {site,audience_name:audienceName,audience_id:byName.get(audienceName)||""};
    });
    const missing=planned.filter((x:any)=>!x.audience_id).map((x:any)=>x.audience_name);

    if(action==="preflight"){
      return json({ok:missing.length===0,audience_count:audiences.length,matched:planned.length-missing.length,expected:planned.length,missing,example:{
        campaign:campaignName,
        adset:fill(adSetPattern,rollout.title,sites[0]||{}),
        ad:fill(adPattern,rollout.title,sites[0]||{}),
        audience:fill(audiencePattern,rollout.title,sites[0]||{})
      }});
    }

    if(action==="create_drafts"){
      const allowMissing=body.allow_missing_audiences===true;
      if(missing.length&&!allowMissing) return json({error:`${missing.length} Meta audience${missing.length===1?"":"s"} not found`,missing},400);
      const {data:existing}=await db.from("central_campaign_meta_batches").select("id,campaign_id,campaign_name,status,created_at").eq("rollout_id",rolloutId).in("status",["creating","created","partial"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(existing&&!body.force) return json({error:"A Meta draft batch already exists for this campaign",existing},409);

      const special=String(config.special||"").trim();
      const campaignParams:Record<string,string>={
        name:campaignName,
        objective:String(config.objective||"OUTCOME_TRAFFIC"),
        status:"PAUSED",
        buying_type:"AUCTION",
        special_ad_categories:JSON.stringify(special?[special]:[]),
        is_adset_budget_sharing_enabled:"false"
      };
      if(special) campaignParams.special_ad_category_country=JSON.stringify([String(config.country||"GB")]);
      const createdCampaign=await graphPost(`act_${accountId}/campaigns`,token,campaignParams);
      const campaignId=String(createdCampaign.id||"");
      if(!campaignId) throw new Error("Meta did not return a campaign ID");

      const batchId=crypto.randomUUID();
      await db.from("central_campaign_meta_batches").insert({
        id:batchId,organisation_id:orgId,rollout_id:rolloutId,campaign_id:campaignId,campaign_name:campaignName,
        graph_version:VERSION,status:"creating",expected_objects:planned.length,
        metadata:{special_ad_category:special||null,allow_missing_audiences:allowMissing,missing_audiences:missing}
      });

      const base=String(config.baseUrl||body.base_url||"").replace(/\/+$/,"");
      const budgetMinor=Math.max(100,Math.round(Number(config.budget||10)*100));
      const country=String(config.country||"GB");
      let created=0; const results:any[]=[];
      for(const item of planned){
        const site=item.site;
        const adsetName=fill(adSetPattern,rollout.title,site);
        const landing=site.domain
          ? (/^https?:\/\//i.test(site.domain)?site.domain:`https://${site.domain}`)
          : `${base}/${site.slug}`;
        let adsetId:string|null=null,error:string|null=null;
        try{
          const targeting:any={geo_locations:{countries:[country]}};
          if(item.audience_id) targeting.custom_audiences=[{id:item.audience_id}];
          const a=await graphPost(`act_${accountId}/adsets`,token,{
            name:adsetName,campaign_id:campaignId,daily_budget:String(budgetMinor),
            billing_event:"IMPRESSIONS",optimization_goal:String(config.optimizationGoal||"LANDING_PAGE_VIEWS"),
            bid_strategy:"LOWEST_COST_WITHOUT_CAP",targeting:JSON.stringify(targeting),status:"PAUSED"
          });
          adsetId=String(a.id||"");
          if(!adsetId) throw new Error("Meta did not return an ad set ID");
          created++;
        }catch(e){error=e instanceof Error?e.message:String(e)}
        await db.from("central_campaign_meta_drafts").insert({
          batch_id:batchId,organisation_id:orgId,rollout_id:rolloutId,site_id:site.id,area:site.area,
          audience_name:item.audience_name,audience_id:item.audience_id||"",adset_id:adsetId,adset_name:adsetName,
          landing_url:landing,graphic_filename:fill(String(config.creativePattern||"{{slug}}.jpg"),rollout.title,site),
          status:adsetId?"created":"failed",error,metadata:{audience_override:!item.audience_id,targeting_mode:item.audience_id?"custom_audience":"broad_gb"}
        });
        results.push({area:site.area,adset_id:adsetId,status:adsetId?"created":"failed",error});
      }
      const status=created===planned.length?"created":created?"partial":"failed";
      await db.from("central_campaign_meta_batches").update({status,created_objects:created,error:status==="created"?null:`${planned.length-created} ad sets failed`,updated_at:new Date().toISOString()}).eq("id",batchId);
      return json({ok:status==="created",status,batch_id:batchId,campaign_id:campaignId,campaign_name:campaignName,created,expected:planned.length,results,missing_audiences:missing});
    }

    if(action==="create_ad"){
      const siteId=String(body.site_id||"");
      const site=sites.find((s:any)=>String(s.id)===siteId);
      if(!site) return json({error:"Unknown campaign area"},400);
      const {data:draft}=await db.from("central_campaign_meta_drafts").select("*").eq("rollout_id",rolloutId).eq("site_id",siteId).not("adset_id","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(!draft?.adset_id) return json({error:"Create the Meta campaign and Ad Sets first"},400);
      if(!conn.page_id) return json({error:"Facebook Page ID is missing"},400);

      const variant=String(body.variant||"A").trim()||"A";
      const landing=String(body.landing_url||draft.landing_url||"");
      const primary=fill(String(body.primary_text||config.body||""),rollout.title,site);
      const headline=fill(String(body.headline||config.headline||rollout.title),rollout.title,site);
      const desc=fill(String(body.description||config.description||""),rollout.title,site);
      const cta=String(config.cta||"LEARN_MORE").toUpperCase();
      const raw=bytesFromDataUrl(String(body.file_base64||""));
      if(!raw.length) return json({error:"Creative file is required"},400);

      const filename=String(body.filename||`${site.slug}-${variant}.jpg`);
      const mime=String(body.mime_type||"image/jpeg");
      const mediaType=String(body.media_type||"image")==="video"?"video":"image";
      let imageHash:string|null=null,videoId:string|null=null,story:any;
      if(mediaType==="video"){
        videoId=await uploadVideo(accountId,token,raw,filename,mime);
        story={page_id:String(conn.page_id),video_data:{video_id:videoId,message:primary,title:headline,call_to_action:{type:cta,value:{link:landing}}}};
      }else{
        imageHash=await uploadImage(accountId,token,raw,filename,mime);
        story={page_id:String(conn.page_id),link_data:{link:landing,message:primary,name:headline,image_hash:imageHash,call_to_action:{type:cta,value:{link:landing}},...(desc?{description:desc}:{})}};
      }
      const baseAdName=fill(adPattern,rollout.title,site);
      const adName=baseAdName.replace(/\|\s*A\s*$/i,`| ${variant}`).replace(/\|\s*01\s*$/i,`| ${variant}`);
      const cr=await graphPost(`act_${accountId}/adcreatives`,token,{name:`${adName} | Creative`,object_story_spec:JSON.stringify(story)});
      const creativeId=String(cr.id||"");
      const ad=await graphPost(`act_${accountId}/ads`,token,{name:adName,adset_id:String(draft.adset_id),creative:JSON.stringify({creative_id:creativeId}),status:"PAUSED"});
      const adId=String(ad.id||"");
      await db.from("central_campaign_meta_assets").insert({
        organisation_id:orgId,rollout_id:rolloutId,site_id:siteId,area:site.area,variant_key:variant,
        media_type:mediaType,filename,meta_image_hash:imageHash,meta_video_id:videoId,creative_id:creativeId,ad_id:adId,status:"created",
        metadata:{landing_url:landing}
      });
      if(variant==="A"){
        await db.from("central_campaign_meta_drafts").update({image_hash:imageHash,creative_id:creativeId,ad_id:adId,ad_name:adName,graphic_filename:filename,updated_at:new Date().toISOString()}).eq("id",draft.id);
      }
      return json({ok:true,area:site.area,variant,ad_id:adId,creative_id:creativeId,status:"PAUSED"});
    }

    if(action==="sync_insights"){
      const {data:assets}=await db.from("central_campaign_meta_assets").select("site_id,area,ad_id,metadata").eq("rollout_id",rolloutId).not("ad_id","is",null);
      if(!assets?.length) return json({error:"No Meta ads found"},400);
      const results:any[]=[];
      for(const asset of assets){
        try{
          const x=await insights(String(asset.ad_id),token);
          const lpv=actionValue(x?.actions||[],"landing_page_view");
          const cpl=(x?.cost_per_action_type||[]).find((z:any)=>z.action_type==="landing_page_view");
          const row={
            organisation_id:orgId,rollout_id:rolloutId,site_id:asset.site_id,ad_id:String(asset.ad_id),area:asset.area||null,
            date_start:x?.date_start||null,date_stop:x?.date_stop||null,spend:num(x?.spend),impressions:Math.round(num(x?.impressions)),
            reach:Math.round(num(x?.reach)),clicks:Math.round(num(x?.clicks)),link_clicks:Math.round(num(x?.inline_link_clicks)),
            landing_page_views:Math.round(lpv),ctr:num(x?.ctr),cpc:num(x?.cpc),cost_per_landing_page_view:cpl?num(cpl.value):0,
            raw:{...(x||{}),variant:asset.metadata?.variant||null},synced_at:new Date().toISOString()
          };
          const {error}=await db.from("central_campaign_meta_performance").upsert(row,{onConflict:"rollout_id,site_id,ad_id"});
          if(error) throw error;
          results.push({ok:true,...row});
        }catch(e){results.push({ok:false,area:asset.area,error:e instanceof Error?e.message:String(e)})}
      }
      const failed=results.filter(x=>!x.ok);
      return json({ok:!failed.length,synced:results.length-failed.length,expected:results.length,results});
    }

    return json({error:"Unknown action"},400);
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    try{
      if(db&&rolloutId) await db.from("central_campaign_meta_connections").update({last_error:message,last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("rollout_id",rolloutId);
    }catch{}
    return json({error:message},500);
  }
});