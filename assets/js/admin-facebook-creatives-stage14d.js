(function(){
let started=false;
async function init(){
 if(started||!window.CP_ADMIN)return;started=true;
 const {sb,orgId}=window.CP_ADMIN,rolloutId=new URLSearchParams(location.search).get('rollout');
 let rollout=null,sites=[],creatives=[];
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const msg=(t,e=false)=>creativeMessage.innerHTML=t?`<div class="state-banner ${e?'error':'success'}">${esc(t)}</div>`:'';
 const areaKey=s=>String(s||'').normalize('NFKD').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
 const fileKey=name=>areaKey(String(name||'').replace(/\.[^.]+$/,''));
 function detectSite(filename){
   const fk=fileKey(filename);
   const matches=sites.filter(s=>fk.includes(areaKey(s.area))).sort((a,b)=>areaKey(b.area).length-areaKey(a.area).length);
   return matches[0]||null;
 }
 function render(){
   const q=creativeSearch.value.trim().toLowerCase();
   const byKey=new Map(creatives.map(x=>[x.area_key,x]));
   const rows=sites.filter(s=>!q||`${s.area} ${byKey.get(areaKey(s.area))?.filename||''}`.toLowerCase().includes(q));
   const matched=sites.filter(s=>byKey.has(areaKey(s.area))).length;
   creativeKpis.innerHTML=[['Microsites',sites.length],['Creatives matched',matched],['Missing',Math.max(0,sites.length-matched)]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
   creativeList.innerHTML=rows.length?`<div class="performance-table-wrap"><table class="performance-table"><thead><tr><th>Area</th><th>Creative</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(s=>{const c=byKey.get(areaKey(s.area));return `<tr><td><strong>${esc(s.area)}</strong><small>${esc(s.slug||'')}</small></td><td>${c?`<code>${esc(c.filename)}</code>`:'—'}</td><td><span class="status-chip ${c?'published':'draft'}">${c?'Matched':'Missing'}</span></td><td>${c?`<button class="btn danger-outline small" data-delete-creative="${c.id}">Remove</button>`:''}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="workspace-empty-state"><div><h3>No matching areas</h3></div></div>';
   document.querySelectorAll('[data-delete-creative]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this creative mapping?'))return;const rr=await sb.rpc('org_admin_delete_facebook_creative',{p_creative:b.dataset.deleteCreative});if(rr.error)return msg(rr.error.message,true);if(rr.data){const rem=await sb.storage.from('campaign-assets').remove([rr.data]);if(rem.error)console.warn(rem.error)}msg('Creative removed.');await load()});
 }
 async function load(){
   if(!rolloutId)return msg('Missing campaign rollout.',true);
   const [r,c]=await Promise.all([sb.rpc('org_admin_central_campaign_rollout',{p_rollout:rolloutId}),sb.rpc('org_admin_facebook_creatives',{p_rollout:rolloutId})]);
   if(r.error||c.error)return msg((r.error||c.error).message,true);
   rollout=r.data?.rollout;sites=r.data?.sites||[];creatives=c.data||[];
   creativeCampaignTitle.textContent=rollout?.title||'Creative library';creativeCampaignMeta.textContent=`${sites.length} localised microsites`;backToCampaign.href=`admin-central-campaign-rollout.html?id=${encodeURIComponent(rolloutId)}`;render();
 }
 creativeSearch.oninput=render;
 creativeFiles.onchange=async()=>{
   const files=[...(creativeFiles.files||[])];if(!files.length)return;
   let saved=0,unmatched=[];
   for(const f of files){
     const site=detectSite(f.name);if(!site){unmatched.push(f.name);continue}
     const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,'-');
     const path=`central/${orgId}/facebook-creatives/${rolloutId}/${areaKey(site.area)}-${Date.now()}-${safe}`;
     const up=await sb.storage.from('campaign-assets').upload(path,f,{contentType:f.type||undefined,upsert:false});
     if(up.error){unmatched.push(`${f.name} (${up.error.message})`);continue}
     const rr=await sb.rpc('org_admin_upsert_facebook_creative',{p_rollout:rolloutId,p_area:site.area,p_filename:f.name,p_storage_path:path,p_mime_type:f.type||null,p_file_size:f.size||null});
     if(rr.error){await sb.storage.from('campaign-assets').remove([path]);unmatched.push(`${f.name} (${rr.error.message})`);continue}
     saved++;
   }
   creativeFiles.value='';msg(`${saved} creative${saved===1?'':'s'} matched and saved.${unmatched.length?` ${unmatched.length} file${unmatched.length===1?'':'s'} could not be matched.`:''}`,!!unmatched.length);await load();
 };
 await load();
}
if(window.CP_ADMIN)init().catch(console.error);else document.addEventListener('cp-admin-ready',()=>init().catch(console.error),{once:true});
})();