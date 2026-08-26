/* =========================================================
   CAMPAIGN PLATFORM LOCAL UI STORE — Stage 3F
   Supabase is authoritative. This store is only a synchronous
   page cache for the signed-in local account.
   ========================================================= */
window.CP = window.CP || (() => {
  const KEY='campaignPlatformDB:v1';
  const empty=()=>({
    account:null,
    activeWebsiteId:null,
    websites:{},
    campaigns:{},
    surveys:{},
    graphics:{},
    people:{},
    actions:[],
    surveyResponses:[],
    integrations:{},
    history:{}
  });

  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(raw){
        const parsed=JSON.parse(raw);
        return {...empty(),...parsed};
      }
    }catch(_){}
    return empty();
  }
  function save(db){
    localStorage.setItem(KEY,JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('cp:dbchange',{detail:db}));
    return db;
  }
  const db=()=>load();
  const uid=()=>crypto.randomUUID();
  function activeWebsite(){const d=db();return d.activeWebsiteId?d.websites[d.activeWebsiteId]||null:null}
  function setActiveWebsite(id){const d=db();if(d.websites?.[id]){d.activeWebsiteId=id;save(d)}}
  function list(type,filter={}){
    const rows=Object.values(db()[type]||{});
    return rows.filter(x=>Object.entries(filter).every(([k,v])=>x[k]===v));
  }
  function get(type,id){return db()[type]?.[id]||null}
  function put(type,item){const d=db();d[type]=d[type]||{};d[type][item.id]=item;save(d);return item}
  function patch(type,id,changes){
    const d=db();if(!d[type]?.[id])return null;
    d[type][id]={...d[type][id],...changes,updatedAt:new Date().toISOString()};
    save(d);return d[type][id];
  }
  function remove(type,id){
    const d=db();if(d[type])delete d[type][id];
    if(type==='surveys'){
      Object.values(d.websites||{}).forEach(w=>{if(w.surveyId===id)w.surveyId=null});
      Object.values(d.campaigns||{}).forEach(c=>{if(c.surveyId===id)c.surveyId=null});
    }
    if(type==='websites'&&d.activeWebsiteId===id)d.activeWebsiteId=Object.keys(d.websites||{})[0]||null;
    save(d);
  }
  function duplicate(type,id){
    const src=get(type,id);if(!src)return null;
    const copy=structuredClone(src);copy.id=uid();
    if(copy.name)copy.name+=' copy';if(copy.title)copy.title+=' copy';
    if('status' in copy)copy.status=type==='graphics'?'Saved':'Draft';
    copy.updatedAt=new Date().toISOString();
    return put(type,copy);
  }
  function assignSurvey(targetType,targetId,surveyId){
    const d=db();
    if(targetType==='website'&&d.websites?.[targetId])d.websites[targetId].surveyId=surveyId||null;
    if(targetType==='campaign'&&d.campaigns?.[targetId])d.campaigns[targetId].surveyId=surveyId||null;
    save(d);
  }
  function createSurvey(name){
    const item={id:uid(),websiteId:activeWebsite()?.id||null,name,status:'Draft',responses:0,questions:[],settings:{},updatedAt:new Date().toISOString()};
    return put('surveys',item);
  }
  function createCampaign(name){
    const item={id:uid(),websiteId:null,name,slug:String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),status:'Draft',headline:name,support:'',points:['Key point one','Key point two','Key point three'],surveyId:null,supporterCount:0,settings:{},updatedAt:new Date().toISOString()};
    return put('campaigns',item);
  }
  function saveGraphic(g){
    const item={id:g.id||uid(),websiteId:g.websiteId||activeWebsite()?.id||null,status:'Saved',savedAt:new Date().toISOString(),...g};
    return put('graphics',item);
  }
  return {db,save,uid,activeWebsite,setActiveWebsite,list,get,put,patch,remove,duplicate,assignSurvey,createSurvey,createCampaign,saveGraphic};
})();

