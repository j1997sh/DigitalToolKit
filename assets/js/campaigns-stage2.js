(async function(){
  'use strict';
  const sb=window.cpSupabase;
  const grid=document.getElementById('standaloneCampaignGrid');
  const message=document.getElementById('campaignLibraryMessage');
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let campaigns=[];

  function showError(text){
    message.innerHTML=`<div class="state-banner error">${esc(text)}</div>`;
  }

  function confirmDeleteCampaign(name){
    return new Promise(resolve=>{
      document.getElementById('campaignDeleteBackdrop')?.remove();
      const back=document.createElement('div');
      back.id='campaignDeleteBackdrop';
      back.className='cp-dialog-backdrop';
      back.innerHTML=`<div class="cp-dialog" role="dialog" aria-modal="true">
        <div class="cp-dialog-head">
          <h3>Delete campaign?</h3>
          <button class="cp-dialog-x" type="button" aria-label="Close">×</button>
        </div>
        <p class="cp-dialog-message"><strong>${esc(name)}</strong> will be permanently removed. This cannot be undone.</p>
        <div class="cp-dialog-actions">
          <button class="btn secondary" id="campaignDeleteCancel" type="button">Cancel</button>
          <button class="btn danger" id="campaignDeleteConfirm" type="button">Delete campaign</button>
        </div>
      </div>`;
      document.body.appendChild(back);
      const done=value=>{back.remove();resolve(value)};
      back.querySelector('.cp-dialog-x').onclick=()=>done(false);
      back.querySelector('#campaignDeleteCancel').onclick=()=>done(false);
      back.querySelector('#campaignDeleteConfirm').onclick=()=>done(true);
      back.addEventListener('click',e=>{if(e.target===back)done(false)});
    });
  }

  async function loadAccount(){
    const ar=await sb.from('accounts').select('name,first_name,last_name').limit(1).single();
    if(ar.error)return;
    const name=ar.data.name||[ar.data.first_name,ar.data.last_name].filter(Boolean).join(' ')||'Signed in';
    document.getElementById('campaignAccountName').textContent=name;
    document.getElementById('campaignAccountInitials').textContent=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  }

  function bindActions(){
    grid.querySelectorAll('[data-delete-campaign]').forEach(btn=>{
      btn.onclick=async()=>{
        const campaign=campaigns.find(c=>c.id===btn.dataset.deleteCampaign);
        if(!campaign)return;
        if(!await confirmDeleteCampaign(campaign.name))return;

        btn.disabled=true;
        btn.textContent='Deleting…';

        const {error}=await sb.from('campaigns').delete().eq('id',campaign.id);
        if(error){
          btn.disabled=false;
          btn.textContent='Delete';
          showError('Could not delete campaign: '+error.message);
          return;
        }
        campaigns=campaigns.filter(c=>c.id!==campaign.id);
        render();
      };
    });
  }

  function render(){
    message.innerHTML='';
    grid.innerHTML=campaigns.length
      ? campaigns.map(c=>`<article class="campaign-card">
          <span class="status-chip ${c.status==='published'?'published':'draft'}">${c.status==='published'?'Published':'Draft'}</span>
          <h3>${esc(c.name)}</h3>
          <p class="muted">${c.supporter_count||0} supporters${c.survey_id?' · Survey linked':''}</p>
          <div class="library-card-actions">
            <a class="btn small" href="campaign-overview.html?id=${c.id}">Manage</a>
            <a class="btn secondary small" href="campaign-editor.html?id=${c.id}">Edit microsite</a>
            <a class="btn secondary small" href="creative-editor.html?template=campaign&campaign=${c.id}">Create graphic</a>
            <button class="btn danger-outline small" type="button" data-delete-campaign="${c.id}">Delete</button>
          </div>
        </article>`).join('')
      : `<div class="empty-state-card">
          <h3>No campaigns yet</h3>
          <p>Create a standalone campaign microsite.</p>
          <a class="btn" href="campaign-create.html">Create campaign</a>
        </div>`;
    bindActions();
  }

  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    location.replace('login.html?next=campaigns.html');
    return;
  }

  document.getElementById('campaignLogout').onclick=async e=>{
    e.preventDefault();
    await sb.auth.signOut();
    location.href='login.html';
  };

  await loadAccount();

  const cr=await sb.from('campaigns').select('*').order('updated_at',{ascending:false});
  if(cr.error){
    showError(cr.error.message);
    return;
  }
  campaigns=cr.data||[];
  render();
})();