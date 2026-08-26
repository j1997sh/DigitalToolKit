(async function(){
'use strict';
const sb=window.cpSupabase,file=location.pathname.split('/').pop(),params=new URLSearchParams(location.search),id=params.get('id');
const map={'website-overview.html':['website','websites','websiteOverviewRoot'],'campaign-overview.html':['campaign','campaigns','campaignOverviewRoot']};
if(!map[file]||!id)return;
const [entityType,table,rootId]=map[file];
const {data:{session}}=await sb.auth.getSession();if(!session)return;
const [er,vr,dr]=await Promise.all([
 sb.from(table).select('*').eq('id',id).single(),
 sb.from('publish_versions').select('*').eq('entity_type',entityType).eq('entity_id',id).order('created_at',{ascending:false}),
 sb.from('public_deployments').select('id,version_number,is_live,published_at,unpublished_at').eq('entity_type',entityType).eq('entity_id',id).order('version_number',{ascending:false})
]);
if(er.error||vr.error||dr.error)return;
const root=document.getElementById(rootId);if(!root)return;
const entity=er.data,versions=vr.data||[],deployments=dr.data||[],live=deployments.find(x=>x.is_live);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const slug=entity.slug||id;
const routePrefix=entityType==='website'?'/site/':'/campaign/';const cleanPublicPath=routePrefix+slug;const liveUrl=entityType==='website'?`public-site.html?site=${encodeURIComponent(slug)}`:`campaign-site.html?id=${encodeURIComponent(slug)}`;
const previewUrl=entityType==='website'?`editor.html?id=${encodeURIComponent(id)}`:`campaign-editor.html?id=${encodeURIComponent(id)}`;
const box=document.createElement('section');box.className='panel stage4c-publish-panel';
function stateText(){if(live&&entity.has_unpublished_changes)return 'Live · draft changes waiting to be published';if(live)return 'Live and up to date';if(entity.publishing_state==='unpublished')return 'Unpublished · draft retained';return 'Draft · not live'}
box.innerHTML=`<div class="panel-head"><div><h3>Publishing</h3><p class="muted">${esc(stateText())}</p></div><span class="status-chip ${live?'published':'draft'}">${live?'Live':'Not live'}</span></div>
<div class="stage4c-publish-actions">
 <button class="btn" id="stage4cPublish">${live?'Publish changes':'Publish'}</button>
 <a class="btn secondary" href="${previewUrl}">Preview draft</a>
 ${live?`<a class="btn secondary" target="_blank" href="${liveUrl}">View live</a><button class="btn danger-outline" id="stage4cUnpublish">Unpublish</button>`:''}
</div>
<div class="stage4c-url-box"><span>Public path</span><code>${esc(cleanPublicPath)}</code><small>This is the clean route the eventual host/router will resolve. GitHub Pages continues using the temporary preview URL for now.</small></div>
<div class="publish-history-list">${deployments.length?deployments.slice(0,10).map(d=>`<div class="publish-history-row"><div><strong>${d.is_live?'Live · ':''}Version ${d.version_number}</strong><small>${new Date(d.published_at).toLocaleString()}${d.unpublished_at?' · superseded':''}</small></div>${d.is_live?'<span class="status-chip published">Live</span>':`<button class="btn secondary small" data-rollback="${d.id}">Make live</button>`}</div>`).join(''):'<div class="empty-state-card compact"><p>No published versions yet.</p></div>'}</div>`;
root.appendChild(box);
stage4cPublish.onclick=async()=>{stage4cPublish.disabled=true;stage4cPublish.textContent='Publishing…';const r=await sb.rpc('publish_local_entity',{p_entity_type:entityType,p_entity_id:id});if(r.error){stage4cPublish.textContent='Publish failed';return}location.reload()};
document.getElementById('stage4cUnpublish')?.addEventListener('click',async()=>{const ok=await CPDialog.confirm({title:'Unpublish?',message:'The public page will stop resolving immediately. Your draft and publish history will be kept.',confirmLabel:'Unpublish'});if(!ok)return;const r=await sb.rpc('unpublish_local_entity',{p_entity_type:entityType,p_entity_id:id});if(r.error)return;location.reload()});
box.querySelectorAll('[data-rollback]').forEach(b=>b.onclick=async()=>{const ok=await CPDialog.confirm({title:'Make this version live?',message:'This historical version will become the new live deployment. Your current draft will not be overwritten.',confirmLabel:'Make live'});if(!ok)return;b.disabled=true;b.textContent='Publishing…';const r=await sb.rpc('rollback_local_deployment',{p_deployment_id:b.dataset.rollback});if(r.error){b.textContent='Failed';return}location.reload()});
})();