function esc(v=''){
  return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

(function cpDashboard(){
  if(!document.getElementById('dashSupporters'))return;
  const d=CP.db(), campaigns=Object.values(d.campaigns), surveys=Object.values(d.surveys), people=Object.values(d.people), graphics=Object.values(d.graphics);
  document.getElementById('dashSupporters').textContent=people.length;
  document.getElementById('dashCampaignBackers').textContent=campaigns.reduce((n,c)=>n+(c.supporterCount||0),0);
  document.getElementById('dashSurveyResponses').textContent=surveys.reduce((n,s)=>n+(s.responses||0),0);
  document.getElementById('dashVolunteers').textContent=new Set((d.actions||[]).filter(a=>a.type==='volunteer').map(a=>a.personId).filter(Boolean)).size;
  document.getElementById('dashCampaignList').innerHTML=campaigns.length?campaigns.map(c=>`<div class="campaign-row"><div><strong>${c.name}</strong><small>${c.supporterCount||0} supporters · ${c.status}${c.surveyId?' · Survey linked':''}</small></div><div class="mini-actions"><a class="btn secondary small" href="campaign-overview.html?id=${c.id}">Edit</a><a class="link-arrow" href="campaigns.html">→</a></div></div>`).join(''):'<div class="empty-state-card compact"><p>No campaigns yet.</p></div>';
  const w=d.websites[d.activeWebsiteId];
  document.getElementById('dashWebsiteStatus').innerHTML=w?`<span class="status-chip published">${w.status}</span><h3>${w.domain||w.name}</h3><p class="muted">${w.surveyId?'Survey: '+(d.surveys[w.surveyId]?.name||'Assigned'):'No survey assigned'}</p><a class="btn secondary small" href="editor.html?site=${w.id}">Edit site</a>`:'';
  document.getElementById('dashRecentActivity').innerHTML=(d.actions||[]).slice(0,5).map(a=>`<div class="compact-activity"><div><strong>${a.text}</strong><small>${new Date(a.time).toLocaleString()}</small></div></div>`).join('');
  document.getElementById('dashSurveyList').innerHTML=surveys.map(s=>`<div class="survey-row"><div><strong>${s.name}</strong><small>${s.responses||0} responses · ${s.status}</small></div><a class="link-arrow" href="surveys.html?edit=${s.id}">→</a></div>`).join('');
  document.getElementById('dashCreativeSummary').innerHTML=`<strong style="font-size:28px">${graphics.length}</strong><p class="muted">saved graphic${graphics.length===1?'':'s'} across your campaign.</p>`;
  const connected=Object.values(d.integrations||{}).find(x=>x.connected);
  document.getElementById('dashIntegrationSummary').innerHTML=connected?`<span class="sync-status"><span class="dot"></span> ${esc(connected.label||'CRM')} connected</span><p class="muted">${connected.lastSync?'Last sync '+new Date(connected.lastSync).toLocaleString():'Ready to sync.'}</p>`:'<p class="muted">No external CRM connected.</p>';
})();


CP.archive=function(type,id){return CP.patch(type,id,{status:'Archived'})};
CP.restore=function(type,id){return CP.patch(type,id,{status:'Draft'})};
CP.relationships=function(type,id){
  const d=CP.db();
  if(type==='campaign'){
    const c=d.campaigns[id];
    return {
      website:c?.websiteId?d.websites[c.websiteId]:null,
      survey:c?.surveyId?d.surveys[c.surveyId]:null,
      graphics:Object.values(d.graphics||{}).filter(g=>g.campaignId===id),
      supporters:Object.values(d.people||{}).filter(p=>(d.actions||[]).some(a=>a.personId===p.id&&a.campaignId===id))
    }
  }
  if(type==='survey'){
    const s=d.surveys[id];
    return {
      website:Object.values(d.websites||{}).find(w=>w.surveyId===id)||null,
      campaigns:Object.values(d.campaigns||{}).filter(c=>c.surveyId===id)
    }
  }
  if(type==='graphic'){
    const g=d.graphics[id];
    return {
      website:g?.websiteId?d.websites[g.websiteId]:null,
      campaign:g?.campaignId?d.campaigns[g.campaignId]:null
    }
  }
  return {}
};


/* GLOBAL UNDO */
(function globalUndo(){
  if(document.getElementById('globalUndo'))return;
  const el=document.createElement('div');el.className='undo-global';el.id='globalUndo';el.innerHTML='<span id="globalUndoText">Change made</span><button id="globalUndoBtn">Undo</button>';document.body.appendChild(el);
  let undo=null;
  window.CPUndo=(label,fn)=>{undo=fn;document.getElementById('globalUndoText').textContent=label;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4500)};
  document.getElementById('globalUndoBtn').onclick=()=>{if(undo)undo();undo=null;el.classList.remove('show')}
})();

