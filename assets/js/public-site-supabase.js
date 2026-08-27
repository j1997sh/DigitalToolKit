
(async()=>{
  const sb=window.cpSupabase;
  const root=document.getElementById('publicSiteRoot');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function fail(msg){root.innerHTML=`<div class="public-state"><h1>Site unavailable</h1><p>${esc(msg)}</p></div>`}
  async function resolvePostcode(postcode){
    const pc=String(postcode||'').trim();if(!pc)return {};
    try{const r=await fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(pc));if(!r.ok)return {};const j=await r.json(),x=j.result||{},codes=x.codes||{};return {ward:x.admin_ward||'',ward_code:codes.admin_ward||'',local_authority:x.admin_district||'',local_authority_code:codes.admin_district||'',parliamentary_constituency:x.parliamentary_constituency||'',parliamentary_constituency_code:codes.parliamentary_constituency||'',region:x.region||'',nation:x.country||'',latitude:x.latitude,longitude:x.longitude}}catch(_){return {}}
  }

  const pathParts=location.pathname.split('/').filter(Boolean);
  const sitePathIndex=pathParts.lastIndexOf('site');
  const pathSlug=sitePathIndex>=0?pathParts[sitePathIndex+1]:'';
  const wanted=new URLSearchParams(location.search).get('site')||pathSlug||localStorage.getItem('cpCurrentSiteShared')||localStorage.getItem('cpCurrentSite');
  const route=await window.CPPublicRouter.resolve('website',wanted);
  if(!route||route.status!==200){fail(route?.reason==='unpublished'?'This campaign website is not currently published.':'This campaign website could not be found.');return}
  const deployment=route.deployment;
  const snapshot=deployment?.snapshot||{},w=snapshot.website;
  if(!w){fail('This campaign website is not published.');return}
  const survey=snapshot.survey||null,questions=snapshot.questions||[];
  const currentCampaign=null;
  const localContentR=await sb.rpc('public_local_content',{p_website:w.id});const localContent=localContentR.data||{news:[],events:[],campaigns:[]};
  let heroImage='',aboutImage='';
  if(w.hero_image_path){const r=await sb.storage.from('campaign-assets').createSignedUrl(w.hero_image_path,3600);if(!r.error)heroImage=r.data.signedUrl}
  if(w.about_image_path){const r=await sb.storage.from('campaign-assets').createSignedUrl(w.about_image_path,3600);if(!r.error)aboutImage=r.data.signedUrl}
  const complianceR=await sb.rpc('public_privacy_config',{p_entity_type:'website',p_identifier:w.slug||w.id,p_hostname:location.hostname});const compliance=complianceR.data||{};if(window.CPAttribution){await window.CPAttribution.configure(compliance);await window.CPAttribution.track({websiteId:w.id});}
  const attributionContext=()=>window.CPAttribution?window.CPAttribution.context():{session_id:null,attribution:{},source:'website'};

  const c=w.content||{};
  const flat=c.candidateName?c:null;
  const name=flat?.candidateName||w.name||'Candidate';
  const area=flat?.candidateArea||w.area||'Local area';
  const initials=flat?.candidateInitials||name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const navy=flat?.brandNavy||w.branding?.primary||'#08254a';
  const blue=flat?.brandBlue||w.branding?.secondary||'#1476d4';
  const designTemplate=w.branding?.design_template||'community';
  const hero=flat?.heroHeadline||c.hero?.headline||`A stronger voice for ${area}.`;
  const heroCopy=flat?.heroCopy||c.hero?.supporting_copy||`${name} is campaigning on the issues that matter locally.`;
  const aboutHeadline=flat?.aboutHeadline||c.about?.heading||'Why I’m standing';
  const aboutLead=flat?.aboutLead||c.about?.body||`${area} deserves visible, practical local representation.`;
  const priorities=(flat?.priorities||c.priorities||[]).map((p,i)=>typeof p==='string'?{title:p,copy:''}:p);
  const campaignTitle=flat?.campaignTitle||currentCampaign?.headline||c.campaign?.headline||'Current campaign';
  const campaignCopy=flat?.campaignCopy||currentCampaign?.supporting_copy||'Back the campaign and help make the case for local action.';
  const first=name.split(/\s+/)[0];
  const homeOrder=c.home_content_order||['news','campaign','event'];
  const homeCards={news:localContent.news?.filter(x=>x)[0]?`<article class="pub-local-card"><span>News</span><h3>${esc(localContent.news[0].title)}</h3><p>${esc(localContent.news[0].excerpt||'')}</p>${localContent.news[0].local_area?`<small>${esc(localContent.news[0].local_area)}</small>`:''}</article>`:'',campaign:localContent.campaigns?.[0]?`<article class="pub-local-card"><span>Campaign</span><h3>${esc(localContent.campaigns[0].headline||localContent.campaigns[0].name)}</h3><p>${esc(localContent.campaigns[0].supporting_copy||'')}</p></article>`:'',event:localContent.events?.[0]?`<article class="pub-local-card pub-event-card" data-event-id="${localContent.events[0].id}"><span>Event</span><h3>${esc(localContent.events[0].title)}</h3><p>${new Date(localContent.events[0].starts_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}${localContent.events[0].location_name?' · '+esc(localContent.events[0].location_name):''}</p><button class="pub-btn pub-rsvp-open" type="button">RSVP</button></article>`:''};

  function question(q){
    const label=`<label>${esc(q.label)}</label>`;
    if(q.question_type==='text')return `<div class="form-q">${label}<textarea name="${q.id}"></textarea></div>`;
    if(q.question_type==='single')return `<div class="form-q">${label}<select name="${q.id}"><option value="">Select an option</option>${(q.options||[]).map(o=>`<option>${esc(o)}</option>`).join('')}</select></div>`;
    if(q.question_type==='multi')return `<div class="form-q">${label}<div class="checks">${(q.options||[]).map(o=>`<label><input type="checkbox" name="${q.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</div></div>`;
    if(q.question_type==='yesno')return `<div class="form-q">${label}<select name="${q.id}"><option value="">Select</option><option>Yes</option><option>No</option></select></div>`;
    if(q.question_type==='rating')return `<div class="form-q">${label}<select name="${q.id}">${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}</select></div>`;
    if(q.question_type==='postcode')return `<div class="form-q">${label}<input name="${q.id}" placeholder="Postcode"></div>`;
    if(q.question_type==='phone')return `<div class="form-q">${label}<input name="${q.id}" placeholder="Phone number"></div>`;
    return ''
  }

  root.innerHTML=`<style>:root{--navy:${navy};--blue:${blue}}</style><div class="pub-template-${designTemplate}">
  <header class="pub-header"><div class="pub-container"><div class="pub-id"><span class="pub-roundel">${esc(initials)}</span><span><strong>${esc(name)}</strong><small>Candidate for ${esc(area)}</small></span></div><nav><a href="#about">About</a><a href="#priorities">Priorities</a>${survey?'<a href="#survey">Have your say</a>':''}${currentCampaign?'<a href="#campaign">Campaign</a>':''}</nav></div></header>
  <main>
    <section class="pub-hero"><div class="pub-container"><div><h1>${esc(hero)}</h1><p>${esc(heroCopy)}</p>${survey?'<a class="pub-btn" href="#survey">Tell us what matters</a>':''}</div>${heroImage?`<img class="pub-live-hero-image" src="${heroImage}" alt="">`:''}</div></section>
    <section class="pub-section" id="about"><div class="pub-container pub-about-live"><div><h2>${esc(aboutHeadline)}</h2><p class="pub-lead">${esc(aboutLead)}</p>${flat?.aboutCopy?`<p>${esc(flat.aboutCopy)}</p>`:''}</div>${aboutImage?`<img class="pub-live-about-image" src="${aboutImage}" alt="">`:''}</div></section>
    <section class="pub-section alt" id="priorities"><div class="pub-container"><h2>${esc(first)}’s priorities</h2><div class="pub-grid">${priorities.map(p=>`<article><h3>${esc(p.title)}</h3><p>${esc(p.copy||'')}</p></article>`).join('')}</div></div></section>
    ${homeOrder.some(k=>homeCards[k])?`<section class="pub-section pub-local-content"><div class="pub-container"><h2>Latest locally</h2><div class="pub-local-grid">${homeOrder.map(k=>homeCards[k]||'').join('')}</div></div></section>`:''}
    ${survey?`<section class="pub-section" id="survey"><div class="pub-container"><h2>${esc(survey.name)}</h2><p class="pub-lead">Tell ${esc(first)} what matters most locally.</p><form class="pub-form"><div class="two"><input name="first_name" placeholder="First name"><input name="last_name" placeholder="Last name"><input class="full" name="email" type="email" placeholder="Email address"><input class="full" name="address_line1" placeholder="House number and street" required><input class="full" name="address_line2" placeholder="Address line 2"><input name="town_city" placeholder="Town / city" required><input name="postcode" placeholder="Postcode" required></div>${questions.filter(q=>q.enabled).map(question).join('')}<button class="pub-btn" type="submit">Send my views</button><p class="form-note">Your information will be stored securely by the campaign.</p></form></div></section>`:''}
    ${currentCampaign?`<section class="pub-section alt" id="campaign"><div class="pub-container"><h2>${esc(campaignTitle)}</h2><p class="pub-lead">${esc(campaignCopy)}</p><form class="pub-action-form" data-action="campaign_back"><div class="two"><input name="first_name" placeholder="First name"><input name="last_name" placeholder="Last name"><input class="full" name="email" type="email" placeholder="Email address"><input class="full" name="address_line1" placeholder="House number and street" required><input class="full" name="address_line2" placeholder="Address line 2"><input name="town_city" placeholder="Town / city" required><input name="postcode" placeholder="Postcode" required></div><label class="form-note"><input type="checkbox" name="consent_email" value="true"> I would like to receive campaign updates by email.</label><button class="pub-btn" type="submit">Back the campaign</button></form></div></section>`:''}
    ${(flat?.volunteerHeadline||c.volunteer?.enabled)?`<section class="pub-section" id="volunteer"><div class="pub-container"><h2>${esc(flat?.volunteerHeadline||'Help locally')}</h2><p class="pub-lead">There are lots of ways to help the campaign locally.</p><form class="pub-action-form" data-action="volunteer"><div class="two"><input name="first_name" placeholder="First name"><input name="last_name" placeholder="Last name"><input class="full" name="email" type="email" placeholder="Email address"><input class="full" name="address_line1" placeholder="House number and street" required><input class="full" name="address_line2" placeholder="Address line 2"><input name="town_city" placeholder="Town / city" required><input name="postcode" placeholder="Postcode" required></div><select name="volunteer_type"><option value="">How would you like to help?</option><option>Leaflets</option><option>Doorstep</option><option>Poster</option><option>Online</option></select><label class="form-note"><input type="checkbox" name="consent_email" value="true"> I would like to receive campaign updates by email.</label><button class="pub-btn" type="submit">I can help</button></form></div></section>`:''}
  </main>
  <footer class="pub-footer"><div class="pub-container"><strong>${esc(name)}</strong><small>Candidate for ${esc(area)}</small><div class="public-compliance-footer">${compliance?.imprint?.enabled!==false?`<p class="public-imprint">${esc(compliance?.imprint?.text||[compliance?.imprint?.promoter_name&&'Promoted by '+compliance.imprint.promoter_name,compliance?.imprint?.promoter_address&&'at '+compliance.imprint.promoter_address,compliance?.imprint?.publisher_name&&'Published by '+compliance.imprint.publisher_name,compliance?.imprint?.publisher_address&&'at '+compliance.imprint.publisher_address].filter(Boolean).join(' '))}</p>`:''}<button type="button" class="public-privacy-link" onclick="window.CPAttribution?.openChoices()">Privacy choices</button></div></div></footer></div>`;

  root.querySelectorAll('.pub-rsvp-open').forEach(btn=>btn.onclick=()=>{const card=btn.closest('[data-event-id]'),eventId=card?.dataset.eventId;if(!eventId)return;const box=document.createElement('div');box.className='pub-rsvp-inline';box.innerHTML=`<form><input name="first_name" placeholder="First name" required><input name="last_name" placeholder="Last name" required><input name="email" type="email" placeholder="Email" required><input name="postcode" placeholder="Postcode"><label><input type="checkbox" name="consent"> Email me campaign updates</label><button class="pub-btn" type="submit">RSVP</button></form>`;btn.replaceWith(box);box.querySelector('form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),submit=e.currentTarget.querySelector('button');submit.disabled=true;const r=await sb.rpc('public_rsvp_event',{p_event:eventId,p_first_name:fd.get('first_name'),p_last_name:fd.get('last_name'),p_email:fd.get('email'),p_postcode:fd.get('postcode')||null,p_consent:fd.get('consent')==='on'});box.innerHTML=r.error?'<p>We could not save your RSVP. Please try again.</p>':'<p><strong>Thanks — you’re on the list.</strong></p>'}});

  const form=root.querySelector('.pub-form');
  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type=submit]');
      const old=button.textContent;button.disabled=true;button.textContent='Sending…';
      form.querySelector('.submit-message')?.remove();
      const fd=new FormData(form),answers={};
      questions.filter(q=>q.enabled).forEach(q=>{
        if(q.question_type==='multi') answers[q.id]=fd.getAll(q.id);
        else answers[q.id]=fd.get(q.id)||'';
      });
      const geography=await resolvePostcode(fd.get('postcode'));
      const {error}=await sb.rpc('public_submit_survey_attributed',{
        p_website_id:w.id,p_survey_id:survey.id,p_campaign_id:currentCampaign?.id||null,
        p_first_name:fd.get('first_name')||null,p_last_name:fd.get('last_name')||null,
        p_email:fd.get('email')||null,p_postcode:fd.get('postcode')||null,p_phone:null,
        p_source:attributionContext().source||'website',p_answers:answers,
        p_address:{line1:fd.get('address_line1')||'',line2:fd.get('address_line2')||'',town_city:fd.get('town_city')||''},
        p_geography:geography,p_session_id:attributionContext().session_id,p_attribution:attributionContext().attribution
      });
      const msg=document.createElement('div');msg.className='submit-message '+(error?'error':'success');
      msg.textContent=error?'We could not submit your response. Please try again.':'Thank you — your views have been recorded.';
      form.appendChild(msg);
      button.disabled=false;button.textContent=old;
      if(!error)form.reset();
    })
  }


  root.querySelectorAll('.pub-action-form').forEach(actionForm=>{
    actionForm.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=actionForm.querySelector('button[type=submit]');
      const old=button.textContent;button.disabled=true;button.textContent='Sending…';
      actionForm.querySelector('.submit-message')?.remove();
      const fd=new FormData(actionForm),action=actionForm.dataset.action;
      const payload={consent_email:fd.get('consent_email')==='true'};
      if(action==='volunteer')payload.volunteer_type=fd.get('volunteer_type')||'General';
      const geography=await resolvePostcode(fd.get('postcode'));
      const {error}=await sb.rpc('public_capture_action_attributed',{
        p_website_id:w.id,p_campaign_id:currentCampaign?.id||null,p_action_type:action,
        p_first_name:fd.get('first_name')||null,p_last_name:fd.get('last_name')||null,
        p_email:fd.get('email')||null,p_postcode:fd.get('postcode')||null,p_phone:null,
        p_source:attributionContext().source||'website',p_payload:payload,
        p_address:{line1:fd.get('address_line1')||'',line2:fd.get('address_line2')||'',town_city:fd.get('town_city')||''},
        p_geography:geography,p_session_id:attributionContext().session_id,p_attribution:attributionContext().attribution
      });
      const msg=document.createElement('div');msg.className='submit-message '+(error?'error':'success');
      msg.textContent=error?'We could not save that just now. Please try again.':(action==='volunteer'?'Thank you — the campaign has your offer to help.':'Thank you — your support has been recorded.');
      actionForm.appendChild(msg);button.disabled=false;button.textContent=old;if(!error)actionForm.reset();
    })
  });

})();
