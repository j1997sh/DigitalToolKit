(function(){
let started=false;
async function init(){
 if(started||!window.CP_ADMIN)return;started=true;
 const {sb}=window.CP_ADMIN,$=id=>document.getElementById(id),rolloutId=new URLSearchParams(location.search).get('id');
 let data=null,summary={connection:null,batches:[],drafts:[],assets:[],performance:{summary:{},areas:[]}},audienceCheck=null,fileMap=new Map();
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/\.[^.]+$/,'').replace(/[^a-z0-9]+/g,'');
 const areaKey=s=>String(s||'').normalize('NFKD').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
 const msg=(t,e=false,target='metaAdsMessage')=>$(target).innerHTML=t?`<div class="state-banner ${e?'error':'success'}">${esc(t)}</div>`:'';
 async function invoke(action,extra={}){
   const r=await sb.functions.invoke('campaign-platform-meta',{body:{action,rollout_id:rolloutId,...extra}});
   if(r.error)throw new Error(r.error.message||'Meta function failed');
   if(r.data?.error)throw new Error(r.data.error);
   return r.data||{};
 }
 function tab(name){document.querySelectorAll('[data-meta-panel]').forEach(x=>x.classList.toggle('active',x.dataset.metaPanel===name));document.querySelectorAll('[data-meta-tab]').forEach(x=>x.classList.toggle('active',x.dataset.metaTab===name))}
 document.querySelectorAll('[data-meta-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.metaTab));
 function fill(pattern,site){return String(pattern||'').replaceAll('{{campaign}}',data?.rollout?.title||'Campaign').replaceAll('{{area}}',site?.area||'').replaceAll('{{slug}}',site?.slug||'').replaceAll('{{AREA_KEY}}',areaKey(site?.area||''))}
 function config(){return {
   body:$('metaBody').value.trim(),headline:$('metaHeadline').value.trim(),description:$('metaDescription').value.trim(),
   campaignPattern:$('metaCampaignPattern').value.trim(),adSetPattern:$('metaAdsetPattern').value.trim(),adPattern:$('metaAdPattern').value.trim(),
   audiencePattern:$('metaAudiencePattern').value.trim(),creativePattern:$('metaCreativePattern').value.trim(),cta:$('metaCta').value,
   budget:Number($('metaBudget').value||10),country:$('metaCountry').value.trim().toUpperCase(),objective:$('metaObjective').value,
   special:$('metaSpecial').value,baseUrl:$('metaBaseUrl').value.trim(),optimizationGoal:'LANDING_PAGE_VIEWS'
 }}
 function setConfig(c){
   $('metaBody').value=c.body||'';$('metaHeadline').value=c.headline||'';$('metaDescription').value=c.description||'';
   $('metaCampaignPattern').value=c.campaignPattern||'{{campaign}}';$('metaAdsetPattern').value=c.adSetPattern||'{{campaign}} | {{area}}';$('metaAdPattern').value=c.adPattern||'{{campaign}} | {{area}} | A';
   $('metaAudiencePattern').value=c.audiencePattern||'{{area}}AUDIENCE.CSV';$('metaCreativePattern').value=c.creativePattern||'{{AREA_KEY}}CAMPAIGNIN{{AREA_KEY}}.jpg';
   $('metaCta').value=c.cta||'LEARN_MORE';$('metaBudget').value=Number(c.budget||10);$('metaCountry').value=c.country||'GB';$('metaObjective').value=c.objective||'OUTCOME_TRAFFIC';$('metaSpecial').value=c.special||'';$('metaBaseUrl').value=c.baseUrl||'';
 }
 function example(){const site=(data?.sites||[])[0]||{area:'Birmingham Ladywood',slug:'birmingham-ladywood'},c=config();$('metaNamingExample').textContent=`Campaign: ${fill(c.campaignPattern,site)} · Ad Set: ${fill(c.adSetPattern,site)} · Ad: ${fill(c.adPattern,site)} · Audience: ${fill(c.audiencePattern,site)} · Creative: ${fill(c.creativePattern,site)}`}
 ['metaCampaignPattern','metaAdsetPattern','metaAdPattern','metaAudiencePattern','metaCreativePattern'].forEach(id=>$(id).oninput=example);
 function draftFor(site){return (summary.drafts||[]).find(x=>x.site_id===site.id&&x.adset_id)}
 function assetsFor(site){return (summary.assets||[]).filter(x=>x.site_id===site.id)}
 function matchFile(site){
   const expected=norm(fill(config().creativePattern,site));
   return [...fileMap.values()].find(f=>norm(f.name)===expected)
     || [...fileMap.values()].find(f=>norm(f.name).includes(norm(site.area)))
     || null;
 }
 function render(){
   if(!data)return;
   const sites=data.sites||[],conn=summary.connection,perf=summary.performance?.summary||{},drafts=summary.drafts||[],assets=summary.assets||[];
   $('metaAdsTitle').textContent=data.rollout.title;$('metaAdsMeta').textContent=`${sites.length} areas · direct Meta API`;$('metaAdsBack').href=`admin-central-campaign-rollout.html?id=${encodeURIComponent(rolloutId)}`;$('metaAdsCsvFallback').href=`admin-central-campaign-rollout.html?id=${encodeURIComponent(rolloutId)}#facebook-csv`;
   $('metaConnectionState').textContent=conn?`${conn.ad_account_name||conn.ad_account_id} · ${conn.currency||''}`:'Not connected';$('metaAccount').value=conn?.ad_account_id||$('metaAccount').value;$('metaPage').value=conn?.page_id||$('metaPage').value;
   const matchedAud=audienceCheck?.matched??0,adsets=drafts.filter(x=>x.adset_id).length,ads=assets.filter(x=>x.ad_id).length;
   $('metaAdsKpis').innerHTML=[['Areas',sites.length],['Audiences matched',audienceCheck?`${matchedAud}/${audienceCheck.expected}`:'—'],['Ad sets',`${adsets}/${sites.length}`],['Ads created',ads],['Spend',`£${Number(perf.spend||0).toFixed(2)}`]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
   const checks=[
     ['Meta connection',!!conn,conn?'Connected':'Connect an ad account and Page.'],
     ['Audience check',audienceCheck?audienceCheck.missing?.length===0:false,audienceCheck?`${audienceCheck.matched}/${audienceCheck.expected} audience names found in Meta.`:'Run Check audiences.'],
     ['Campaign structure',adsets===sites.length,`${adsets}/${sites.length} PAUSED ad sets created.`],
     ['Ads',ads>0,`${ads} PAUSED ads created.`]
   ];
   $('metaAdsOverview').innerHTML=`<div class="meta-health-list">${checks.map(x=>`<div class="meta-health-row"><span class="status-chip ${x[1]?'published':'draft'}">${x[1]?'Ready':'Check'}</span><strong>${esc(x[0])}</strong><span>${esc(x[2])}</span></div>`).join('')}</div>`;
   renderMedia();renderResults();example();
 }
 function renderMedia(){
   if(!data)return;const sites=data.sites||[];
   $('metaMediaTable').innerHTML=`<div class="performance-table-wrap"><table class="performance-table"><thead><tr><th>Area</th><th>Expected creative</th><th>Selected file</th><th>Ad set</th><th>Ads</th></tr></thead><tbody>${sites.map(s=>{const file=matchFile(s),draft=draftFor(s),ads=assetsFor(s);return `<tr><td><strong>${esc(s.area)}</strong></td><td><code>${esc(fill(config().creativePattern,s))}</code></td><td class="${file?'':'facebook-missing'}">${esc(file?.name||'Not matched')}</td><td>${draft?'<span class="status-chip published">PAUSED</span>':'—'}</td><td>${ads.length}</td></tr>`}).join('')}</tbody></table></div>`;
 }
 function renderResults(){const rows=summary.performance?.areas||[];$('metaResults').innerHTML=rows.length?`<div class="performance-table-wrap"><table class="performance-table"><thead><tr><th>Area</th><th>Spend</th><th>Impressions</th><th>Clicks</th><th>Landing page views</th><th>CPC</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.area)}</td><td>£${Number(x.spend||0).toFixed(2)}</td><td>${Number(x.impressions||0).toLocaleString()}</td><td>${Number(x.clicks||0).toLocaleString()}</td><td>${Number(x.landing_page_views||0).toLocaleString()}</td><td>£${Number(x.cpc||0).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="workspace-empty-state"><div><h3>No Meta delivery data yet</h3><p>Create ads and sync results once they have delivered.</p></div></div>'}
 async function saveConfig(){
   const r=await sb.rpc('org_admin_save_central_campaign_ad_settings',{p_rollout:rolloutId,p_platform:'facebook',p_config:config()});
   if(r.error)throw new Error(r.error.message);msg('Facebook copy and naming saved.');example();renderMedia();
 }
 $('metaAdsSaveConfig').onclick=()=>saveConfig().catch(e=>msg(e.message,true));
 $('metaConnect').onclick=async()=>{try{const r=await invoke('connect',{access_token:$('metaToken').value.trim(),ad_account_id:$('metaAccount').value.trim(),page_id:$('metaPage').value.trim()});$('metaToken').value='';msg(`Connected to ${r.connection?.ad_account_name||'Meta'}.`,false,'metaConnectionProgress');await load()}catch(e){msg(e.message,true,'metaConnectionProgress')}};
 $('metaTest').onclick=async()=>{try{const r=await invoke('test');msg(`Connection working: ${r.account?.name||'ad account'}.`,false,'metaConnectionProgress')}catch(e){msg(e.message,true,'metaConnectionProgress')}};
 $('metaDisconnect').onclick=async()=>{if(!confirm('Disconnect Meta from this central campaign?'))return;try{await invoke('disconnect');msg('Meta disconnected.',false,'metaConnectionProgress');await load()}catch(e){msg(e.message,true,'metaConnectionProgress')}};
 $('metaCheckAudiences').onclick=async()=>{try{audienceCheck=await invoke('preflight',{config:config()});const missing=audienceCheck.missing||[];$('metaAudienceResults').innerHTML=missing.length?`<div class="state-banner error"><strong>${missing.length} missing audience${missing.length===1?'':'s'}</strong><br>${missing.slice(0,12).map(esc).join('<br>')}${missing.length>12?'<br>…':''}</div>`:`<div class="state-banner success">All ${audienceCheck.expected} expected audiences were found in Meta.</div>`;render()}catch(e){msg(e.message,true,'metaConnectionProgress')}};
 $('metaCreateStructure').onclick=async()=>{if(!confirm(`Create one PAUSED Meta campaign and ${(data?.sites||[]).length} PAUSED ad sets? Nothing will spend until you activate it in Meta.`))return;try{await saveConfig();const r=await invoke('create_drafts',{config:config(),allow_missing_audiences:false});msg(`${r.created}/${r.expected} PAUSED ad sets created.`,!r.ok,'metaConnectionProgress');await load()}catch(e){msg(e.message,true,'metaConnectionProgress')}};
 $('metaMediaFiles').onchange=()=>{$('metaMapMedia').click()};
 $('metaMapMedia').onclick=()=>{fileMap=new Map([...( $('metaMediaFiles').files||[])].map(f=>[f.name,f]));const matched=(data?.sites||[]).filter(s=>matchFile(s)).length;msg(`${fileMap.size} files loaded; ${matched}/${(data?.sites||[]).length} areas matched by naming convention.`,matched!==(data?.sites||[]).length,'metaMediaProgress');renderMedia()};
 function fileData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=rej;r.readAsDataURL(file)})}
 $('metaCreateAds').onclick=async()=>{const sites=data?.sites||[],missingStructure=sites.filter(s=>!draftFor(s)),missingMedia=sites.filter(s=>!matchFile(s));if(missingStructure.length)return msg(`Create the Meta campaign/ad sets first. ${missingStructure.length} areas do not have an ad set.`,true,'metaMediaProgress');if(missingMedia.length)return msg(`${missingMedia.length} areas do not have a matched creative file.`,true,'metaMediaProgress');if(!confirm(`Create ${sites.length} PAUSED Meta ads using the matched files?`))return;let done=0;for(const s of sites){const f=matchFile(s);try{msg(`Creating ${s.area}… ${done}/${sites.length}`,false,'metaMediaProgress');await invoke('create_ad',{site_id:s.id,variant:'A',media_type:f.type.startsWith('video/')?'video':'image',filename:f.name,mime_type:f.type,file_base64:await fileData(f),primary_text:config().body,headline:config().headline,description:config().description,config:config()});done++}catch(e){msg(`${s.area}: ${e.message}`,true,'metaMediaProgress');await load();return}}msg(`${done}/${sites.length} Meta ads created PAUSED.`,false,'metaMediaProgress');await load()};
 $('metaSyncResults').onclick=async()=>{try{const r=await invoke('sync_insights');msg(`${r.synced}/${r.expected} Meta ads synced.`);await load()}catch(e){msg(e.message,true)}};
 $('metaAdsManifest').onclick=()=>{if(!data)return;const c=config(),headers=['area','slug','audience_name','creative_filename','ad_set_name','ad_name','landing_url'],q=v=>`"${String(v??'').replace(/"/g,'""')}"`,rows=(data.sites||[]).map(s=>({area:s.area,slug:s.slug,audience_name:fill(c.audiencePattern,s),creative_filename:fill(c.creativePattern,s),ad_set_name:fill(c.adSetPattern,s),ad_name:fill(c.adPattern,s),landing_url:s.domain?(/^https?:\/\//i.test(s.domain)?s.domain:`https://${s.domain}`):`${String(c.baseUrl||'').replace(/\/+$/,'')}/${s.slug}`}));const csv=[headers.map(q).join(','),...rows.map(r=>headers.map(h=>q(r[h])).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`${String(data.rollout.title||'campaign').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-meta-naming-manifest.csv`;a.click();URL.revokeObjectURL(a.href)};
 async function load(){if(!rolloutId)return msg('Missing central campaign ID.',true);const [r,s,c]=await Promise.all([sb.rpc('org_admin_central_campaign_rollout',{p_rollout:rolloutId}),invoke('summary'),sb.rpc('org_admin_central_campaign_ad_settings',{p_rollout:rolloutId,p_platform:'facebook'})]);if(r.error)throw new Error(r.error.message);data=r.data;summary=s;setConfig(c.error?{}:(c.data||{}));render()}
 await load();
}
if(window.CP_ADMIN)init().catch(e=>console.error(e));else document.addEventListener('cp-admin-ready',()=>init().catch(e=>console.error(e)),{once:true});
})();