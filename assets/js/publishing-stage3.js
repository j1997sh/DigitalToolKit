(async function(){
'use strict';
const sb=window.cpSupabase,file=location.pathname.split('/').pop(),params=new URLSearchParams(location.search),id=params.get('id');
const map={'website-overview.html':['website','websites','websiteOverviewRoot'],'campaign-overview.html':['campaign','campaigns','campaignOverviewRoot'],'survey-overview.html':['survey','surveys','surveyOverviewRoot']};
if(!map[file]||!id)return;
const [entityType,table,rootId]=map[file];
const {data:{session}}=await sb.auth.getSession();if(!session)return;
const [er,vr]=await Promise.all([sb.from(table).select('*').eq('id',id).single(),sb.from('publish_versions').select('*').eq('entity_type',entityType).eq('entity_id',id).order('created_at',{ascending:false})]);
if(er.error||vr.error)return;
const root=document.getElementById(rootId);if(!root)return;
const entity=er.data,versions=vr.data||[];
const box=document.createElement('section');box.className='panel stage3-publish-panel';
box.innerHTML=`<div class="panel-head"><div><h3>Publishing</h3><p class="muted">${entity.status==='published'?(entity.has_unpublished_changes?'Published · unpublished changes':'Published and up to date'):'Draft'}</p></div>${entity.status==='published'?'<span class="status-chip published">Published</span>':'<span class="status-chip draft">Draft</span>'}</div>
<div class="publish-history-list">${versions.length?versions.slice(0,8).map((v,i)=>`<div class="publish-history-row"><div><strong>${i===0?'Latest published version':(v.label||'Published version')}</strong><small>${new Date(v.created_at).toLocaleString()}</small></div><button class="btn secondary small" data-restore="${v.id}">Restore</button></div>`).join(''):'<div class="empty-state-card compact"><p>No published versions yet.</p></div>'}</div>`;
root.appendChild(box);
box.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{const v=versions.find(x=>x.id===b.dataset.restore);if(!v)return;b.disabled=true;b.textContent='Restoring…';const snap=v.snapshot||{};let payload={};if(table==='websites')payload={name:snap.name,area:snap.area,slug:snap.slug,branding:snap.branding,content:snap.content,selected_survey_id:snap.selected_survey_id||snap.surveyId||null,hero_image_path:snap.hero_image_path||snap.heroImagePath||null,about_image_path:snap.about_image_path||snap.aboutImagePath||null,has_unpublished_changes:true};if(table==='campaigns')payload={name:snap.name,slug:snap.slug,headline:snap.headline,supporting_copy:snap.supporting_copy||snap.support||'',key_points:snap.key_points||snap.points||[],settings:snap.settings||{},branding:snap.branding||{},survey_id:snap.survey_id||snap.surveyId||null,image_path:snap.image_path||snap.imagePath||null,has_unpublished_changes:true};if(table==='surveys')payload={name:snap.name,settings:snap.settings||{},has_unpublished_changes:true};const r=await sb.from(table).update(payload).eq('id',id);if(r.error){b.textContent='Restore failed';return}location.reload()})
})();