/* CAMPAIGN OVERVIEW */
(function campaignOverview(){
  const root=document.getElementById('campaignOverviewRoot');if(!root)return;
  const id=new URLSearchParams(location.search).get('id');const c=CP.get('campaigns',id);if(!c){root.innerHTML='<div class="empty-state-card"><h3>Campaign not found</h3></div>';return}
  const rel=CP.relationships('campaign',id);
  const d=CP.db();
  root.innerHTML=`<div class="campaign-overview-head"><div><span class="status-chip ${c.status==='Published'?'published':c.status==='Archived'?'archived':'draft'}">${c.status}</span><h2 style="margin:9px 0 5px">${c.name}</h2><p class="muted">${c.support||''}</p></div><div class="campaign-overview-actions"><a class="btn small" href="campaign-editor.html?id=${c.id}">Edit microsite</a>${rel.survey?`<a class="btn secondary small" href="survey-editor.html?id=${rel.survey.id}">Open survey</a>`:''}<a class="btn secondary small" href="creative-editor.html?template=campaign&campaign=${c.id}">Create graphic</a></div></div>
  <div class="campaign-stat-grid"><div class="campaign-stat"><strong>${c.supporterCount||0}</strong><span>Supporters</span></div><div class="campaign-stat"><strong>${rel.survey?.responses||0}</strong><span>Survey responses</span></div><div class="campaign-stat"><strong>${rel.graphics.length}</strong><span>Saved graphics</span></div><div class="campaign-stat"><strong>${d.integrations?.nationbuilder?.connected?'✓':'—'}</strong><span>CRM sync</span></div></div>
  <div class="dashboard-grid"><section class="panel"><h3>Linked items</h3><div class="linked-list"><div class="linked-item"><div><strong>Microsite</strong><small>Standalone campaign page</small></div><a class="btn secondary small" href="campaign-editor.html?id=${c.id}">Open</a></div><div class="linked-item"><div><strong>Survey</strong><small>${rel.survey?.name||'No survey linked'}</small></div>${rel.survey?`<a class="btn secondary small" href="survey-editor.html?id=${rel.survey.id}">Open</a>`:''}</div><div class="linked-item"><div><strong>Graphics</strong><small>${rel.graphics.length} linked graphic${rel.graphics.length===1?'':'s'}</small></div><a class="btn secondary small" href="creative.html">View</a></div></div></section><section class="panel"><h3>Recent activity</h3>${(d.actions||[]).filter(a=>a.campaignId===id).slice(0,5).map(a=>`<div class="compact-activity"><strong>${a.text}</strong><small>${new Date(a.time).toLocaleString()}</small></div>`).join('')||'<div class="empty-state-card compact"><p>No campaign activity yet.</p></div>'}</section></div>`;
})();

/* CONSISTENT AUTOSAVE INDICATOR */
(function autosavePattern(){
  ['campaignAutosaveText','autosaveText'].forEach(id=>{
    const e=document.getElementById(id);if(e)e.closest('.autosave-indicator,.autosave-pill')?.classList.remove('saving')
  })
})();

/* LIGHTWEIGHT ERROR STATES */
window.addEventListener('error',e=>{
  const app=document.querySelector('.app-content');if(!app||document.getElementById('runtimeErrorBanner'))return;
  const b=document.createElement('div');b.id='runtimeErrorBanner';b.className='state-banner error';b.textContent='Something on this page did not load correctly. Your saved data has not been removed.';app.prepend(b)
});


/* SHARED DATA HELPERS */
CP.history=function(type,id){
  const d=CP.db();
  d.history=d.history||{};
  const key=type+':'+id;
  return d.history[key]||[];
};
CP.snapshot=function(type,id,label='Published'){
  const d=CP.db();
  d.history=d.history||{};
  const key=type+':'+id;
  d.history[key]=d.history[key]||[];
  const item=d[type]?.[id];
  if(!item)return null;
  d.history[key].unshift({id:CP.uid('version'),label,time:new Date().toISOString(),data:JSON.parse(JSON.stringify(item))});
  d.history[key]=d.history[key].slice(0,12);
  CP.save(d);
  return d.history[key][0]
};
CP.restoreVersion=function(type,id,versionId){
  const d=CP.db(),key=type+':'+id;
  const v=(d.history?.[key]||[]).find(x=>x.id===versionId);
  if(!v||!d[type]?.[id])return null;
  d[type][id]={...JSON.parse(JSON.stringify(v.data)),id,updatedAt:new Date().toISOString()};
  CP.save(d);return d[type][id]
};
CP.softDelete=function(type,id){
  const item=CP.get(type,id);if(!item)return null;
  const backup=JSON.parse(JSON.stringify(item));
  CP.remove(type,id);
  return backup
};
CP.createWebsite=function(name,area=''){
  const d=CP.db(),id=CP.uid('site');
  const item={id,name,area,type:'Campaign website',status:'Draft',domain:'',surveyId:null,branding:{primary:'#08254a',secondary:'#1476d4',text:'#ffffff'},updatedAt:new Date().toISOString()};
  d.websites[id]=item;d.activeWebsiteId=id;CP.save(d);return item
};
CP.switchWebsite=function(id){CP.setActiveWebsite(id)};


