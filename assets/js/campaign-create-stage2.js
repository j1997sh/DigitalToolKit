(function(){
  'use strict';
  const sb=window.cpSupabase,form=document.getElementById('standaloneCampaignCreate'),btn=document.getElementById('campaignCreateSubmit'),msg=document.getElementById('campaignCreateMessage');
  const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  form.addEventListener('submit',async e=>{
    e.preventDefault();msg.innerHTML='';
    const name=document.getElementById('campaignCreateName').value.trim();if(!name)return;
    btn.disabled=true;btn.textContent='Creating…';
    const {data:{session}}=await sb.auth.getSession();
    if(!session){location.href='login.html?next='+encodeURIComponent('campaign-create.html');return}
    const ar=await sb.from('accounts').select('id').limit(1).single();
    if(ar.error){msg.innerHTML=`<div class="state-banner error">${ar.error.message}</div>`;btn.disabled=false;btn.textContent='Create campaign';return}
    const id=crypto.randomUUID(),slug=slugify(name);
    const cr=await sb.from('campaigns').insert({
      id,account_id:ar.data.id,website_id:null,survey_id:null,name,slug,status:'draft',
      headline:name,supporting_copy:'',image_path:null,
      key_points:['Key point one','Key point two','Key point three'],
      branding:{primary:'#08254a',secondary:'#1476d4'},
      settings:{signup_intro:'Add your name to support this campaign.',submit_label:'Back the campaign',collect_voting_intention:false,thank_you_message:'Thank you for backing the campaign.'},
      supporter_count:0
    }).select('id').single();
    if(cr.error){msg.innerHTML=`<div class="state-banner error">${cr.error.message}</div>`;btn.disabled=false;btn.textContent='Create campaign';return}
    sessionStorage.clear();
    location.href='campaign-editor.html?id='+encodeURIComponent(cr.data.id)
  })
})();