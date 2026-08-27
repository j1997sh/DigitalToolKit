
(function(){
let started=false;
async function init(){
 if(started||!window.CP_ADMIN)return;
 started=true;
 const {sb}=window.CP_ADMIN;
 const id=new URLSearchParams(location.search).get('id');
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const msg=(t,e=false)=>centralCampaignMessage.innerHTML=t?`<div class="state-banner ${e?'error':'success'}">${esc(t)}</div>`:'';
 let data=null;

 function parseCSV(text){
   const rows=[];let row=[],field='',q=false;
   for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(q&&n==='"'){field+='"';i++}else q=!q}else if(c===','&&!q){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[]}else field+=c}
   if(field.length||row.length){row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row)}
   if(rows.length<2)return [];
   const heads=rows[0].map(x=>x.trim().toLowerCase());
   return rows.slice(1).map(r=>Object.fromEntries(heads.map((h,i)=>[h,(r[i]||'').trim()])));
 }
 function toRows(rows){
   return rows.map(x=>({
    area:x.area||x.place||x.ward||x.constituency||'',
    council:x.council||'',
    region:x.region||'',
    postcode:x.postcode||'',
    slug:x.slug||x.site_slug||'',
    domain:x.domain||'',
    title:x.title||'',
    headline:x.headline||'',
    supporting_copy:x.supporting_copy||x.copy||'',
    key_points:(x.key_points||'').split('|').map(v=>v.trim()).filter(Boolean)
   }));
 }

 function render(){
   const r=data.rollout,s=data.summary||{},sites=data.sites||[];
   centralCampaignTitle.textContent=r.title;
   centralCampaignMeta.textContent=[r.category,r.status].filter(Boolean).join(' · ');
   centralCampaignKpis.innerHTML=[['Localised sites',s.sites||0],['Draft',s.draft||0],['Live',s.live||0]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
   centralCampaignSites.innerHTML=sites.length?`<div class="performance-table-wrap"><table class="performance-table central-campaign-sites-table"><thead><tr><th>Area</th><th>Slug</th><th>Domain</th><th>Status</th><th></th></tr></thead><tbody>${sites.map(s=>`<tr><td><strong>${esc(s.area)}</strong><small>${esc([s.council,s.region].filter(Boolean).join(' · '))}</small></td><td><code>${esc(s.slug)}</code></td><td>${esc(s.domain||'—')}</td><td><span class="status-chip ${s.status==='live'?'published':'draft'}">${esc(s.status)}</span></td><td><div class="button-row"><button class="btn light small" data-preview="${s.id}">Preview</button>${s.status==='draft'?`<button class="btn secondary small" data-site-status="${s.id}" data-to="live">Mark live</button>`:s.status==='live'?`<button class="btn secondary small" data-site-status="${s.id}" data-to="draft">Return to draft</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="workspace-empty-state"><div><h3>No localised sites yet</h3><p>Upload a CSV of areas to generate centrally managed campaign microsites.</p></div></div>';
   document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>preview(sites.find(x=>x.id===b.dataset.preview)));
   document.querySelectorAll('[data-site-status]').forEach(b=>b.onclick=async()=>{const rr=await sb.rpc('org_admin_set_central_campaign_site_status',{p_site:b.dataset.siteStatus,p_status:b.dataset.to});if(rr.error)return msg(rr.error.message,true);await load()});
 }
 function preview(s){
   if(!s)return;
   const b=s.branding||{},navy=b.primary||'#08254a',blue=b.secondary||'#1476d4',points=Array.isArray(s.key_points)?s.key_points:[];
   const doc=centralCampaignPreviewFrame.contentDocument;
   doc.open();doc.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:"Proxima Nova","Avenir Next",Arial,sans-serif;color:${navy}}.wrap{width:min(1060px,calc(100% - 40px));margin:auto}.nav{padding:20px 0;font-weight:900}.hero{background:linear-gradient(120deg,${navy},#24496f);color:white;padding:100px 0 84px}.hero h1{font-size:68px;line-height:.94;letter-spacing:-.05em;max-width:850px;margin:0 0 18px}.hero p{max-width:720px;font-size:20px;line-height:1.45}.btn{display:inline-block;background:${blue};padding:14px 18px;color:white;font-weight:900}.section{padding:64px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{border:1px solid #d7e0e8;padding:22px}.area{color:#6f8091;font-weight:800}@media(max-width:700px){.hero h1{font-size:44px}.grid{grid-template-columns:1fr}}</style></head><body><div class="nav"><div class="wrap">${esc(data.rollout.title)}</div></div><section class="hero"><div class="wrap"><div class="area">${esc(s.area)}</div><h1>${esc(s.headline||s.title)}</h1><p>${esc(s.supporting_copy||'')}</p><span class="btn">Back this campaign</span></div></section><section class="section"><div class="wrap"><div class="grid">${points.map(p=>`<div class="card"><strong>${esc(typeof p==='string'?p:p.title||'')}</strong></div>`).join('')}</div></div></section></body></html>`);doc.close();
   centralCampaignPreviewLabel.textContent=`${s.area} · ${s.slug}`;
   centralCampaignPreviewPanel.hidden=false;
   centralCampaignPreviewPanel.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function load(){
   const r=await sb.rpc('org_admin_central_campaign_rollout',{p_rollout:id});
   if(r.error)return msg(r.error.message,true);
   data=r.data;render();
 }
 downloadCentralCampaignTemplate.onclick=()=>{
   const csv='area,council,region,postcode,slug,domain,title,headline,supporting_copy,key_points\nChelmsford,Chelmsford City Council,East of England,CM1 1AA,stopthetaxinchelmsford,,Stop the Tax in Chelmsford,Stop the tax rise in Chelmsford,Back our campaign to stop the proposed tax rise.,Protect household budgets|Demand value for money|Back local services\nBasildon,Basildon Borough Council,East of England,SS14 1AA,stopthetaxinbasildon,,Stop the Tax in Basildon,Stop the tax rise in Basildon,Back our campaign to stop the proposed tax rise.,Protect household budgets|Demand value for money|Back local services\n';
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='central-campaign-localised-sites-template.csv';a.click();URL.revokeObjectURL(a.href);
 };
 centralCampaignCsv.onchange=async()=>{
   const f=centralCampaignCsv.files?.[0];if(!f)return;
   const rows=toRows(parseCSV(await f.text()));
   if(!rows.length)return msg('No valid CSV rows found.',true);
   const r=await sb.rpc('org_admin_import_central_campaign_sites',{p_rollout:id,p_rows:rows});
   if(r.error)return msg(r.error.message,true);
   msg(`${r.data.created} localised campaign site${r.data.created===1?'':'s'} created.${r.data.errors?` ${r.data.errors} row${r.data.errors===1?'':'s'} failed.`:''}`,!!r.data.errors);
   centralCampaignCsv.value='';await load();
 };
 closeCentralCampaignPreview.onclick=()=>centralCampaignPreviewPanel.hidden=true;
 await load();
}
if(window.CP_ADMIN)init().catch(console.error);
else document.addEventListener('cp-admin-ready',()=>init().catch(console.error),{once:true});
})();