/* WEBSITE LIBRARY */
(function websiteLibraryShared(){
  const grid=document.getElementById('sharedWebsiteGrid');if(!grid)return;
  function render(){
    const d=CP.db(),items=Object.values(d.websites||{});
    if(!items.length){
      grid.innerHTML='<div class="empty-state-card library-empty"><h3>No websites yet</h3><p>Create your first campaign website to get started.</p><a class="btn" href="website-create.html">Create website</a></div>';return;
    }
    grid.innerHTML=items.map(w=>`<article class="site-card">
      <div style="display:flex;justify-content:space-between;gap:10px"><span class="status-chip ${w.status==='Published'?'published':w.status==='Archived'?'archived':'draft'}">${w.status}</span><div class="entity-menu-wrap"><button class="entity-menu-btn" data-menu-button="${w.id}">•••</button><div class="entity-menu" data-menu="${w.id}"><button data-duplicate-website="${w.id}">Duplicate</button><button data-archive-website="${w.id}">${w.status==='Archived'?'Restore':'Archive'}</button><button data-delete-website="${w.id}">Delete</button></div></div></div>
      <h3>${w.name}</h3><p class="muted">${w.area} · ${w.type||'Website'}</p><p class="muted">${w.domain||'No custom domain'}</p>
      <div class="library-card-actions"><a class="btn small" href="website-overview.html?id=${w.id}">Overview</a><a class="btn secondary small" href="editor.html?site=${encodeURIComponent(w.id)}">Edit</a><button class="btn secondary small" data-switch-website="${w.id}">${d.activeWebsiteId===w.id?'Current':'Switch to'}</button></div>
    </article>`).join('')+`<article class="site-card create-card"><h3>Create another website</h3><p>Use the same account for another ward, candidate or campaign.</p><a class="btn secondary" href="website-create.html">Create website</a></article>`;
    bindMenus();
    grid.querySelectorAll('[data-switch-website]').forEach(b=>b.onclick=()=>{CP.switchWebsite(b.dataset.switchWebsite);render()});
    grid.querySelectorAll('[data-duplicate-website]').forEach(b=>b.onclick=()=>{CP.duplicate('websites',b.dataset.duplicateWebsite);render()});
    grid.querySelectorAll('[data-archive-website]').forEach(b=>b.onclick=()=>{const w=CP.get('websites',b.dataset.archiveWebsite);w.status==='Archived'?CP.restore('websites',w.id):CP.archive('websites',w.id);render()});
    grid.querySelectorAll('[data-delete-website]').forEach(b=>b.onclick=async()=>{const id=b.dataset.deleteWebsite,w=CP.get('websites',id);if(!await CPDialog.confirm({title:'Delete website?',message:`${w.name} will be removed.`,confirm:'Delete'}))return;const backup=CP.softDelete('websites',id);CPUndo('Website deleted',()=>{CP.put('websites',backup);render()});render()})
  }
  function bindMenus(){
    grid.querySelectorAll('[data-menu-button]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();grid.querySelectorAll('.entity-menu').forEach(m=>m.classList.remove('open'));grid.querySelector(`[data-menu="${btn.dataset.menuButton}"]`)?.classList.toggle('open')});
  }
  document.addEventListener('click',()=>grid.querySelectorAll('.entity-menu').forEach(m=>m.classList.remove('open')));
  render()
})();

/* WEBSITE OVERVIEW */
(function websiteOverview(){
  const root=document.getElementById('websiteOverviewRoot');if(!root)return;
  const d=CP.db(),id=new URLSearchParams(location.search).get('id')||d.activeWebsiteId,w=d.websites[id];
  if(!w){root.innerHTML='<div class="empty-state-card"><h3>Website not found</h3></div>';return}
  const campaigns=Object.values(d.campaigns||{}).filter(c=>c.websiteId===id),graphics=Object.values(d.graphics||{}).filter(g=>g.websiteId===id),survey=w.surveyId?d.surveys[w.surveyId]:null,hist=CP.history('websites',id);
  root.innerHTML=`<div class="overview-head"><div><span class="status-chip ${w.status==='Published'?'published':w.status==='Archived'?'archived':'draft'}">${w.status}</span><h2 style="margin:9px 0 5px">${w.name}</h2><p class="muted">${w.area} · ${w.domain||'No custom domain'}</p></div><div class="overview-actions"><a class="btn small" href="editor.html?site=${encodeURIComponent(w.id)}">Edit website</a><button class="btn secondary small" id="websitePublish">${w.status==='Published'?'Publish changes':'Publish'}</button></div></div>
  <div class="overview-stat-grid"><div class="overview-stat"><strong>${campaigns.length}</strong><span>Campaigns</span></div><div class="overview-stat"><strong>${survey?.responses||0}</strong><span>Survey responses</span></div><div class="overview-stat"><strong>${graphics.length}</strong><span>Graphics</span></div><div class="overview-stat"><strong>${d.integrations?.nationbuilder?.connected?'✓':'—'}</strong><span>CRM sync</span></div></div>
  <div class="overview-grid"><section class="panel"><h3>Linked content</h3><div class="overview-list"><div class="overview-item"><div><strong>Survey</strong><small>${survey?.name||'No survey assigned'}</small></div>${survey?`<a class="btn secondary small" href="survey-overview.html?id=${survey.id}">Open</a>`:''}</div>${campaigns.map(c=>`<div class="overview-item"><div><strong>${c.name}</strong><small>Campaign · ${c.status}</small></div><a class="btn secondary small" href="campaign-overview.html?id=${c.id}">Open</a></div>`).join('')||'<div class="empty-state-card compact"><p>No campaigns linked yet.</p></div>'}</div></section><section class="panel"><h3>Publish history</h3><div class="publish-history" id="websitePublishHistory">${hist.length?hist.map(v=>`<div class="publish-version"><div><strong>${v.label}</strong><small>${new Date(v.time).toLocaleString()}</small></div><button class="btn secondary small" data-restore-web="${v.id}">Restore</button></div>`).join(''):'<div class="empty-state-card compact"><p>No previous published versions yet.</p></div>'}</div></section></div>`;
  document.getElementById('websitePublish').onclick=()=>{CP.snapshot('websites',id,'Published version');CP.patch('websites',id,{status:'Published'});location.reload()};
  root.querySelectorAll('[data-restore-web]').forEach(b=>b.onclick=()=>{CP.restoreVersion('websites',id,b.dataset.restoreWeb);location.reload()})
})();

/* CREATIVE OVERVIEW */
(function creativeOverview(){
  const root=document.getElementById('creativeOverviewRoot');if(!root)return;
  const id=new URLSearchParams(location.search).get('id'),g=CP.get('graphics',id);if(!g){root.innerHTML='<div class="empty-state-card"><h3>Graphic not found</h3></div>';return}
  const rel=CP.relationships('graphic',id);
  root.innerHTML=`<div class="overview-head"><div><span class="status-chip draft">Saved</span><h2 style="margin:9px 0 5px" id="graphicName">${g.title||'Campaign graphic'}</h2><p class="muted">${g.format||'square'} · ${g.type||'graphic'}</p></div><div class="overview-actions"><a class="btn small" href="creative-editor.html?template=${g.type||'announcement'}&saved=${g.id}">Edit graphic</a><button class="btn secondary small" id="renameGraphic">Rename</button><button class="btn secondary small" id="duplicateGraphic">Duplicate</button><button class="btn secondary small" id="deleteGraphic">Delete</button></div></div>
  <div class="overview-grid"><section class="panel"><h3>Preview</h3>${g.preview?`<img src="${g.preview}" style="display:block;max-width:420px;width:100%">`:'<div class="empty-state-card compact"><p>Preview unavailable for this older graphic.</p></div>'}</section><section class="panel"><h3>Linked to</h3><div class="overview-list"><div class="overview-item"><div><strong>Website</strong><small>${rel.website?.name||'Not linked'}</small></div>${rel.website?`<a class="btn secondary small" href="website-overview.html?id=${rel.website.id}">Open</a>`:''}</div><div class="overview-item"><div><strong>Campaign</strong><small>${rel.campaign?.name||'Not linked'}</small></div>${rel.campaign?`<a class="btn secondary small" href="campaign-overview.html?id=${rel.campaign.id}">Open</a>`:''}</div></div></section></div>`;
  document.getElementById('renameGraphic').onclick=async()=>{const n=await CPDialog.ask({title:'Rename graphic',label:'Graphic name',value:g.title||'Campaign graphic',confirm:'Rename'});if(n){CP.patch('graphics',id,{title:n});location.reload()}};
  document.getElementById('duplicateGraphic').onclick=()=>{const c=CP.duplicate('graphics',id);if(c)location.href='creative-overview.html?id='+c.id};
  document.getElementById('deleteGraphic').onclick=async()=>{if(!await CPDialog.confirm({title:'Delete graphic?',message:'This graphic will be removed.',confirm:'Delete'}))return;const backup=CP.softDelete('graphics',id);CPUndo('Graphic deleted',()=>CP.put('graphics',backup));location.href='creative.html'}
})();

/* STANDARD AUTOSAVE BINDING */
window.CPAutosave={
  saving(el){if(!el)return;el.classList.add('saving');const span=el.querySelector('span:last-child');if(span)span.textContent='Saving…'},
  saved(el){if(!el)return;el.classList.remove('saving');const span=el.querySelector('span:last-child');if(span)span.textContent='Saved just now'},
  pulse(el){this.saving(el);setTimeout(()=>this.saved(el),650)}
};

/* BROKEN IMAGE STATE */
document.addEventListener('error',e=>{
  if(e.target?.tagName==='IMG'){e.target.style.display='none';const p=document.createElement('div');p.className='state-banner warn';p.textContent='Image preview could not be loaded.';e.target.after(p)}
},true);

(function sharedPeopleEmpty(){
  const root=document.getElementById('peopleSharedEmpty');if(!root)return;
  if(!Object.keys(CP.db().people||{}).length)root.innerHTML='<div class="empty-state-card"><h3>No supporters yet</h3><p>Publish a website, campaign or survey and new supporter activity will appear here.</p><a class="btn" href="websites.html">Open websites</a></div>'
})();


/* Client-facing dialog */
window.CPDialog = {
  ask({title='Enter details',label='Value',value='',placeholder='',confirm='Save'}={}){
    return new Promise(resolve=>{
      document.getElementById('cpDialogBackdrop')?.remove();
      const back=document.createElement('div');back.id='cpDialogBackdrop';back.className='cp-dialog-backdrop';
      back.innerHTML=`<div class="cp-dialog" role="dialog" aria-modal="true"><div class="cp-dialog-head"><h3>${title}</h3><button type="button" class="cp-dialog-x" aria-label="Close">×</button></div><label class="field"><span>${label}</span><input id="cpDialogInput" value="${String(value).replace(/"/g,'&quot;')}" placeholder="${String(placeholder).replace(/"/g,'&quot;')}"></label><div class="cp-dialog-actions"><button class="btn secondary" id="cpDialogCancel">Cancel</button><button class="btn" id="cpDialogConfirm">${confirm}</button></div></div>`;
      document.body.appendChild(back);
      const input=back.querySelector('#cpDialogInput');input.focus();input.select();
      const done=v=>{back.remove();resolve(v)};
      back.querySelector('.cp-dialog-x').onclick=()=>done(null);
      back.querySelector('#cpDialogCancel').onclick=()=>done(null);
      back.querySelector('#cpDialogConfirm').onclick=()=>done(input.value.trim()||null);
      input.addEventListener('keydown',e=>{if(e.key==='Enter')done(input.value.trim()||null);if(e.key==='Escape')done(null)});
      back.addEventListener('click',e=>{if(e.target===back)done(null)})
    })
  },
  confirm({title='Are you sure?',message='',confirm='Continue'}={}){
    return new Promise(resolve=>{
      document.getElementById('cpDialogBackdrop')?.remove();
      const back=document.createElement('div');back.id='cpDialogBackdrop';back.className='cp-dialog-backdrop';
      back.innerHTML=`<div class="cp-dialog" role="dialog" aria-modal="true"><div class="cp-dialog-head"><h3>${title}</h3><button type="button" class="cp-dialog-x">×</button></div><p class="cp-dialog-message">${message}</p><div class="cp-dialog-actions"><button class="btn secondary" id="cpDialogCancel">Cancel</button><button class="btn" id="cpDialogConfirm">${confirm}</button></div></div>`;
      document.body.appendChild(back);
      const done=v=>{back.remove();resolve(v)};
      back.querySelector('.cp-dialog-x').onclick=()=>done(false);back.querySelector('#cpDialogCancel').onclick=()=>done(false);back.querySelector('#cpDialogConfirm').onclick=()=>done(true)
    })
  }
};

