
document.addEventListener('cp-admin-ready',async()=>{
  'use strict';
  const {sb}=window.CP_ADMIN;
  const id=new URLSearchParams(location.search).get('id');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const msg=(text,error=false)=>hqWebsiteMessage.innerHTML=text?`<div class="state-banner ${error?'error':'success'}">${esc(text)}</div>`:'';
  let website=null,account=null,candidate=null,saveTimer=null;

  if(!id){msg('Website not specified.',true);return}

  const defaults=w=>({
    candidateName:w.name||'Candidate',
    candidateInitials:(w.name||'Candidate').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),
    candidateArea:w.area||'',
    candidateTitle:`Candidate for ${w.area||'your area'}`,
    heroHeadline:`A stronger voice for ${w.area||'your area'}.`,
    heroCopy:'Listening to residents and campaigning on the issues that matter locally.',
    heroCta:'Tell us what matters',
    aboutHeadline:'Why I’m standing',
    aboutLead:'Local residents deserve visible, practical representation.',
    aboutCopy:'',
    priorities:[
      {title:'Roads and pavements',copy:'Push for proper repairs and safer streets.'},
      {title:'Cleaner and safer streets',copy:'Back practical action in the neighbourhood.'},
      {title:'Protecting local services',copy:'Stand up for the local services residents rely on.'}
    ],
    footerDescription:'Local campaign website.'
  });
  function normalise(){
    const c=website.content||{},d=defaults(website);
    if(c.candidateName)return {...d,...c,priorities:Array.isArray(c.priorities)&&c.priorities.length?c.priorities:d.priorities};
    return {...d,
      heroHeadline:c.hero?.headline||d.heroHeadline,
      heroCopy:c.hero?.supporting_copy||d.heroCopy,
      aboutHeadline:c.about?.heading||d.aboutHeadline,
      aboutLead:c.about?.body||d.aboutLead,
      priorities:Array.isArray(c.priorities)&&c.priorities.length?c.priorities.map(p=>typeof p==='string'?{title:p,copy:''}:p):d.priorities
    };
  }
  async function load(){
    const r=await sb.rpc('org_admin_website_detail',{p_website:id});
    if(r.error){msg(r.error.message,true);return false}
    website=r.data.website; account=r.data.account; candidate=r.data.candidate;
    website.content=normalise();
    fill();
    render();
    return true
  }
  function fill(){
    const c=website.content||{},b=website.branding||{};
    hqWebsiteTitle.textContent=website.name;
    hqWebsiteMeta.textContent=[website.area,account?.local_authority].filter(Boolean).join(' · ')||'Candidate website';
    hqPreviewLabel.textContent=[website.name,website.area].filter(Boolean).join(' · ');
    hqBackAccount.href='admin-account.html?id='+encodeURIComponent(website.account_id);
    const live=website.publishing_state==='live';
    hqWebsiteStatus.className='status-chip '+(live?'published':'draft');
    hqWebsiteStatus.textContent=live?'Live':'Draft';
    hqCandidateName.value=website.name||'';
    hqArea.value=website.area||'';
    hqSlug.value=website.slug||'';
    hqHeroHeadline.value=c.heroHeadline||'';
    hqHeroCopy.value=c.heroCopy||'';
    hqHeroCta.value=c.heroCta||'';
    hqAboutHeadline.value=c.aboutHeadline||'';
    hqAboutLead.value=c.aboutLead||'';
    hqAboutCopy.value=c.aboutCopy||'';
    hqPrimary.value=b.primary||'#08254a';
    hqSecondary.value=b.secondary||'#1476d4';
    hqPriorities.innerHTML=[0,1,2].map(i=>`<div class="hq-priority-edit"><label class="field"><span>Priority ${i+1}</span><input data-priority-title="${i}" value="${esc(c.priorities?.[i]?.title||'')}"></label><label class="field"><span>Supporting copy</span><textarea data-priority-copy="${i}">${esc(c.priorities?.[i]?.copy||'')}</textarea></label></div>`).join('');
  }
  function collect(){
    const existing=website.content||{},priorities=[0,1,2].map(i=>({
      title:document.querySelector(`[data-priority-title="${i}"]`)?.value||'',
      copy:document.querySelector(`[data-priority-copy="${i}"]`)?.value||''
    }));
    return {
      name:hqCandidateName.value.trim()||website.name,
      area:hqArea.value.trim(),
      slug:hqSlug.value.trim(),
      branding:{...(website.branding||{}),primary:hqPrimary.value,secondary:hqSecondary.value},
      content:{...existing,
        candidateName:hqCandidateName.value.trim()||website.name,
        candidateInitials:(hqCandidateName.value.trim()||website.name).split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),
        candidateArea:hqArea.value.trim(),
        candidateTitle:`Candidate for ${hqArea.value.trim()||'your area'}`,
        heroHeadline:hqHeroHeadline.value,
        heroCopy:hqHeroCopy.value,
        heroCta:hqHeroCta.value,
        aboutHeadline:hqAboutHeadline.value,
        aboutLead:hqAboutLead.value,
        aboutCopy:hqAboutCopy.value,
        priorities
      }
    };
  }
  function previewHTML(){
    const patch=collect(),c=patch.content,b=patch.branding,navy=b.primary||'#08254a',blue=b.secondary||'#1476d4';
    const priorities=(c.priorities||[]).filter(x=>x.title);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;font-family:"Proxima Nova","Avenir Next",Arial,sans-serif;color:${navy};background:white}.wrap{width:min(1080px,calc(100% - 40px));margin:auto}.header{padding:18px 0;border-bottom:1px solid #e3e9ef}.id{display:flex;gap:12px;align-items:center}.round{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:${blue};color:white;font-weight:900}.id strong{font-size:18px}.id small{display:block;color:#718198}.hero{background:linear-gradient(115deg,${navy},#24496f);color:white;padding:86px 0 70px}.hero h1{font-size:64px;line-height:.94;letter-spacing:-.05em;max-width:820px;margin:0 0 18px}.hero p{font-size:20px;max-width:690px;line-height:1.45}.btn{display:inline-block;background:${blue};color:white;padding:13px 18px;font-weight:900;text-decoration:none}.section{padding:60px 0}.alt{background:#f3f6f9}.section h2{font-size:44px;letter-spacing:-.04em;margin:0 0 14px}.lead{font-size:19px;max-width:760px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{border:1px solid #d7e0e8;padding:22px;background:#fff}.card h3{margin-top:0}footer{background:${navy};color:#fff;padding:28px 0}@media(max-width:700px){.hero h1{font-size:44px}.grid{grid-template-columns:1fr}.section h2{font-size:36px}}
    </style></head><body>
    <header class="header"><div class="wrap"><div class="id"><span class="round">${esc(c.candidateInitials)}</span><span><strong>${esc(c.candidateName)}</strong><small>${esc(c.candidateTitle)}</small></span></div></div></header>
    <section class="hero"><div class="wrap"><h1>${esc(c.heroHeadline)}</h1><p>${esc(c.heroCopy)}</p><a class="btn">${esc(c.heroCta)}</a></div></section>
    <section class="section"><div class="wrap"><h2>${esc(c.aboutHeadline)}</h2><p class="lead">${esc(c.aboutLead)}</p><p>${esc(c.aboutCopy)}</p></div></section>
    <section class="section alt"><div class="wrap"><h2>Priorities</h2><div class="grid">${priorities.map(p=>`<article class="card"><h3>${esc(p.title)}</h3><p>${esc(p.copy)}</p></article>`).join('')}</div></div></section>
    <footer><div class="wrap">${esc(c.footerDescription||'Local campaign website.')}</div></footer>
    </body></html>`;
  }
  function render(){
    const doc=hqPreviewFrame.contentDocument;doc.open();doc.write(previewHTML());doc.close();
  }
  async function save(){
    clearTimeout(saveTimer);
    hqSaveState.textContent='Saving…';
    const patch=collect();
    const r=await sb.rpc('org_admin_update_website',{p_website:id,p_patch:patch});
    if(r.error){hqSaveState.textContent='Save failed';msg(r.error.message,true);return}
    website={...website,...r.data};website.content=normalise();
    hqWebsiteTitle.textContent=website.name;
    hqWebsiteMeta.textContent=[website.area,account?.local_authority].filter(Boolean).join(' · ');
    hqSaveState.textContent='Saved just now';
    msg('');
    render();
  }
  function queue(){
    render();
    clearTimeout(saveTimer);
    saveTimer=setTimeout(save,700);
  }
  ['hqCandidateName','hqArea','hqSlug','hqHeroHeadline','hqHeroCopy','hqHeroCta','hqAboutHeadline','hqAboutLead','hqAboutCopy','hqPrimary','hqSecondary'].forEach(id=>document.getElementById(id).addEventListener('input',queue));
  hqPriorities.addEventListener('input',queue);
  hqSaveNow.onclick=save;
  document.querySelectorAll('[data-hq-device]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-hq-device]').forEach(x=>x.classList.toggle('active',x===b));
    hqPreviewStage.className='hq-preview-stage '+b.dataset.hqDevice;
  });
  await load();
});
