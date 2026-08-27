
(function(){
let started=false;
async function init(){
 if(started||!window.CP_ADMIN)return;
 started=true;
 const {sb}=window.CP_ADMIN;
 const id=new URLSearchParams(location.search).get('id');
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const msg=(t,e=false)=>centralCampaignMessage.innerHTML=t?`<div class="state-banner ${e?'error':'success'}">${esc(t)}</div>`:'';
 let data=null,supporters=[];

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
   centralCampaignKpis.innerHTML=[['Localised sites',s.sites||0],['Draft',s.draft||0],['Live',s.live||0],['Supporters',s.supporters||0]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
   centralCampaignSites.innerHTML=sites.length?`<div class="performance-table-wrap"><table class="performance-table central-campaign-sites-table"><thead><tr><th>Area</th><th>Slug</th><th>Domain</th><th>Status</th><th></th></tr></thead><tbody>${sites.map(s=>`<tr><td><strong>${esc(s.area)}</strong><small>${esc([s.council,s.region].filter(Boolean).join(' · '))}</small></td><td><code>${esc(s.slug)}</code></td><td>${esc(s.domain||'—')}</td><td><span class="status-chip ${s.status==='live'?'published':'draft'}">${esc(s.status)}</span><small>${Number(s.supporters||0)} supporter${Number(s.supporters||0)===1?'':'s'}</small></td><td><div class="button-row"><button class="btn light small" data-preview="${s.id}">Preview</button>${s.status==='draft'?`<button class="btn secondary small" data-site-status="${s.id}" data-to="live">Mark live</button>`:s.status==='live'?`<button class="btn secondary small" data-site-status="${s.id}" data-to="draft">Return to draft</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="workspace-empty-state"><div><h3>No localised sites yet</h3><p>Upload a CSV of areas to generate centrally managed campaign microsites.</p></div></div>';
   centralCampaignSupporters.innerHTML=supporters.length?supporters.map(x=>`<tr><td><strong>${esc([x.first_name,x.last_name].filter(Boolean).join(' ')||'Unnamed')}</strong><small>${esc(x.email||x.phone||'')}</small></td><td>${esc(x.area||'—')}</td><td>${esc(x.postcode||'—')}</td><td>${x.consent_email?'Opted in':'Not opted in'}</td><td><div class="admin-journey-tags">${(x.tags||[]).slice(0,5).map(tag=>`<span class="admin-tag">${esc(tag)}</span>`).join('')}</div></td><td>${new Date(x.created_at).toLocaleDateString()}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">No supporters captured yet.</td></tr>';
   document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>preview(sites.find(x=>x.id===b.dataset.preview)));
   document.querySelectorAll('[data-site-status]').forEach(b=>b.onclick=async()=>{const rr=await sb.rpc('org_admin_set_central_campaign_site_status',{p_site:b.dataset.siteStatus,p_status:b.dataset.to});if(rr.error)return msg(rr.error.message,true);await load()});
 }
 function preview(s){
   if(!s)return;
   const b=s.branding||{},navy=b.primary||'#08254a',blue=b.secondary||'#1476d4',points=Array.isArray(s.key_points)?s.key_points:[];
   const doc=centralCampaignPreviewFrame.contentDocument;
   doc.open();doc.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:"Proxima Nova","Avenir Next",Arial,sans-serif;color:${navy}}.wrap{width:min(1060px,calc(100% - 40px));margin:auto}.nav{padding:20px 0;font-weight:900}.hero{background:linear-gradient(120deg,${navy},#24496f);color:white;padding:100px 0 84px}.hero h1{font-size:68px;line-height:.94;letter-spacing:-.05em;max-width:850px;margin:0 0 18px}.hero p{max-width:720px;font-size:20px;line-height:1.45}.btn{display:inline-block;background:${blue};padding:14px 18px;color:white;font-weight:900}.section{padding:64px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{border:1px solid #d7e0e8;padding:22px}.area{color:#6f8091;font-weight:800}@media(max-width:700px){.hero h1{font-size:44px}.grid{grid-template-columns:1fr}}</style></head><body><div class="nav"><div class="wrap">${esc(data.rollout.title)}</div></div><section class="hero"><div class="wrap"><div class="area">${esc(s.area)}</div><h1>${esc(s.headline||s.title)}</h1><p>${esc(s.supporting_copy||'')}</p><span class="btn">Back this campaign</span></div></section><section class="section"><div class="wrap"><div class="grid">${points.map(p=>`<div class="card"><strong>${esc(typeof p==='string'?p:p.title||'')}</strong></div>`).join('')}</div></div></section><section class="section alt"><div class="wrap"><h2>Back the campaign</h2><p class="lead">Add your name to support this campaign in ${esc(s.area)}.</p><form id="supportForm" style="max-width:680px;display:grid;grid-template-columns:1fr 1fr;gap:12px"><input name="first_name" placeholder="First name" style="padding:12px;border:1px solid #ccd8e3"><input name="last_name" placeholder="Last name" style="padding:12px;border:1px solid #ccd8e3"><input name="email" type="email" placeholder="Email address" style="padding:12px;border:1px solid #ccd8e3"><input name="postcode" placeholder="Postcode" style="padding:12px;border:1px solid #ccd8e3"><label style="grid-column:1/-1"><input name="consent" type="checkbox"> Keep me updated by email</label><button class="btn" type="submit" style="border:0;cursor:pointer">Back this campaign</button><div id="supportMsg" style="align-self:center;font-weight:800"></div></form></div></section></body></html>`);doc.close();
   const form=doc.getElementById('supportForm');
   if(form)form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form);const rr=await sb.rpc('public_central_campaign_support',{p_site:s.id,p_first_name:String(fd.get('first_name')||''),p_last_name:String(fd.get('last_name')||''),p_email:String(fd.get('email')||''),p_phone:'',p_postcode:String(fd.get('postcode')||''),p_consent_email:fd.get('consent')==='on',p_attribution:{source:'hq-preview',campaign:data.rollout.title,area:s.area}});const m=doc.getElementById('supportMsg');if(rr.error){m.textContent=rr.error.message;return}m.textContent='Thank you — your support has been recorded.';form.reset();await load()};
   centralCampaignPreviewLabel.textContent=`${s.area} · ${s.slug}`;
   centralCampaignPreviewPanel.hidden=false;
   centralCampaignPreviewPanel.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function load(){
   const [r,sr]=await Promise.all([sb.rpc('org_admin_central_campaign_rollout',{p_rollout:id}),sb.rpc('org_admin_central_campaign_supporters',{p_rollout:id})]);
   if(r.error||sr.error)return msg((r.error||sr.error).message,true);
   data=r.data;supporters=sr.data||[];render();
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
 deleteCentralCampaignRollout.onclick=async()=>{if(!confirm(`Delete ${data?.rollout?.title||'this rollout'}? This will permanently delete all generated microsites and their central supporter records.`))return;const r=await sb.rpc('org_admin_delete_central_campaign_rollout',{p_rollout:id});if(r.error)return msg(r.error.message,true);location.href='admin-content.html'};
 await load();
}
if(window.CP_ADMIN)init().catch(console.error);
else document.addEventListener('cp-admin-ready',()=>init().catch(console.error),{once:true});
})();
