(async function(){
  'use strict';
  const sb=window.cpSupabase;
  const params=new URLSearchParams(location.search),ref=params.get('site')||params.get('id');
  const frame=document.getElementById('weFrame'),hotspots=document.getElementById('weHotspots'),panelEmpty=document.getElementById('wePanelEmpty'),panelContent=document.getElementById('wePanelContent'),saveState=document.getElementById('weSaveState'),errorBox=document.getElementById('weError'),device=document.getElementById('weDevice');
  let website=null,allWebsites=[],surveys=[],surveyQuestions=[],imageUrls={},saveTimer=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fail=m=>{errorBox.hidden=false;errorBox.textContent=m};
  const saving=()=>saveState.querySelector('span:last-child').textContent='Saving…';
  const saved=()=>saveState.querySelector('span:last-child').textContent='Saved just now';
  async function signed(path){if(!path)return null;const r=await sb.storage.from('campaign-assets').createSignedUrl(path,3600);return r.error?null:r.data.signedUrl}
  async function account(){const r=await sb.from('accounts').select('id,name,first_name,last_name').limit(1).single();if(r.error)throw r.error;return r.data}
  async function upload(file,slot){const a=await account(),ext=(file.name.split('.').pop()||'jpg').toLowerCase(),safe=(file.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||slot),path=`${a.id}/websites/${website.id}/${slot}/${Date.now()}-${safe}.${ext}`;const r=await sb.storage.from('campaign-assets').upload(path,file,{contentType:file.type||undefined});if(r.error)throw r.error;return path}
  function baseContent(){
    return {
      candidateName:website.name||'Candidate',
      candidateInitials:(website.name||'Candidate').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),
      candidateArea:website.area||'',
      candidateTitle:`Candidate for ${website.area||'your area'}`,
      candidateEmail:'',
      heroHeadline:`A stronger voice for ${website.area||'your area'}.`,
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
      surveyIntro:'Tell us what matters most locally.',
      volunteerHeadline:'Get involved',
      volunteer1:'Deliver a few leaflets',
      volunteer2:'Display a poster',
      volunteer3:'Join us on the doorstep',
      volunteer4:'Help online',
      footerDescription:'Local campaign website.'
    }
  }
  function normalise(){
    const c=website.content||{};
    if(c.candidateName)return {...baseContent(),...c};
    const nested={...baseContent()};
    nested.heroHeadline=c.hero?.headline||nested.heroHeadline;
    nested.heroCopy=c.hero?.supporting_copy||nested.heroCopy;
    nested.aboutHeadline=c.about?.heading||nested.aboutHeadline;
    nested.aboutLead=c.about?.body||nested.aboutLead;
    if(Array.isArray(c.priorities)&&c.priorities.length)nested.priorities=c.priorities.map((p,i)=>typeof p==='string'?{title:p,copy:''}:p);
    nested.footerDescription=c.footerDescription||nested.footerDescription;
    return nested
  }
  async function load(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session){location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()+location.search));return false}
    const listR=await sb.from('websites').select('*').order('created_at');
    if(listR.error){fail('Could not load websites: '+listR.error.message);return false}
    allWebsites=listR.data||[];
    if(!allWebsites.length){fail('No websites found.');return false}

    if(ref){
      website=allWebsites.find(w=>w.id===ref||w.slug===ref)||null;
    }else{
      website=allWebsites[0]||null;
    }
    if(!website){fail('Website not found.');return false}
    website.content=normalise();
    const [sr,qr,acc]=await Promise.all([sb.from('surveys').select('*').order('created_at'),sb.from('survey_questions').select('*').order('position'),account()]);
    surveys=sr.data||[];surveyQuestions=qr.data||[];
    const surveyToolbar=document.getElementById('weSurveyToolbar');
    if(surveyToolbar){
      surveyToolbar.innerHTML='<option value="">No survey</option>'+surveys.map(s=>`<option value="${s.id}" ${s.id===website.selected_survey_id?'selected':''}>${esc(s.name)}</option>`).join('');
      surveyToolbar.onchange=()=>save({selected_survey_id:surveyToolbar.value||null});
    }
    imageUrls.hero=await signed(website.hero_image_path);imageUrls.about=await signed(website.about_image_path);
    weTopTitle.textContent=website.name;
    const back=document.getElementById('weBackLink'); if(back) back.href='website-overview.html?id='+website.id;
    const websiteSelect=document.getElementById('weWebsiteSelect');
    if(websiteSelect){
      websiteSelect.innerHTML=allWebsites.map(w=>`<option value="${w.id}" ${w.id===website.id?'selected':''}>${esc(w.name)}${w.area?' — '+esc(w.area):''}</option>`).join('');
      websiteSelect.onchange=()=>{
        const nextId=websiteSelect.value;
        if(!nextId||nextId===website.id)return;
        websiteSelect.disabled=true;
        location.href='editor.html?site='+encodeURIComponent(nextId);
      };
    }
    const ws=document.getElementById('websiteSidebarIdentity');ws.querySelector('strong').textContent=website.name;ws.querySelector('small').textContent=website.area||'Website';
    const user=document.getElementById('websiteEditorUser'),display=acc.name||[acc.first_name,acc.last_name].filter(Boolean).join(' ')||'Signed in';user.querySelector('.avatar').textContent=display.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();user.querySelector('strong').textContent=display;user.querySelector('small').textContent='Signed in';
    weSummary.innerHTML=`<dl class="profile-data"><dt>Status</dt><dd>${esc(website.status)}</dd><dt>Area</dt><dd>${esc(website.area||'—')}</dd><dt>Survey</dt><dd>${esc(surveys.find(s=>s.id===website.selected_survey_id)?.name||'None')}</dd></dl>`;
    return true
  }
  function qHtml(q){
    if(q.question_type==='text')return `<label>${esc(q.label)}<textarea></textarea></label>`;
    if(q.question_type==='yesno')return `<label>${esc(q.label)}<select><option>Select</option><option>Yes</option><option>No</option></select></label>`;
    if(q.question_type==='single')return `<label>${esc(q.label)}<select><option>Select</option>${(q.options||[]).map(o=>`<option>${esc(o)}</option>`).join('')}</select></label>`;
    return ''
  }
  function previewHTML(){
    const c=website.content||{},b=website.branding||{},navy=b.primary||'#08254a',blue=b.secondary||'#1476d4';
    const qs=surveyQuestions.filter(q=>q.survey_id===website.selected_survey_id&&q.enabled);
    const survey=surveys.find(s=>s.id===website.selected_survey_id);
    const priorities=(c.priorities||[]).slice(0,3);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:"Proxima Nova","Avenir Next",Arial,sans-serif;color:${navy}}.wrap{width:min(1120px,calc(100% - 40px));margin:auto}.header{padding:18px 0;background:#fff}.id{display:flex;gap:10px;align-items:center}.round{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:${blue};color:#fff;font-weight:900}.id small{display:block;color:#718198}.hero{background:linear-gradient(110deg,rgba(5,25,49,.92),rgba(5,25,49,.55))${imageUrls.hero?`,url('${imageUrls.hero}') center/cover`:''};color:#fff;padding:110px 0 70px}.hero h1{font-size:76px;line-height:.9;letter-spacing:-.055em;max-width:880px;margin:0 0 18px}.hero p{font-size:20px;max-width:720px}.btn{display:inline-block;background:${blue};color:#fff;padding:13px 17px;font-weight:900;text-decoration:none}.section{padding:64px 0}.alt{background:#f2f6fa}.section h2{font-size:50px;letter-spacing:-.045em;margin:0 0 12px}.lead{font-size:20px;max-width:760px}.aboutgrid{display:grid;grid-template-columns:1.1fr .9fr;gap:34px;align-items:center}.aboutimage{height:350px;background:#dce5ec ${imageUrls.about?`url('${imageUrls.about}') center/cover`:''}}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.card{background:#fff;border:1px solid #d9e3ec;padding:22px}.survey{max-width:720px}.survey label{display:grid;gap:6px;font-weight:800;margin:14px 0}.survey input,.survey textarea,.survey select{border:1px solid #cad6e1;padding:11px;font:inherit}.survey textarea{min-height:100px}footer{background:#061a34;color:#fff;padding:30px 0}.editable:hover{outline:3px solid ${blue};outline-offset:-3px}@media(max-width:700px){.hero h1{font-size:52px}.grid,.aboutgrid{grid-template-columns:1fr}.section h2{font-size:40px}}</style></head><body><header class="header editable" data-edit="header"><div class="wrap"><div class="id"><span class="round">${esc(c.candidateInitials||'CP')}</span><span><strong>${esc(c.candidateName||website.name)}</strong><small>${esc(c.candidateTitle||website.area||'')}</small></span></div></div></header><section class="hero editable" data-edit="hero"><div class="wrap"><h1>${esc(c.heroHeadline)}</h1><p>${esc(c.heroCopy)}</p><a class="btn" href="#survey">${esc(c.heroCta)}</a></div></section><section class="section editable" data-edit="about"><div class="wrap aboutgrid"><div><h2>${esc(c.aboutHeadline)}</h2><p class="lead">${esc(c.aboutLead)}</p><p>${esc(c.aboutCopy)}</p></div><div class="aboutimage"></div></div></section><section class="section alt editable" data-edit="priorities"><div class="wrap"><h2>Priorities</h2><div class="grid">${priorities.map(p=>`<article class="card"><h3>${esc(p.title)}</h3><p>${esc(p.copy||'')}</p></article>`).join('')}</div></div></section>${survey?`<section class="section editable" id="survey" data-edit="survey"><div class="wrap survey"><h2>${esc(survey.name)}</h2><p class="lead">${esc(c.surveyIntro||'Tell us what matters locally.')}</p><input placeholder="First name"><input placeholder="Last name"><input placeholder="Email address"><input placeholder="Postcode">${qs.map(qHtml).join('')}<button class="btn">Send my views</button></div></section>`:''}<section class="section alt editable" data-edit="volunteer"><div class="wrap"><h2>${esc(c.volunteerHeadline)}</h2><div class="grid"><article class="card">${esc(c.volunteer1)}</article><article class="card">${esc(c.volunteer2)}</article><article class="card">${esc(c.volunteer3)}</article></div></div></section><footer class="editable" data-edit="footer"><div class="wrap">${esc(c.footerDescription)}</div></footer></body></html>`
  }
  function render(){const doc=frame.contentDocument;doc.open();doc.write(previewHTML());doc.close();setTimeout(()=>{const h=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight);frame.style.height=h+'px';hotspots.style.height=h+'px';hotspots.innerHTML='';[...doc.querySelectorAll('[data-edit]')].forEach(n=>{const r=n.getBoundingClientRect(),t=n.dataset.edit,b=document.createElement('button');b.className='website-editor-hotspot';b.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;b.innerHTML=`<span>Edit ${t}</span>`;b.onclick=()=>openPanel(t);hotspots.appendChild(b)})},60)}
  async function save(patch={}){Object.assign(website,patch);saving();clearTimeout(saveTimer);await new Promise(r=>saveTimer=setTimeout(r,180));const r=await sb.from('websites').update({name:website.name,area:website.area,domain:website.domain,slug:website.slug,status:website.status,branding:website.branding,content:website.content,selected_survey_id:website.selected_survey_id,hero_image_path:website.hero_image_path,about_image_path:website.about_image_path,has_unpublished_changes:true}).eq('id',website.id);if(r.error){fail('Could not save: '+r.error.message);return}imageUrls.hero=await signed(website.hero_image_path);imageUrls.about=await signed(website.about_image_path);saved();render()}
  const field=(label,id,val,area=false)=>`<label class="field"><span>${label}</span>${area?`<textarea id="${id}">${esc(val||'')}</textarea>`:`<input id="${id}" value="${esc(val||'')}">`}</label>`;
  function openPanel(type){
    panelEmpty.hidden=true;panelContent.hidden=false;const c=website.content,b=website.branding||{};
    if(type==='header'){panelContent.innerHTML=`<div class="campaign-panel-head"><h3>Header</h3></div>${field('Candidate name','weName',c.candidateName)}${field('Candidate title','weTitle',c.candidateTitle)}${field('Initials','weInitials',c.candidateInitials)}`;const go=()=>save({content:{...website.content,candidateName:weName.value,candidateTitle:weTitle.value,candidateInitials:weInitials.value}});[weName,weTitle,weInitials].forEach(x=>x.oninput=go)}
    if(type==='hero'){panelContent.innerHTML=`<div class="campaign-panel-head"><h3>Hero</h3></div>${field('Headline','weHero',c.heroHeadline,true)}${field('Supporting copy','weHeroCopy',c.heroCopy,true)}${field('Button text','weHeroCta',c.heroCta)}<label class="field"><span>Hero image</span><input id="weHeroImage" type="file" accept="image/*"></label>`;const go=()=>save({content:{...website.content,heroHeadline:weHero.value,heroCopy:weHeroCopy.value,heroCta:weHeroCta.value}});[weHero,weHeroCopy,weHeroCta].forEach(x=>x.oninput=go);weHeroImage.onchange=async()=>{const f=weHeroImage.files?.[0];if(!f)return;try{saving();await save({hero_image_path:await upload(f,'hero')})}catch(e){fail('Could not upload image: '+e.message)}}}
    if(type==='about'){panelContent.innerHTML=`<div class="campaign-panel-head"><h3>About</h3></div>${field('Headline','weAbout',c.aboutHeadline)}${field('Lead','weAboutLead',c.aboutLead,true)}${field('Body','weAboutCopy',c.aboutCopy,true)}<label class="field"><span>About image</span><input id="weAboutImage" type="file" accept="image/*"></label>`;const go=()=>save({content:{...website.content,aboutHeadline:weAbout.value,aboutLead:weAboutLead.value,aboutCopy:weAboutCopy.value}});[weAbout,weAboutLead,weAboutCopy].forEach(x=>x.oninput=go);weAboutImage.onchange=async()=>{const f=weAboutImage.files?.[0];if(!f)return;try{saving();await save({about_image_path:await upload(f,'about')})}catch(e){fail('Could not upload image: '+e.message)}}}
    if(type==='priorities'){const pts=[...(c.priorities||[])];while(pts.length<3)pts.push({title:'New priority',copy:''});panelContent.innerHTML=`<div class="campaign-panel-head"><h3>Priorities</h3></div>${[0,1,2].map(i=>field(`Priority ${i+1}`,'wePt'+i,pts[i].title)+field('Copy','wePc'+i,pts[i].copy,true)).join('')}`;const go=()=>{const next=[0,1,2].map(i=>({title:document.getElementById('wePt'+i).value,copy:document.getElementById('wePc'+i).value}));save({content:{...website.content,priorities:next}})};[0,1,2].forEach(i=>{document.getElementById('wePt'+i).oninput=go;document.getElementById('wePc'+i).oninput=go})}
    if(type==='survey'){panelContent.innerHTML=`<div class="campaign-panel-head"><h3>Survey</h3></div><label class="field"><span>Survey on this website</span><select id="weSurvey"><option value="">No survey</option>${surveys.map(s=>`<option value="${s.id}" ${s.id===website.selected_survey_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>${field('Intro text','weSurveyIntro',c.surveyIntro,true)}`;weSurvey.onchange=()=>save({selected_survey_id:weSurvey.value||null});weSurveyIntro.oninput=()=>save({content:{...website.content,surveyIntro:weSurveyIntro.value}})}
    if(type==='volunteer'){panelContent.innerHTML=`<div class="campaign-panel-head"><h3>Get involved</h3></div>${field('Headline','weVolH',c.volunteerHeadline)}${field('Option 1','weVol1',c.volunteer1)}${field('Option 2','weVol2',c.volunteer2)}${field('Option 3','weVol3',c.volunteer3)}${field('Option 4','weVol4',c.volunteer4)}`;const go=()=>save({content:{...website.content,volunteerHeadline:weVolH.value,volunteer1:weVol1.value,volunteer2:weVol2.value,volunteer3:weVol3.value,volunteer4:weVol4.value}});[weVolH,weVol1,weVol2,weVol3,weVol4].forEach(x=>x.oninput=go)}
    if(type==='footer'){panelContent.innerHTML=`<div class="campaign-panel-head"><h3>Footer</h3></div>${field('Description','weFooter',c.footerDescription,true)}<div class="campaign-panel-head" style="margin-top:20px"><h3>Brand colours</h3></div><label class="field"><span>Navy</span><input type="color" id="weNavy" value="${b.primary||'#08254a'}"></label><label class="field"><span>Blue</span><input type="color" id="weBlue" value="${b.secondary||'#1476d4'}"></label>`;weFooter.oninput=()=>save({content:{...website.content,footerDescription:weFooter.value}});const brand=()=>save({branding:{...(website.branding||{}),primary:weNavy.value,secondary:weBlue.value}});weNavy.oninput=brand;weBlue.oninput=brand}
  }
  document.querySelectorAll('[data-we-width]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-we-width]').forEach(x=>x.classList.remove('active'));b.classList.add('active');device.className='website-device '+b.dataset.weWidth});
  wePreviewButton.onclick=()=>{const w=window.open('','_blank');if(!w)return;w.document.open();w.document.write(previewHTML());w.document.close()};
  wePublishButton.onclick=async()=>{saving();const r=await sb.rpc('publish_local_entity',{p_entity_type:'website',p_entity_id:website.id});if(r.error){fail('Could not publish: '+r.error.message);saved();return}website.status='published';website.has_unpublished_changes=false;saved();wePublishButton.textContent='Published · v'+(r.data?.version||'');};
  websiteEditorLogout.onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href='login.html'};
  if(await load())render()
})();