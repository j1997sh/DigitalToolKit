
/* =========================================================
   STAGE 2 — SUPABASE BACKEND BRIDGE
   Supabase is authoritative. localStorage is a synchronous UI cache for the signed-in local account.
   ========================================================= */
(() => {
  'use strict';
  const sb = window.cpSupabase;
  if (!sb || !window.CP) return;

  const DB_KEY = 'campaignPlatformDB:v1';
  const pathname = location.pathname.split('/').pop() || 'index.html';
  const PUBLIC_PAGES = new Set(['index.html','login.html','forgot-password.html','campaign-thanks.html']);
  const PROTECTED = !PUBLIC_PAGES.has(pathname);
  const bootKey = 'cpStage2Hydrated:' + pathname;

  const $ = id => document.getElementById(id);
  const capStatus = s => s === 'published' ? 'Published' : s === 'archived' ? 'Archived' : 'Draft';
  const dbStatus = s => String(s||'draft').toLowerCase();

  function bootOverlay(message='Connecting to Campaign Platform…'){
    if(document.getElementById('cpStage2Boot')) return;
    const el=document.createElement('div');
    el.id='cpStage2Boot';
    el.innerHTML=`<div class="cp-stage2-boot-card"><span class="cp-stage2-spinner"></span><strong>${message}</strong><small>Your campaign data is loading securely.</small></div>`;
    document.body.appendChild(el);
  }
  function removeBoot(){ document.getElementById('cpStage2Boot')?.remove(); }

  function showBackendError(message){
    removeBoot();
    let host=document.querySelector('.app-content')||document.querySelector('.login-card')||document.body;
    let e=document.getElementById('cpBackendError');
    if(!e){e=document.createElement('div');e.id='cpBackendError';e.className='state-banner error';host.prepend(e)}
    e.textContent=message;
  }

  function editorConfigFromWebsite(w){
    const c=w.content||{};
    if(c.candidateName) return {...c, images:c.images||{}};
    const priorities=(c.priorities||[]).map((p,i)=>typeof p==='string'
      ? {title:p,copy:['Push for proper repairs and safer streets.','Back practical action in the neighbourhood.','Stand up for the local services residents rely on.'][i]||''}
      : p);
    return {
      candidateName:w.name||'Candidate',
      candidateInitials:(w.name||'Candidate').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),
      candidateArea:w.area||'Local area',
      candidateTitle:`Candidate for ${w.area||'the local area'}`,
      candidateEmail:'',
      brandNavy:w.branding?.primary||'#08254a',
      brandBlue:w.branding?.secondary||'#1476d4',
      heroHeadline:c.hero?.headline||'A stronger voice for your area.',
      heroCopy:c.hero?.supporting_copy||'Listening to residents and campaigning on the issues that matter locally.',
      heroCta:'Tell us what matters',
      aboutHeadline:c.about?.heading||'Why I’m standing',
      aboutLead:c.about?.body||'Local residents deserve visible, practical representation.',
      aboutCopy:'',
      priorities:priorities.length?priorities:[
        {title:'Roads and pavements',copy:'Push for proper repairs and safer streets.'},
        {title:'Cleaner and safer streets',copy:'Back practical action in the neighbourhood.'},
        {title:'Protecting local services',copy:'Stand up for the services residents rely on.'}
      ],
      surveyIntro:'Tell us what matters most locally.',
      surveyQuestion:'If you could change one thing locally, what would it be?',
      votingIntentEnabled:false,
      campaignTitle:c.campaign?.headline||'Current campaign',
      campaignCopy:'Back the campaign and help make the case for local action.',
      volunteerHeadline:'Help locally',
      volunteer1:'Deliver a few leaflets',
      volunteer2:'Display a poster',
      volunteer3:'Join us on the doorstep',
      volunteer4:'Help online',
      footerDescription:`A local campaign website for ${w.name||'the candidate'} in ${w.area||'the area'}.`,
      sections:[
        {id:'about',visible:true},{id:'priorities',visible:true},{id:'survey',visible:true},
        {id:'campaign',visible:true},{id:'volunteer',visible:true}
      ],
      images:{}
    };
  }

  async function hydrate(){
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError) throw sessionError;
    if(!session){
      if(PROTECTED){
        const next=encodeURIComponent(pathname+location.search);
        location.replace('login.html?next='+next);
      }
      return null;
    }

    if(!PROTECTED) return session;

    const accountRes=await sb.from('accounts').select('*').limit(1).single();
    if(accountRes.error) throw accountRes.error;
    const account=accountRes.data;

    const [
      websitesR,surveysR,questionsR,campaignsR,graphicsR,peopleR,actionsR,
      integrationsR,versionsR,tagsR,personTagsR,surveyResponsesR
    ]=await Promise.all([
      sb.from('websites').select('*').order('created_at'),
      sb.from('surveys').select('*').order('created_at'),
      sb.from('survey_questions').select('*').order('position'),
      sb.from('campaigns').select('*').order('created_at'),
      sb.from('graphics').select('*').order('created_at'),
      sb.from('people').select('*').order('created_at'),
      sb.from('supporter_actions').select('*').order('created_at',{ascending:false}),
      sb.from('integrations').select('*').order('created_at'),
      sb.from('publish_versions').select('*').order('created_at',{ascending:false}),
      sb.from('tags').select('*').order('name'),
      sb.from('person_tags').select('*'),
      sb.from('survey_responses').select('*').order('created_at',{ascending:false})
    ]);
    const responses=[websitesR,surveysR,questionsR,campaignsR,graphicsR,peopleR,actionsR,integrationsR,versionsR,tagsR,personTagsR,surveyResponsesR];
    const err=responses.find(r=>r.error)?.error;
    if(err) throw err;

    const questionsBySurvey={};
    (questionsR.data||[]).forEach(q=>{
      (questionsBySurvey[q.survey_id] ||= []).push({
        id:q.id,type:q.question_type,label:q.label,enabled:q.enabled,required:q.required,options:q.options||[]
      });
    });

    let cached={};try{cached=JSON.parse(localStorage.getItem(DB_KEY)||'{}')}catch(e){}
    let active=cached.activeWebsiteId;
    if(!(websitesR.data||[]).some(w=>w.id===active)) active=websitesR.data?.[0]?.id||null;

    const local={
      account:{id:account.id,name:account.name,firstName:account.first_name||'',lastName:account.last_name||'',ownerUserId:account.owner_user_id},
      activeWebsiteId:active,
      websites:{},campaigns:{},surveys:{},graphics:{},people:{},
      actions:[],surveyResponses:[],integrations:{},history:{}
    };

    (websitesR.data||[]).forEach(w=>local.websites[w.id]={
      id:w.id,name:w.name,area:w.area||'',type:w.site_type||'campaign_site',
      status:capStatus(w.status),domain:w.domain||'',slug:w.slug||'',
      surveyId:w.selected_survey_id||null,branding:w.branding||{},
      content:w.content||{},heroImagePath:w.hero_image_path||null,aboutImagePath:w.about_image_path||null,updatedAt:w.updated_at
    });

    (surveysR.data||[]).forEach(s=>local.surveys[s.id]={
      id:s.id,websiteId:s.website_id||null,name:s.name,status:capStatus(s.status),
      responses:s.response_count||0,settings:s.settings||{},
      questions:questionsBySurvey[s.id]||[],updatedAt:s.updated_at
    });

    (campaignsR.data||[]).forEach(c=>local.campaigns[c.id]={
      id:c.id,websiteId:c.website_id,surveyId:c.survey_id||null,name:c.name,slug:c.slug||'',
      status:capStatus(c.status),headline:c.headline||c.name,support:c.supporting_copy||'',
      imagePath:c.image_path||null,previewPath:c.preview_path||null,points:c.key_points||[],settings:c.settings||{},
      supporterCount:c.supporter_count||0,updatedAt:c.updated_at
    });

    (graphicsR.data||[]).forEach(g=>local.graphics[g.id]={
      id:g.id,websiteId:g.website_id||null,campaignId:g.campaign_id||null,
      title:g.title,type:g.graphic_type,format:g.format,status:g.status==='archived'?'Archived':'Saved',
      ...g.state,previewPath:g.preview_path||null,savedAt:g.updated_at
    });

    const tagById=Object.fromEntries((tagsR.data||[]).map(t=>[t.id,t]));
    const tagsByPerson={};
    (personTagsR.data||[]).forEach(pt=>{const t=tagById[pt.tag_id];if(t)(tagsByPerson[pt.person_id] ||= []).push(t)});
    (peopleR.data||[]).forEach(p=>local.people[p.id]={
      id:p.id,name:[p.first_name,p.last_name].filter(Boolean).join(' ')||p.email||'Supporter',
      firstName:p.first_name||'',lastName:p.last_name||'',email:p.email||'',postcode:p.postcode||'',
      phone:p.phone||'',source:p.source||'',votingIntention:p.voting_intention||'',
      notes:p.notes||'',external:p.external_ids||{},consentEmail:p.consent_email,
      firstTouch:p.first_touch_attribution||{},lastTouch:p.last_touch_attribution||{},
      firstTouchAt:p.first_touch_at||null,lastTouchAt:p.last_touch_at||null,
      firstSessionId:p.first_session_id||null,lastSessionId:p.last_session_id||null,
      tags:tagsByPerson[p.id]||[]
    });

    local.actions=(actionsR.data||[]).map(a=>({
      id:a.id,type:a.action_type,personId:a.person_id,websiteId:a.website_id,
      campaignId:a.campaign_id,surveyId:a.survey_id,
      text:a.payload?.text||a.action_type,time:a.created_at,payload:a.payload||{},
      sessionId:a.session_id||null,attribution:a.attribution||{}
    }));

    local.surveyResponses=(surveyResponsesR.data||[]).map(r=>({
      id:r.id,surveyId:r.survey_id,personId:r.person_id,answers:r.answers||{},
      source:r.source||'',createdAt:r.created_at,sessionId:r.session_id||null,attribution:r.attribution||{}
    }));

    (integrationsR.data||[]).forEach(i=>local.integrations[i.provider]={
      id:i.id,label:i.provider,status:i.status,connected:i.status==='connected',
      lastSync:i.last_sync_at,lastError:i.last_error,settings:i.settings||{}
    });

    (versionsR.data||[]).forEach(v=>{
      const key=(v.entity_type==='website'?'websites':v.entity_type==='campaign'?'campaigns':'surveys')+':'+v.entity_id;
      (local.history[key] ||= []).push({id:v.id,label:v.label||'Published version',time:v.created_at,data:v.snapshot});
    });

    
  // Supabase RLS already limits these queries to the signed-in local account.
    // Replace the synchronous UI cache with that authoritative dataset.
    localStorage.setItem(DB_KEY,JSON.stringify(local));
    if(active){
      localStorage.setItem('cpCurrentSite',active);
      localStorage.setItem('cpCurrentSiteShared',active);
    }

    const cpSitesObj={};
    (websitesR.data||[]).forEach(w=>{
      cpSitesObj[w.id]={
        name:w.name,area:w.area||'',status:w.status==='published'?'live':w.status,
        config:editorConfigFromWebsite(w)
      };
    });
    localStorage.setItem('cpSites',JSON.stringify(cpSitesObj));
    return session;
  }

  // -------------------------------------------------------
  // Auth UI
  // -------------------------------------------------------
  async function bindAuth(){
    const login=document.querySelector('form[data-stage2-login]');
    if(login){
      const email=login.querySelector('input[type=email]');
      const password=login.querySelector('input[type=password]');
      email.value=''; password.value='';
      login.closest('.login-card')?.querySelector('.muted')?.replaceChildren(document.createTextNode('Sign in to your Campaign Platform account.'));
      login.addEventListener('submit',async e=>{
        e.preventDefault(); e.stopImmediatePropagation();
        const button=login.querySelector('button[type=submit]');
        const old=button.textContent;button.disabled=true;button.textContent='Signing in…';
        document.getElementById('loginError')?.remove();
        const {error}=await sb.auth.signInWithPassword({email:email.value.trim(),password:password.value});
        if(error){
          const n=document.createElement('div');n.id='loginError';n.className='state-banner error';n.textContent=error.message;login.prepend(n);
          button.disabled=false;button.textContent=old;return;
        }
        sessionStorage.clear();
        const next=new URLSearchParams(location.search).get('next')||'dashboard.html';
        location.href=next;
      },true);
    }

    const reset=document.querySelector('form[data-stage2-reset]');
    if(reset){
      reset.addEventListener('submit',async e=>{
        e.preventDefault();
        const email=reset.querySelector('input[type=email]').value.trim();
        const btn=reset.querySelector('button');btn.disabled=true;btn.textContent='Sending…';
        const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:new URL('login.html',location.href).href});
        const msg=document.createElement('div');msg.className='state-banner '+(error?'error':'success');msg.textContent=error?error.message:'Reset link sent. Check your inbox.';
        reset.prepend(msg);btn.disabled=false;btn.textContent='Send reset link';
      })
    }

    const logout=document.getElementById('logoutLink');
    if(logout) logout.addEventListener('click',async e=>{
      e.preventDefault(); await sb.auth.signOut();
      localStorage.removeItem(DB_KEY);localStorage.removeItem('cpSites');sessionStorage.clear();
      location.href='login.html'
    },true);
  }


  window.CPStage2 = window.CPStage2 || {};
  window.CPStage2.addPersonTag=async(personId,tagName)=>{
    const {error}=await sb.rpc('add_person_tag',{p_person_id:personId,p_tag:tagName});
    if(error)throw error;
  };
  window.CPStage2.removePersonTag=async(personId,tagId)=>{
    const {error}=await sb.rpc('remove_person_tag',{p_person_id:personId,p_tag_id:tagId});
    if(error)throw error;
  };
  window.CPStage2.uploadAsset=async(file,folder)=>{
    const d=CP.db(),account=d.account?.id;
    if(!account)throw new Error('Account unavailable');
    const ext=(file.name.split('.').pop()||'bin').toLowerCase();
    const safe=(file.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'asset');
    const path=`${account}/${folder}/${Date.now()}-${safe}.${ext}`;
    const {error}=await sb.storage.from('campaign-assets').upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(error)throw error;
    return path;
  };
  window.CPStage2.signedAssetUrl=async(path,seconds=3600)=>{
    if(!path)return null;
    const {data,error}=await sb.storage.from('campaign-assets').createSignedUrl(path,seconds);
    if(error)throw error;return data.signedUrl;
  };


  // -------------------------------------------------------
  // Transactional create flows — persist before navigation
  // -------------------------------------------------------
  window.CPStage2.createWebsiteRemote=async(name,area='',surveyId=null)=>{
    const aid=await accountId();
    const id=crypto.randomUUID();
    const payload={
      id,account_id:aid,name,area:area||null,site_type:'campaign_site',status:'draft',
      domain:null,slug:String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
      selected_survey_id:surveyId||null,
      branding:{primary:'#08254a',secondary:'#1476d4',text:'#ffffff'},
      content:{}
    };
    const {data,error}=await sb.from('websites').insert(payload).select('*').single();
    if(error)throw error;
    return data;
  };

  window.CPStage2.createSurveyRemote=async(name,websiteId)=>{
    const aid=await accountId();
    const id=crypto.randomUUID();
    const {data,error}=await sb.from('surveys').insert({
      id,account_id:aid,website_id:websiteId||null,name,status:'draft',
      settings:{submit_label:'Send my views',collect_email:true},response_count:0
    }).select('*').single();
    if(error)throw error;
    return data;
  };

  window.CPStage2.createCampaignRemote=async(name,surveyId=null)=>{
    const aid=await accountId();
    const id=crypto.randomUUID();
    const slug=String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const {data,error}=await sb.from('campaigns').insert({
      id,account_id:aid,website_id:null,survey_id:surveyId||null,name,slug,status:'draft',
      headline:name,supporting_copy:'',key_points:['Key point one','Key point two','Key point three'],
      settings:{},supporter_count:0
    }).select('*').single();
    if(error)throw error;
    return data;
  };

  function setCreateBusy(button,label='Creating…'){
    if(!button)return()=>{};
    const old=button.textContent;button.disabled=true;button.textContent=label;
    return()=>{button.disabled=false;button.textContent=old};
  }

  function bindTransactionalCreates(){
    // Website create wizard.
    const wc=document.getElementById('wcCreate');
    if(wc){
      wc.onclick=async()=>{
        const done=setCreateBusy(wc);
        try{
          const name=document.getElementById('wcName')?.value.trim();
          const area=document.getElementById('wcArea')?.value.trim()||'';
          const surveyId=document.getElementById('wcSurvey')?.value||null;
          if(!name){done();return}
          const row=await window.CPStage2.createWebsiteRemote(name,area,surveyId);
          sessionStorage.clear();
          location.href='website-overview.html?id='+encodeURIComponent(row.id);
        }catch(err){done();showBackendError('Could not create website: '+err.message)}
      };
    }

    // Campaign + Survey guided create wizard.
    const confirm=document.getElementById('createConfirm');
    const flow=document.querySelector('[data-create-kind]');
    if(confirm&&flow){
      confirm.onclick=async()=>{
        const done=setCreateBusy(confirm);
        try{
          const kind=flow.dataset.createKind;
          const name=document.getElementById('createName')?.value.trim();
          const websiteId=document.getElementById('createWebsite')?.value;
          const surveyId=document.getElementById('createSurvey')?.value||null;
          if(!name||!websiteId){done();return}
          if(kind==='campaign'){
            const row=await window.CPStage2.createCampaignRemote(name,websiteId,surveyId);
            sessionStorage.clear();
            location.href='campaign-overview.html?id='+encodeURIComponent(row.id);
          }else{
            const row=await window.CPStage2.createSurveyRemote(name,websiteId);
            sessionStorage.clear();
            location.href='survey-editor.html?id='+encodeURIComponent(row.id);
          }
        }catch(err){done();showBackendError('Could not create '+flow.dataset.createKind+': '+err.message)}
      };
    }

    // Survey library is dynamically rendered. Capture the click so the
    // obsolete local handler never gets a chance to run.
    document.addEventListener('click',e=>{
      const surveyCreate=e.target.closest('#createAnotherSurvey,#createFirstSurvey');
      if(surveyCreate){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        location.href='survey-create.html';
        return;
      }
      const campaignNew=e.target.closest('#newCampaignBtn');
      if(campaignNew){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        location.href='campaign-create.html';
      }
    },true);
  }

  // -------------------------------------------------------
  // Sync helpers
  // -------------------------------------------------------
  const timers=new Map();
  function debounce(key,fn,delay=450){
    clearTimeout(timers.get(key));
    timers.set(key,setTimeout(()=>{timers.delete(key);fn().catch(err=>showBackendError('Could not save to Supabase: '+err.message))},delay));
  }

  async function accountId(){
    const d=CP.db(); if(d.account?.id) return d.account.id;
    const r=await sb.from('accounts').select('id').limit(1).single();
    if(r.error) throw r.error; return r.data.id;
  }

  async function syncWebsite(w){
    const aid=await accountId();
    const payload={
      id:w.id,account_id:aid,name:w.name,area:w.area||null,site_type:w.type||'campaign_site',
      status:dbStatus(w.status),domain:w.domain||null,slug:w.slug||null,
      selected_survey_id:w.surveyId||null,branding:w.branding||{},content:w.content||{},
      hero_image_path:w.heroImagePath||null,about_image_path:w.aboutImagePath||null
    };
    const r=await sb.from('websites').upsert(payload);
    if(r.error) throw r.error;
  }
  async function syncCampaign(c){
    const aid=await accountId();
    const r=await sb.from('campaigns').upsert({
      id:c.id,account_id:aid,website_id:null,survey_id:c.surveyId||null,
      name:c.name,slug:c.slug||null,status:dbStatus(c.status),headline:c.headline||c.name,
      supporting_copy:c.support||'',image_path:c.imagePath||null,preview_path:c.previewPath||null,key_points:c.points||[],
      settings:c.settings||{},supporter_count:c.supporterCount||0
    }); if(r.error) throw r.error;
  }
  async function syncSurvey(s){
    const aid=await accountId();
    let r=await sb.from('surveys').upsert({
      id:s.id,account_id:aid,website_id:s.websiteId||null,name:s.name,status:dbStatus(s.status),
      settings:s.settings||{},response_count:s.responses||0
    }); if(r.error) throw r.error;
    r=await sb.from('survey_questions').delete().eq('survey_id',s.id); if(r.error) throw r.error;
    if((s.questions||[]).length){
      r=await sb.from('survey_questions').insert((s.questions||[]).map((q,i)=>({
        id:isUuid(q.id)?q.id:crypto.randomUUID(),survey_id:s.id,position:i+1,
        question_type:q.type,label:q.label,enabled:q.enabled!==false,required:!!q.required,options:q.options||[]
      }))); if(r.error) throw r.error;
    }
  }
  async function syncGraphic(g){
    const aid=await accountId();
    const state={...g};['id','websiteId','campaignId','title','type','format','status','previewPath','savedAt'].forEach(k=>delete state[k]);
    const r=await sb.from('graphics').upsert({
      id:g.id,account_id:aid,website_id:g.websiteId||null,campaign_id:g.campaignId||null,
      title:g.title||'Campaign graphic',graphic_type:g.type||'announcement',format:g.format||'square',
      status:String(g.status||'saved').toLowerCase()==='archived'?'archived':'saved',
      state,preview_path:g.previewPath||null
    }); if(r.error) throw r.error;
  }
  async function deleteRemote(type,id){
    const table={websites:'websites',campaigns:'campaigns',surveys:'surveys',graphics:'graphics',people:'people'}[type];
    if(!table)return;const r=await sb.from(table).delete().eq('id',id);if(r.error)throw r.error
  }
  function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
  function queueSync(type,item){
    if(!item||!isUuid(item.id)) return;
    const fn={websites:syncWebsite,campaigns:syncCampaign,surveys:syncSurvey,graphics:syncGraphic}[type];
    if(fn) debounce(type+':'+item.id,()=>fn(item));
  }

  function installCPBridge(){
    // UUIDs from now on, so records can be written directly to Postgres.
    CP.uid=()=>crypto.randomUUID();

    const originalPut=CP.put.bind(CP),originalPatch=CP.patch.bind(CP),originalRemove=CP.remove.bind(CP);
    CP.put=(type,item)=>{const out=originalPut(type,item);queueSync(type,out);return out};
    CP.patch=(type,id,changes)=>{const out=originalPatch(type,id,changes);queueSync(type,out);return out};
    CP.remove=(type,id)=>{const out=originalRemove(type,id);debounce('delete:'+type+':'+id,()=>deleteRemote(type,id),50);return out};

    CP.createSurvey=(name)=>{
      const d=CP.db(),w=d.websites[d.activeWebsiteId],item={
        id:crypto.randomUUID(),websiteId:w?.id||null,name,status:'Draft',responses:0,questions:[],
        settings:{},updatedAt:new Date().toISOString()
      }; return CP.put('surveys',item)
    };
    CP.createCampaign=(name)=>{
      const d=CP.db(),w=d.websites[d.activeWebsiteId],item={
        id:crypto.randomUUID(),websiteId:w?.id||null,name,
        slug:String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
        status:'Draft',headline:name,support:'',points:['Key point one','Key point two','Key point three'],
        surveyId:w?.surveyId||null,supporterCount:0,settings:{},updatedAt:new Date().toISOString()
      }; return CP.put('campaigns',item)
    };
    CP.saveGraphic=(g)=>{
      const d=CP.db(),w=d.websites[d.activeWebsiteId],item={
        id:isUuid(g.id)?g.id:crypto.randomUUID(),websiteId:w?.id||null,status:'Saved',
        savedAt:new Date().toISOString(),...g
      }; if(!isUuid(item.id))item.id=crypto.randomUUID();return CP.put('graphics',item)
    };
    CP.createWebsite=(name,area='')=>{
      const d=CP.db(),item={
        id:crypto.randomUUID(),name,area,type:'campaign_site',status:'Draft',domain:'',slug:'',
        surveyId:null,branding:{primary:'#08254a',secondary:'#1476d4',text:'#ffffff'},content:{},
        updatedAt:new Date().toISOString()
      };
      d.websites[item.id]=item;d.activeWebsiteId=item.id;CP.save(d);queueSync('websites',item);return item
    };
    CP.duplicate=(type,id)=>{
      const src=CP.get(type,id);if(!src)return null;
      const copy=JSON.parse(JSON.stringify(src));copy.id=crypto.randomUUID();
      if(copy.name)copy.name+=' copy';if(copy.title)copy.title+=' copy';
      if('status' in copy)copy.status=type==='graphics'?'Saved':'Draft';
      copy.updatedAt=new Date().toISOString();return CP.put(type,copy)
    };

    const origAssign=CP.assignSurvey.bind(CP);
    CP.assignSurvey=(targetType,targetId,surveyId)=>{
      origAssign(targetType,targetId,surveyId);
      if(targetType==='website')queueSync('websites',CP.get('websites',targetId));
      if(targetType==='campaign')queueSync('campaigns',CP.get('campaigns',targetId));
    };

    if(CP.snapshot){
      const origSnapshot=CP.snapshot.bind(CP);
      CP.snapshot=(type,id,label='Published version')=>{
        const v=origSnapshot(type,id,label);
        const d=CP.db(),singular=type==='websites'?'website':type==='campaigns'?'campaign':'survey';
        if(v&&isUuid(id)) debounce('version:'+v.id,async()=>{
          const r=await sb.from('publish_versions').insert({
            account_id:d.account.id,entity_type:singular,entity_id:id,label,snapshot:CP.get(type,id)
          });if(r.error)throw r.error
        },50);
        return v
      }
    }

    // Website visual editor still uses cpSites; sync its full config into websites.content.
    if(typeof saveSites==='function'){
      const localSaveSites=saveSites;
      saveSites=function(sites){
        localSaveSites(sites);
        const d=CP.db();
        Object.entries(sites||{}).forEach(([id,s])=>{
          if(!isUuid(id)||!d.websites[id])return;
          d.websites[id]={...d.websites[id],name:s.name||d.websites[id].name,area:s.area||d.websites[id].area,
            status:s.status==='live'?'Published':capStatus(s.status),content:s.config||{},
            branding:{primary:s.config?.brandNavy||'#08254a',secondary:s.config?.brandBlue||'#1476d4',text:'#ffffff'}};
          CP.save(d);queueSync('websites',d.websites[id])
        })
      }
    }
  }


  // Keep "View public site" tied to the currently selected real website.
  document.querySelectorAll('a[href="public-site.html"]').forEach(a=>{
    const current=CP.db().activeWebsiteId;
    if(current)a.href='public-site.html?site='+encodeURIComponent(current)
  });



  function renderStage2Person(){
    if(pathname!=='person.html')return;
    const root=document.querySelector('.app-content');if(!root)return;
    const id=new URLSearchParams(location.search).get('id');
    const d=CP.db(),p=d.people?.[id];
    if(!p){
      root.innerHTML=`<a class="text-button" href="people.html">← Back to people</a><div class="empty-state-card" style="margin-top:18px"><h3>Supporter not found</h3><p>This supporter may have been removed, or this is an old link.</p><a class="btn secondary" href="people.html">Open People</a></div>`;
      return;
    }
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const acts=(d.actions||[]).filter(a=>a.personId===id).sort((a,b)=>new Date(b.time)-new Date(a.time));
    const responses=(d.surveyResponses||[]).filter(r=>r.personId===id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const surveys=d.surveys||{},campaigns=d.campaigns||{};
    const initials=(p.name||'S').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();

    function answerLabel(survey,qid){
      const s=surveys[survey];const q=(s?.questions||[]).find(x=>x.id===qid);
      return q?.label||'Question';
    }
    function answerValue(v){
      if(Array.isArray(v))return v.join(', ');
      if(v===true)return 'Yes';if(v===false)return 'No';
      return String(v??'');
    }

    root.innerHTML=`<a class="text-button" href="people.html">← Back to people</a>
      <div class="page-intro" style="margin-top:10px"><div><h2>Supporter profile</h2><p>Real supporter data from Supabase.</p></div><button class="btn secondary small" id="stage2EditPerson">Edit details</button></div>
      <div class="person-profile-grid">
        <aside class="panel person-profile-card">
          <div class="person-avatar">${esc(initials)}</div>
          <h2>${esc(p.name)}</h2>
          <div class="person-tag-stack" id="profileTags">${(p.tags||[]).map(t=>`<span class="person-tag">${esc(t.name)} <button data-remove-profile-tag="${t.id}">×</button></span>`).join('')||'<span class="muted">No tags</span>'}</div>
          <button class="text-button" id="profileAddTag" style="margin:8px 0 16px">+ Add tag</button>
          <dl class="profile-data">
            <dt>Email</dt><dd>${esc(p.email||'—')}</dd>
            <dt>Postcode</dt><dd>${esc(p.postcode||'—')}</dd>
            <dt>Phone</dt><dd>${esc(p.phone||'—')}</dd>
            <dt>Email consent</dt><dd>${p.consentEmail===true?'<span class="success-text">Opted in</span>':'No / unknown'}</dd>
            <dt>Acquisition source</dt><dd>${esc(p.source||'—')}</dd>
            <dt>Voting intention</dt><dd>${esc(p.votingIntention||'Not asked')}</dd>
          </dl>
          <label class="field"><span>Notes</span><textarea id="profileNotes" placeholder="Add a campaign note">${esc(p.notes||'')}</textarea></label>
          <button class="btn secondary small" id="saveProfileNotes">Save notes</button>
        </aside>
        <div class="person-profile-main">
          <section class="panel person-attribution-panel">
            <div class="panel-head"><div><h3>Attribution</h3><p class="muted">How this supporter first found the campaign and what converted them most recently.</p></div></div>
            <div class="person-attribution-grid">
              <div><span>First touch</span><strong>${esc(p.firstTouch?.utm_source||p.firstTouch?.source||'Direct / unknown')}</strong><small>${[p.firstTouch?.utm_medium,p.firstTouch?.utm_campaign].filter(Boolean).map(esc).join(' · ')||'No UTM detail'}</small></div>
              <div><span>Last touch</span><strong>${esc(p.lastTouch?.utm_source||p.lastTouch?.source||'Direct / unknown')}</strong><small>${[p.lastTouch?.utm_medium,p.lastTouch?.utm_campaign].filter(Boolean).map(esc).join(' · ')||'No UTM detail'}</small></div>
              <div><span>Landing page</span><strong>${esc(p.firstTouch?.landing_path||'—')}</strong><small>${p.firstTouchAt?new Date(p.firstTouchAt).toLocaleString():'First visit time not recorded'}</small></div>
              <div><span>Latest conversion</span><strong>${esc((acts[0]?.attribution?.utm_campaign)||acts[0]?.type||'—')}</strong><small>${acts[0]?.time?new Date(acts[0].time).toLocaleString():'No conversion recorded'}</small></div>
            </div>
          </section>
          <section class="panel" style="margin-top:16px">
            <div class="panel-head"><div><h3>Activity timeline</h3><p class="muted">${acts.length} recorded action${acts.length===1?'':'s'}</p></div></div>
            <div class="activity-timeline">${acts.length?acts.map(a=>`<div class="timeline-item"><span class="timeline-dot"></span><div><strong>${esc(a.text||a.type)}</strong><small>${new Date(a.time).toLocaleString()}${a.source?' · '+esc(a.source):''}</small>${a.campaignId&&campaigns[a.campaignId]?`<a href="campaign-overview.html?id=${a.campaignId}">${esc(campaigns[a.campaignId].name)}</a>`:''}</div></div>`).join(''):'<div class="empty-state-card compact"><p>No recorded actions yet.</p></div>'}</div>
          </section>
          <section class="panel" style="margin-top:16px">
            <div class="panel-head"><div><h3>Survey responses</h3><p class="muted">${responses.length} response${responses.length===1?'':'s'}</p></div></div>
            <div class="response-list">${responses.length?responses.map(r=>{
              const s=surveys[r.surveyId];
              return `<article class="response-card"><div class="response-card-head"><div><strong>${esc(s?.name||'Survey')}</strong><small>${new Date(r.createdAt).toLocaleString()} · ${esc(r.source||'website')}</small></div>${s?`<a class="btn secondary small" href="survey-overview.html?id=${s.id}">Open survey</a>`:''}</div><dl class="response-answers">${Object.entries(r.answers||{}).map(([qid,v])=>`<div><dt>${esc(answerLabel(r.surveyId,qid))}</dt><dd>${esc(answerValue(v)||'—')}</dd></div>`).join('')||'<p class="muted">No answers stored.</p>'}</dl></article>`
            }).join(''):'<div class="empty-state-card compact"><p>No survey responses for this supporter yet.</p></div>'}</div>
          </section>
        </div>
      </div>`;

    document.getElementById('profileAddTag').onclick=async()=>{
      const tag=await CPDialog.ask({title:'Add tag',label:'Tag name',placeholder:'e.g. Volunteer'});if(!tag)return;
      try{await window.CPStage2.addPersonTag(id,tag);sessionStorage.clear();location.reload()}catch(e){showBackendError('Could not add tag: '+e.message)}
    };
    root.querySelectorAll('[data-remove-profile-tag]').forEach(b=>b.onclick=async()=>{
      try{await window.CPStage2.removePersonTag(id,b.dataset.removeProfileTag);sessionStorage.clear();location.reload()}catch(e){showBackendError('Could not remove tag: '+e.message)}
    });
    document.getElementById('saveProfileNotes').onclick=async()=>{
      const notes=document.getElementById('profileNotes').value;
      const {error}=await sb.from('people').update({notes}).eq('id',id);
      if(error){showBackendError('Could not save notes: '+error.message);return}
      const btn=document.getElementById('saveProfileNotes');btn.textContent='Saved';setTimeout(()=>btn.textContent='Save notes',800)
    };
    document.getElementById('stage2EditPerson').onclick=()=>{
      document.getElementById('profileNotes').focus()
    };
  }


  function enhanceStage2SurveyOverview(){
    if(pathname!=='survey-overview.html')return;
    const root=document.getElementById('surveyOverviewRoot');if(!root)return;
    const id=new URLSearchParams(location.search).get('id'),d=CP.db(),s=d.surveys?.[id];
    if(!s)return;
    const responses=(d.surveyResponses||[]).filter(r=>r.surveyId===id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const people=d.people||{};
    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const answerValue=v=>Array.isArray(v)?v.join(', '):String(v??'');
    const qById=Object.fromEntries((s.questions||[]).map(q=>[q.id,q]));

    let section=document.getElementById('stage2SurveyResponses');
    if(!section){
      section=document.createElement('section');section.className='panel';section.id='stage2SurveyResponses';section.style.marginTop='16px';root.appendChild(section)
    }
    section.innerHTML=`<div class="panel-head"><div><h3>Responses</h3><p class="muted">${responses.length} stored response${responses.length===1?'':'s'}</p></div><button class="btn secondary small" id="exportSurveyResponses">Export CSV</button></div>
      <div class="response-list">${responses.length?responses.map(r=>{
        const person=people[r.personId];
        return `<article class="response-card"><div class="response-card-head"><div><strong>${esc(person?.name||'Anonymous supporter')}</strong><small>${new Date(r.createdAt).toLocaleString()} · ${esc(r.source||'website')}</small></div>${person?`<a class="btn secondary small" href="person.html?id=${person.id}">View person</a>`:''}</div><dl class="response-answers">${Object.entries(r.answers||{}).map(([qid,v])=>`<div><dt>${esc(qById[qid]?.label||'Question')}</dt><dd>${esc(answerValue(v)||'—')}</dd></div>`).join('')}</dl></article>`
      }).join(''):'<div class="empty-state-card compact"><p>No responses yet.</p></div>'}</div>`;

    document.getElementById('exportSurveyResponses').onclick=()=>{
      const headers=['Submitted','Person','Email','Postcode',...(s.questions||[]).map(q=>q.label)];
      const rows=[headers,...responses.map(r=>{
        const p=people[r.personId]||{};
        return [new Date(r.createdAt).toISOString(),p.name||'',p.email||'',p.postcode||'',...(s.questions||[]).map(q=>answerValue(r.answers?.[q.id]))]
      })];
      const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=(s.name||'survey').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-responses.csv';a.click()
    };
  }


  function enhanceStage2SurveyEditorResults(){
    if(pathname!=='survey-editor.html')return;
    const id=new URLSearchParams(location.search).get('id'),d=CP.db(),s=d.surveys?.[id];
    if(!s)return;
    const responses=(d.surveyResponses||[]).filter(r=>r.surveyId===id);
    document.querySelectorAll('[data-editor-tab="results"]').forEach(btn=>btn.addEventListener('click',()=>{
      setTimeout(()=>{
        const host=document.getElementById('sharedSurveyResults');if(!host)return;
        host.innerHTML=`<div class="overview-stat-grid"><div class="overview-stat"><strong>${responses.length}</strong><span>Responses</span></div><div class="overview-stat"><strong>${(s.questions||[]).filter(q=>q.enabled).length}</strong><span>Active questions</span></div></div><p><a class="btn secondary small" href="survey-overview.html?id=${id}">View all responses</a></p>`
      },20)
    },true))
  }


  function renderStage2CampaignMicrositeEditor(){
    if(pathname!=='campaign-editor.html')return;
    const root=document.getElementById('campaignMicrositeEditor');if(!root)return;
    const id=new URLSearchParams(location.search).get('id');
    const d=CP.db(),campaign=d.campaigns?.[id];
    if(!campaign){
      root.innerHTML='<div class="empty-state-card"><h3>Campaign not found</h3><p>This campaign may have been removed or not finished saving.</p><a class="btn secondary" href="campaigns.html">Back to campaigns</a></div>';
      return;
    }

    const website=d.websites?.[campaign.websiteId];
    const surveys=d.surveys||{};
    const frame=document.getElementById('campaignMicrositeFrame');
    const overlay=document.getElementById('campaignMicrositeOverlay');
    const workspace=document.getElementById('campaignMicrositeWorkspace');
    const drawer=document.getElementById('campaignMicrositeDrawer');
    const drawerBody=document.getElementById('campaignMicrositeDrawerBody');
    const drawerTitle=document.getElementById('campaignMicrositeDrawerTitle');
    const saveState=document.getElementById('campaignMicrositeSaveState');

    document.getElementById('campaignMicrositeTitle').textContent=campaign.name;
    document.getElementById('campaignMicrositeMeta').textContent=`${campaign.status} · ${website?.name||'Website'} · ${campaign.slug||''}`;
    document.getElementById('campaignBackLink').href='campaign-overview.html?id='+encodeURIComponent(id);

    const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const brandNavy=website?.branding?.primary||'#08254a';
    const brandBlue=website?.branding?.secondary||'#1476d4';

    let signedImage=null;
    async function resolveImage(){
      if(!campaign.imagePath){signedImage=null;return}
      try{signedImage=await window.CPStage2.signedAssetUrl(campaign.imagePath,3600)}catch(e){signedImage=null}
    }

    function selectedSurvey(){return campaign.surveyId?surveys[campaign.surveyId]:null}

    function campaignHTML(){
      const survey=selectedSurvey();
      const pts=(campaign.points||[]).slice(0,3);
      const vi=campaign.settings?.collect_voting_intention===true;
      const imprint=campaign.settings?.imprint||`Promoted by ${website?.name||'the campaign'} for ${website?.area||'the local area'}.`;
      const thankYou=campaign.settings?.thank_you_message||'Thank you for backing the campaign.';
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      *{box-sizing:border-box}body{margin:0;font-family:"Proxima Nova","Avenir Next",Arial,sans-serif;color:${brandNavy}}.wrap{width:min(940px,calc(100% - 40px));margin:auto}
      .hero{background:${brandNavy};color:#fff;padding:76px 0}.hero h1{font-size:68px;line-height:.92;letter-spacing:-.045em;margin:0 0 16px}.hero p{font-size:20px;max-width:720px}
      .image{height:390px;background:#d8e2eb center/cover no-repeat}.points{background:#f2f6fa;padding:50px 0}.pointgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.point{background:#fff;border:1px solid #d7e1eb;padding:18px;font-weight:900}
      .signup{padding:50px 0}.box{max-width:680px;border:1px solid #d7e1eb;padding:22px}.box input,.box select{width:100%;padding:11px;border:1px solid #cbd7e3;margin:5px 0}.btn{border:0;background:${brandBlue};color:#fff;padding:13px 17px;font-weight:900}
      footer{background:#061a34;color:#fff;padding:26px 0;font-size:12px}.thankyou{font-size:12px;color:#6b7b90;margin-top:8px}
      @media(max-width:700px){.hero h1{font-size:50px}.pointgrid{grid-template-columns:1fr}}
      </style></head><body>
      <section class="hero" data-campaign-edit="hero"><div class="wrap"><h1>${esc(campaign.headline||campaign.name)}</h1><p>${esc(campaign.support||'')}</p></div></section>
      <section class="image" data-campaign-edit="image" style="${signedImage?`background-image:url('${signedImage}')`:''}"></section>
      <section class="points" data-campaign-edit="points"><div class="wrap"><div class="pointgrid">${pts.map(p=>`<div class="point">${esc(p)}</div>`).join('')}</div></div></section>
      <section class="signup" data-campaign-edit="signup"><div class="wrap"><div class="box"><h2>${survey?esc(survey.name):'Back this campaign'}</h2><input placeholder="First name"><input placeholder="Last name"><input placeholder="Email"><input placeholder="Postcode">${vi?'<select><option>Voting intention (optional)</option></select>':''}<button class="btn">Back the campaign</button><div class="thankyou">${esc(thankYou)}</div></div></div></section>
      <footer data-campaign-edit="imprint"><div class="wrap">${esc(imprint)}</div></footer>
      </body></html>`;
    }

    async function render(){
      await resolveImage();
      const doc=frame.contentDocument;doc.open();doc.write(campaignHTML());doc.close();
      setTimeout(buildHotspots,60)
    }

    function buildHotspots(){
      overlay.innerHTML='';
      const doc=frame.contentDocument;
      const labels={hero:'Hero',image:'Image',points:'Three key points',signup:'Signup & survey',imprint:'Imprint'};
      [...doc.querySelectorAll('[data-campaign-edit]')].forEach(node=>{
        const type=node.dataset.campaignEdit,r=node.getBoundingClientRect();
        const h=document.createElement('button');
        h.type='button';h.className='campaign-edit-hotspot';
        h.style.left=r.left+'px';h.style.top=r.top+'px';h.style.width=r.width+'px';h.style.height=r.height+'px';
        h.innerHTML=`<span>Edit ${labels[type]}</span>`;
        h.onclick=()=>openDrawer(type);
        overlay.appendChild(h)
      });
      const height=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight);
      frame.style.height=height+'px';overlay.style.height=height+'px'
    }

    function saving(){
      saveState.classList.add('saving');
      saveState.querySelector('span:last-child').textContent='Saving…'
    }
    function saved(){
      saveState.classList.remove('saving');
      saveState.querySelector('span:last-child').textContent='Saved just now'
    }
    async function persist(changes){
      saving();
      Object.assign(campaign,changes);
      const r=await sb.from('campaigns').update({
        name:campaign.name,
        slug:campaign.slug||null,
        status:String(campaign.status||'Draft').toLowerCase(),
        headline:campaign.headline||campaign.name,
        supporting_copy:campaign.support||'',
        image_path:campaign.imagePath||null,
        key_points:campaign.points||[],
        survey_id:campaign.surveyId||null,
        settings:campaign.settings||{}
      }).eq('id',campaign.id).select().single();
      if(r.error){showBackendError('Could not save campaign microsite: '+r.error.message);saved();return}
      const db=CP.db();db.campaigns[campaign.id]=campaign;CP.save(db);saved();await render()
    }

    function field(label,id,value,type='input'){
      if(type==='textarea')return `<label class="field"><span>${label}</span><textarea id="${id}">${esc(value||'')}</textarea></label>`;
      return `<label class="field"><span>${label}</span><input id="${id}" value="${esc(value||'')}"></label>`
    }

    function openDrawer(type){
      workspace.classList.add('drawer-open');
      drawerTitle.textContent='Edit '+({hero:'hero',image:'image',points:'three key points',signup:'signup & survey',imprint:'imprint'}[type]);
      let html='';
      if(type==='hero'){
        html=field('Headline','cmHeadline',campaign.headline||campaign.name,'textarea')+field('Supporting copy','cmSupport',campaign.support||'','textarea');
      } else if(type==='image'){
        html=`<label class="field"><span>Campaign image</span><input id="cmImage" type="file" accept="image/*"></label><p class="muted">One image only. It is stored in the private Supabase campaign-assets bucket.</p>${campaign.imagePath?'<button class="btn secondary small" id="cmRemoveImage">Remove image</button>':''}`;
      } else if(type==='points'){
        html=[0,1,2].map(i=>field(`Key point ${i+1}`,'cmPoint'+i,(campaign.points||[])[i]||'','textarea')).join('');
      } else if(type==='signup'){
        const options=Object.values(surveys).map(s=>`<option value="${s.id}" ${campaign.surveyId===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
        html=`<label class="field"><span>Survey</span><select id="cmSurvey"><option value="">No linked survey</option>${options}</select></label>
        <label class="toggle-row"><input id="cmVI" type="checkbox" ${campaign.settings?.collect_voting_intention?'checked':''}> <span>Ask voting intention (optional)</span></label>
        ${field('Thank-you message','cmThanks',campaign.settings?.thank_you_message||'Thank you for backing the campaign.','textarea')}`;
      } else if(type==='imprint'){
        html=field('Imprint','cmImprint',campaign.settings?.imprint||`Promoted by ${website?.name||'the campaign'} for ${website?.area||'the local area'}.`,'textarea');
      }
      drawerBody.innerHTML=html;

      const headline=document.getElementById('cmHeadline');
      const support=document.getElementById('cmSupport');
      if(headline)headline.onchange=()=>persist({headline:headline.value,support:support.value});
      if(support)support.onchange=()=>persist({headline:headline.value,support:support.value});

      [0,1,2].forEach(i=>{
        const el=document.getElementById('cmPoint'+i);if(!el)return;
        el.onchange=()=>{const pts=[...(campaign.points||[])];pts[i]=el.value;persist({points:pts})}
      });

      const survey=document.getElementById('cmSurvey');
      if(survey)survey.onchange=()=>persist({surveyId:survey.value||null});

      const vi=document.getElementById('cmVI');
      if(vi)vi.onchange=()=>persist({settings:{...(campaign.settings||{}),collect_voting_intention:vi.checked}});

      const thanks=document.getElementById('cmThanks');
      if(thanks)thanks.onchange=()=>persist({settings:{...(campaign.settings||{}),thank_you_message:thanks.value}});

      const imprint=document.getElementById('cmImprint');
      if(imprint)imprint.onchange=()=>persist({settings:{...(campaign.settings||{}),imprint:imprint.value}});

      const image=document.getElementById('cmImage');
      if(image)image.onchange=async()=>{
        const file=image.files?.[0];if(!file)return;
        try{
          saving();
          const path=await window.CPStage2.uploadAsset(file,`campaigns/${campaign.id}`);
          await persist({imagePath:path})
        }catch(e){showBackendError('Could not upload campaign image: '+e.message);saved()}
      };
      const remove=document.getElementById('cmRemoveImage');
      if(remove)remove.onclick=()=>persist({imagePath:null});
    }

    document.getElementById('campaignMicrositeDrawerClose').onclick=()=>workspace.classList.remove('drawer-open');
    document.getElementById('campaignMicrositePublish').onclick=async()=>{saving();const r=await sb.rpc('publish_local_entity',{p_entity_type:'campaign',p_entity_id:campaign.id});if(r.error){showBackendError('Could not publish: '+r.error.message);saved();return}campaign.status='Published';campaign.has_unpublished_changes=false;saved();document.getElementById('campaignMicrositeMeta').textContent=`Live · version ${r.data?.version||''} · ${campaign.slug||''}`};
    document.getElementById('campaignMicrositePreview').onclick=()=>{
      const win=window.open('','_blank');if(!win)return;
      win.document.open();win.document.write(campaignHTML());win.document.close()
    };
    render()
  }

  function renderStage2People(){
    if(pathname!=='people.html')return;
    const table=document.querySelector('.table-card table'),filterHost=document.getElementById('stage2PeopleFilters');
    if(!table||!filterHost)return;
    const d=CP.db(),all=Object.values(d.people||{});
    let state={search:'',tag:'',source:'',voting:'',consent:'',action:''},selected=new Set(),filtered=[...all];

    const actionsByPerson={};
    (d.actions||[]).forEach(a=>(actionsByPerson[a.personId] ||= []).push(a));
    const tagNames=[...new Set(all.flatMap(p=>(p.tags||[]).map(t=>t.name)))].sort();
    const sources=[...new Set(all.map(p=>p.source).filter(Boolean))].sort();
    const votings=[...new Set(all.map(p=>p.votingIntention).filter(Boolean))].sort();
    const actionTypes=[...new Set((d.actions||[]).map(a=>a.type).filter(Boolean))].sort();

    filterHost.innerHTML=`<div class="filter-toolbar">
      <input id="realPeopleSearch" placeholder="Search name, email or postcode">
      <select id="realPeopleTag"><option value="">All tags</option>${tagNames.map(x=>`<option>${x}</option>`).join('')}</select>
      <select id="realPeopleSource"><option value="">All sources</option>${sources.map(x=>`<option>${x}</option>`).join('')}</select>
      <select id="realPeopleVoting"><option value="">All voting intentions</option>${votings.map(x=>`<option>${x}</option>`).join('')}</select>
      <select id="realPeopleAction"><option value="">All actions</option>${actionTypes.map(x=>`<option>${x}</option>`).join('')}</select>
      <select id="realPeopleConsent"><option value="">All email consent</option><option value="yes">Opted in</option><option value="no">Not opted in</option></select>
      <button class="btn secondary small" id="realPeopleClear">Clear</button>
    </div>
    <div class="bulk-bar" id="realPeopleBulk"><span><strong id="realPeopleSelected">0</strong> selected</span><button class="btn secondary small" id="realPeopleBulkTag">Add tag</button></div>`;

    table.querySelector('thead').innerHTML='<tr><th><input id="realSelectAll" type="checkbox"></th><th>Supporter</th><th>Postcode</th><th>Tags</th><th>Voting intention</th><th>Recent actions</th><th>Source</th><th>Email</th></tr>';

    const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    function filter(){
      filtered=all.filter(p=>{
        const hay=[p.name,p.email,p.postcode].join(' ').toLowerCase();
        const tags=(p.tags||[]).map(t=>t.name);
        const acts=actionsByPerson[p.id]||[];
        return (!state.search||hay.includes(state.search.toLowerCase()))
          &&(!state.tag||tags.includes(state.tag))
          &&(!state.source||p.source===state.source)
          &&(!state.voting||p.votingIntention===state.voting)
          &&(!state.action||acts.some(a=>a.type===state.action))
          &&(!state.consent||(state.consent==='yes'?p.consentEmail===true:p.consentEmail!==true));
      });renderRows()
    }
    function renderRows(){
      document.getElementById('peopleRealCount').textContent=`${filtered.length} supporter${filtered.length===1?'':'s'} in this view · ${all.length} total`;
      const tb=table.querySelector('tbody');
      tb.innerHTML=filtered.length?filtered.map(p=>{
        const acts=(actionsByPerson[p.id]||[]).slice(0,2);
        return `<tr><td><input class="real-person-select" data-id="${p.id}" type="checkbox" ${selected.has(p.id)?'checked':''}></td>
          <td><a href="person.html?id=${p.id}"><span class="person-name">${esc2(p.name)}</span><span class="person-email">${esc2(p.email||'No email')}</span></a></td>
          <td>${esc2(p.postcode||'—')}</td>
          <td><div class="person-tag-stack">${(p.tags||[]).map(t=>`<span class="person-tag">${esc2(t.name)} <button data-remove-tag="${t.id}" data-person="${p.id}">×</button></span>`).join('')||'<span class="muted">No tags</span>'}</div><button class="text-button add-person-tag" data-person="${p.id}">+ tag</button></td>
          <td>${esc2(p.votingIntention||'Not asked')}</td>
          <td>${acts.map(a=>`<span class="action-mini">${esc2(a.type)}</span>`).join(' ')||'—'}</td>
          <td>${esc2(p.source||'—')}</td><td>${p.consentEmail===true?'Opted in':'No / unknown'}</td></tr>`
      }).join(''):'<tr><td colspan="8"><div class="no-results">No supporters match these filters.</div></td></tr>';
      bindRows()
    }
    function bindRows(){
      table.querySelectorAll('.real-person-select').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.id):selected.delete(x.dataset.id);document.getElementById('realPeopleSelected').textContent=selected.size});
      table.querySelectorAll('.add-person-tag').forEach(b=>b.onclick=async()=>{const tag=await CPDialog.ask({title:'Add tag',label:'Tag name',placeholder:'e.g. Volunteer'});if(!tag)return;try{await window.CPStage2.addPersonTag(b.dataset.person,tag);sessionStorage.removeItem(bootKey);location.reload()}catch(e){showBackendError('Could not add tag: '+e.message)}});
      table.querySelectorAll('[data-remove-tag]').forEach(b=>b.onclick=async()=>{try{await window.CPStage2.removePersonTag(b.dataset.person,b.dataset.removeTag);sessionStorage.removeItem(bootKey);location.reload()}catch(e){showBackendError('Could not remove tag: '+e.message)}});
    }
    document.getElementById('realSelectAll').onchange=e=>{selected=new Set(e.target.checked?filtered.map(p=>p.id):[]);renderRows();document.getElementById('realPeopleSelected').textContent=selected.size};
    document.getElementById('realPeopleBulkTag').onclick=async()=>{if(!selected.size)return;const tag=await CPDialog.ask({title:`Tag ${selected.size} supporters`,label:'Tag name',placeholder:'e.g. Follow up'});if(!tag)return;for(const id of selected)await window.CPStage2.addPersonTag(id,tag);sessionStorage.removeItem(bootKey);location.reload()};
    [['realPeopleSearch','search','input'],['realPeopleTag','tag','change'],['realPeopleSource','source','change'],['realPeopleVoting','voting','change'],['realPeopleAction','action','change'],['realPeopleConsent','consent','change']].forEach(([id,k,evt])=>document.getElementById(id).addEventListener(evt,e=>{state[k]=e.target.value;filter()}));
    document.getElementById('realPeopleClear').onclick=()=>{state={search:'',tag:'',source:'',voting:'',consent:'',action:''};filterHost.querySelectorAll('input,select').forEach(x=>x.value='');filter()};
    document.getElementById('peopleExportReal').onclick=()=>{const rows=[['Name','Email','Postcode','Tags','Voting intention','Source','Email consent'],...filtered.map(p=>[p.name,p.email,p.postcode,(p.tags||[]).map(t=>t.name).join('|'),p.votingIntention,p.source,p.consentEmail===true?'Yes':'No'])];const csv=rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='supporters.csv';a.click()};
    const qp=new URLSearchParams(location.search);if(qp.get('source'))state.source=qp.get('source');if(qp.get('voting'))state.voting=qp.get('voting');if(qp.get('tag'))state.tag=qp.get('tag');filter();
  }


  function applyClientFacingPolish(){
    const d=CP.db(),account=d.account||{};
    const displayName=account.name||[account.firstName,account.lastName].filter(Boolean).join(' ')||'Signed in user';
    const initials=displayName.split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'CP';

    document.querySelectorAll('.user-chip').forEach(chip=>{
      const avatar=chip.querySelector('.avatar');
      const strong=chip.querySelector('strong');
      const small=chip.querySelector('small');
      if(avatar)avatar.textContent=initials;
      if(strong)strong.textContent=displayName;
      if(small)small.textContent='Signed in';
    });

    // Selected website remains candidate/site identity, not account-owner identity.
    document.querySelectorAll('.sidebar-site small,.workspace-select small').forEach(el=>{
      el.textContent=(el.textContent||'')
        .replace(/\s*·\s*(Campaign website|campaign_site)\s*/gi,'')
        .replace(/\s{2,}/g,' ')
        .trim();
    });

    document.querySelectorAll('.site-card .muted').forEach(el=>{
      el.textContent=(el.textContent||'')
        .replace(/\s*·\s*(Campaign website|campaign_site)\s*/gi,'')
        .trim();
    });

    document.querySelectorAll('.editor-scope-note').forEach(note=>{
      const last=note.querySelector('.autosave-standard span:last-child');
      if(last&&/Supabase/i.test(last.textContent))last.textContent='Saved';
    });

    document.querySelectorAll('[data-obsolete]').forEach(el=>el.remove());
  }

  // -------------------------------------------------------
  // Boot
  // -------------------------------------------------------
  bindAuth();
  if(PROTECTED){
    bootOverlay();
    hydrate().then(session=>{
      if(!session)return;
      installCPBridge();
      bindTransactionalCreates();
      renderStage2People();
      renderStage2CampaignMicrositeEditor();
      applyClientFacingPolish();
      renderStage2Person();
      enhanceStage2SurveyOverview();
      enhanceStage2SurveyEditorResults();
      if(!sessionStorage.getItem(bootKey)){
        sessionStorage.setItem(bootKey,'1');
        location.reload(); return;
      }
      removeBoot();
    }).catch(err=>showBackendError('Could not load your Supabase campaign data: '+err.message));
  } else {
    sb.auth.getSession().then(({data:{session}})=>{
      if(pathname==='login.html'&&session){
        const next=new URLSearchParams(location.search).get('next')||'dashboard.html';
        location.replace(next)
      }
    })
  }
})();
