(async function(){
  'use strict';
  const sb=window.cpSupabase;
  const id=new URLSearchParams(location.search).get('id');
  const frame=document.getElementById('cmFrame');
  const hotspots=document.getElementById('cmHotspots');
  const panelEmpty=document.getElementById('cmPanelEmpty');
  const panelContent=document.getElementById('cmPanelContent');
  const saveState=document.getElementById('cmSaveState');
  const errorBox=document.getElementById('cmError');
  const device=document.getElementById('cmDevice');
  let campaign=null,surveys=[],imageUrl=null,saveTimer=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function fail(m){errorBox.hidden=false;errorBox.textContent=m}
  function saving(){saveState.querySelector('span:last-child').textContent='Saving…'}
  function saved(){saveState.querySelector('span:last-child').textContent='Saved just now'}
  async function signed(path){if(!path)return null;const r=await sb.storage.from('campaign-assets').createSignedUrl(path,3600);return r.error?null:r.data.signedUrl}
  async function accountId(){const r=await sb.from('accounts').select('id').limit(1).single();if(r.error)throw r.error;return r.data.id}
  async function upload(file){const aid=await accountId();const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const safe=(file.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'campaign');const path=`${aid}/campaigns/${campaign.id}/${Date.now()}-${safe}.${ext}`;const r=await sb.storage.from('campaign-assets').upload(path,file,{contentType:file.type||undefined});if(r.error)throw r.error;return path}

  async function load(){
    if(!id){fail('No campaign selected.');return false}
    const {data:{session}}=await sb.auth.getSession();
    if(!session){location.replace('login.html?next='+encodeURIComponent('campaign-editor.html?id='+id));return false}
    const cr=await sb.from('campaigns').select('*').eq('id',id).single();
    if(cr.error){fail('Could not load this campaign: '+cr.error.message);return false}
    campaign=cr.data;
    const sr=await sb.from('surveys').select('*').order('created_at');surveys=sr.data||[];
    imageUrl=await signed(campaign.image_path);
    document.getElementById('cmTopTitle').textContent=campaign.name;
    document.getElementById('cmBackLink').href='campaign-overview.html?id='+campaign.id;
    document.getElementById('cmSummary').innerHTML=`<dl class="profile-data"><dt>Status</dt><dd>${esc(campaign.status)}</dd><dt>Public slug</dt><dd>${esc(campaign.slug||'—')}</dd><dt>Survey</dt><dd>${esc(surveys.find(s=>s.id===campaign.survey_id)?.name||'None')}</dd></dl>`;
    return true
  }

  function previewHTML(){
    const brand=campaign.branding||{};
    const navy=brand.primary||'#08254a',blue=brand.secondary||'#1476d4';
    const pts=[...(campaign.key_points||[])];while(pts.length<3)pts.push('Add a key campaign point');
    const settings=campaign.settings||{},survey=surveys.find(s=>s.id===campaign.survey_id);
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;font-family:"Proxima Nova","Avenir Next",Arial,sans-serif;color:${navy};background:#fff}.wrap{width:min(940px,calc(100% - 36px));margin:auto}.hero{background:${navy};color:#fff;padding:82px 0 72px}.hero h1{margin:0 0 18px;font-size:70px;line-height:.91;letter-spacing:-.055em;max-width:820px}.hero p{font-size:20px;line-height:1.45;max-width:720px;margin:0}.photo{height:420px;background:#dce5ec center/cover no-repeat}.points{background:#f3f6f9;padding:54px 0}.point-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.point{background:#fff;border:1px solid #d9e3ec;padding:22px;font-size:20px;font-weight:900}.signup{padding:58px 0}.signup-box{max-width:700px}.signup h2{font-size:42px;letter-spacing:-.04em;margin:0 0 8px}.signup p{color:#667990}.formgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.formgrid input,.formgrid select{border:1px solid #cbd7e3;padding:12px;font:inherit}.full{grid-column:1/-1}.cta{margin-top:10px;background:${blue};border:0;color:#fff;padding:14px 18px;font-weight:900;font:inherit}footer{background:#061a34;color:#fff;padding:28px 0;font-size:12px}@media(max-width:700px){.hero h1{font-size:50px}.point-grid,.formgrid{grid-template-columns:1fr}.full{grid-column:auto}.photo{height:300px}}
    </style></head><body>
    <section class="hero" data-edit="hero"><div class="wrap"><h1>${esc(campaign.headline||campaign.name)}</h1><p>${esc(campaign.supporting_copy||'')}</p></div></section>
    <section class="photo" data-edit="image" style="${imageUrl?`background-image:url('${imageUrl}')`:''}"></section>
    <section class="points" data-edit="points"><div class="wrap"><div class="point-grid">${pts.slice(0,3).map(p=>`<div class="point">${esc(p)}</div>`).join('')}</div></div></section>
    <section class="signup" data-edit="signup"><div class="wrap"><div class="signup-box"><h2>${esc(survey?.name||'Back this campaign')}</h2><p>${esc(settings.signup_intro||'Add your name to support this campaign.')}</p><div class="formgrid"><input placeholder="First name"><input placeholder="Last name"><input class="full" placeholder="Email address"><input class="full" placeholder="Postcode">${settings.collect_voting_intention?'<select class="full"><option>Voting intention (optional)</option></select>':''}</div><button class="cta">${esc(settings.submit_label||'Back the campaign')}</button></div></div></section>
    <footer data-edit="imprint"><div class="wrap">${esc(settings.imprint||'Campaign imprint')}</div></footer>
    </body></html>`
  }

  function render(){
    const doc=frame.contentDocument;doc.open();doc.write(previewHTML());doc.close();
    setTimeout(()=>{
      const height=Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight);frame.style.height=height+'px';hotspots.style.height=height+'px';hotspots.innerHTML='';
      [...doc.querySelectorAll('[data-edit]')].forEach(node=>{const r=node.getBoundingClientRect(),type=node.dataset.edit,b=document.createElement('button');b.className='campaign-editor-hotspot';b.type='button';b.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;b.innerHTML=`<span>Edit ${{hero:'headline',image:'image',points:'key points',signup:'signup',imprint:'imprint'}[type]}</span>`;b.onclick=()=>openPanel(type);hotspots.appendChild(b)})
    },50)
  }

  async function save(patch){
    Object.assign(campaign,patch);saving();clearTimeout(saveTimer);await new Promise(resolve=>saveTimer=setTimeout(resolve,180));
    const r=await sb.from('campaigns').update({name:campaign.name,headline:campaign.headline,supporting_copy:campaign.supporting_copy,image_path:campaign.image_path,key_points:campaign.key_points,survey_id:campaign.survey_id,settings:campaign.settings,branding:campaign.branding,status:campaign.status,domain:campaign.domain,has_unpublished_changes:true}).eq('id',campaign.id);
    if(r.error){fail('Could not save: '+r.error.message);return}
    imageUrl=await signed(campaign.image_path);saved();render()
  }

  function field(label,id,value,textarea=false){return `<label class="field"><span>${label}</span>${textarea?`<textarea id="${id}">${esc(value||'')}</textarea>`:`<input id="${id}" value="${esc(value||'')}">`}</label>`}
  function openPanel(type){
    panelEmpty.hidden=true;panelContent.hidden=false;const settings=campaign.settings||{};
    if(type==='hero'){
      panelContent.innerHTML=`<div class="campaign-panel-head"><small>Campaign microsite</small><h3>Headline</h3></div>${field('Headline','cmHeadline',campaign.headline||campaign.name,true)}${field('Supporting copy','cmCopy',campaign.supporting_copy||'',true)}`;
      cmHeadline.oninput=()=>save({headline:cmHeadline.value,supporting_copy:cmCopy.value});cmCopy.oninput=()=>save({headline:cmHeadline.value,supporting_copy:cmCopy.value})
    }
    if(type==='image'){
      panelContent.innerHTML=`<div class="campaign-panel-head"><small>Campaign microsite</small><h3>Image</h3></div><label class="field"><span>Campaign image</span><input id="cmImageFile" type="file" accept="image/*"></label><p class="muted">One image for this standalone microsite.</p>${campaign.image_path?'<button class="btn secondary small" id="cmRemoveImage">Remove image</button>':''}`;
      cmImageFile.onchange=async()=>{const f=cmImageFile.files?.[0];if(!f)return;saving();try{await save({image_path:await upload(f)})}catch(e){fail('Could not upload image: '+e.message)}};if(document.getElementById('cmRemoveImage'))cmRemoveImage.onclick=()=>save({image_path:null})
    }
    if(type==='points'){
      const pts=[...(campaign.key_points||[])];while(pts.length<3)pts.push('');panelContent.innerHTML=`<div class="campaign-panel-head"><small>Campaign microsite</small><h3>Three key points</h3></div>${[0,1,2].map(i=>field(`Point ${i+1}`,'cmP'+i,pts[i],true)).join('')}`;
      [0,1,2].forEach(i=>document.getElementById('cmP'+i).oninput=()=>{const next=[0,1,2].map(j=>document.getElementById('cmP'+j).value);save({key_points:next})})
    }
    if(type==='signup'){
      panelContent.innerHTML=`<div class="campaign-panel-head"><small>Campaign microsite</small><h3>Signup</h3></div>${field('Intro text','cmSignupIntro',settings.signup_intro||'Add your name to support this campaign.',true)}${field('Button text','cmSubmitLabel',settings.submit_label||'Back the campaign')}<label class="toggle-row"><input type="checkbox" id="cmVoting" ${settings.collect_voting_intention?'checked':''}><span>Ask voting intention (optional)</span></label>${field('Thank-you message','cmThankYou',settings.thank_you_message||'Thank you for backing the campaign.',true)}<label class="field"><span>Optional linked survey</span><select id="cmSurvey"><option value="">None</option>${surveys.map(s=>`<option value="${s.id}" ${s.id===campaign.survey_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`;
      const update=()=>save({settings:{...(campaign.settings||{}),signup_intro:cmSignupIntro.value,submit_label:cmSubmitLabel.value,collect_voting_intention:cmVoting.checked,thank_you_message:cmThankYou.value}});[cmSignupIntro,cmSubmitLabel,cmThankYou].forEach(el=>el.oninput=update);cmVoting.onchange=update;cmSurvey.onchange=()=>save({survey_id:cmSurvey.value||null})
    }
    if(type==='imprint'){
      panelContent.innerHTML=`<div class="campaign-panel-head"><small>Campaign microsite</small><h3>Imprint</h3></div>${field('Imprint text','cmImprint',settings.imprint||'Campaign imprint',true)}`;cmImprint.oninput=()=>save({settings:{...(campaign.settings||{}),imprint:cmImprint.value}})
    }
    if(type==='brand'){
      const brand=campaign.branding||{};panelContent.innerHTML=`<div class="campaign-panel-head"><small>Campaign microsite</small><h3>Brand</h3></div><label class="field"><span>Primary colour</span><input id="cmPrimary" type="color" value="${esc(brand.primary||'#08254a')}"></label><label class="field"><span>Accent colour</span><input id="cmSecondary" type="color" value="${esc(brand.secondary||'#1476d4')}"></label>`;const update=()=>save({branding:{primary:cmPrimary.value,secondary:cmSecondary.value}});cmPrimary.oninput=update;cmSecondary.oninput=update
    }
  }

  document.querySelectorAll('[data-width]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-width]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');device.className='campaign-device '+btn.dataset.width});
  cmBrandButton.onclick=()=>openPanel('brand');
  cmPreviewButton.onclick=()=>{const w=window.open('','_blank');if(!w)return;w.document.open();w.document.write(previewHTML());w.document.close()};
  cmPublishButton.onclick=async()=>{saving();const r=await sb.rpc('publish_local_entity',{p_entity_type:'campaign',p_entity_id:campaign.id});if(r.error){fail('Could not publish: '+r.error.message);saved();return}campaign.status='published';campaign.has_unpublished_changes=false;saved();cmPublishButton.textContent='Published · v'+(r.data?.version||'');};
  if(await load())render()
})();
