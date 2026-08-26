(async function(){
'use strict';

const sb=window.cpSupabase;

const el={
  grid:document.getElementById('domainGrid'),
  message:document.getElementById('domainMessage'),
  dialog:document.getElementById('domainDialog'),
  open:document.getElementById('addDomainButton'),
  close:document.getElementById('domainDialogClose'),
  cancel:document.getElementById('domainCancel'),
  form:document.getElementById('domainForm'),
  hostname:document.getElementById('domainHostname'),
  type:document.getElementById('domainTargetType'),
  target:document.getElementById('domainTargetId'),
  formMessage:document.getElementById('domainFormMessage'),
  submit:document.getElementById('domainSubmit'),
  accountName:document.getElementById('domainAccountName'),
  accountInitials:document.getElementById('domainAccountInitials'),
  logout:document.getElementById('domainLogout')
};

let account=null;
let websites=[];
let campaigns=[];
let domains=[];

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function pageMessage(text,error=false){
  el.message.innerHTML=text?`<div class="state-banner ${error?'error':'success'}">${esc(text)}</div>`:'';
}
function formMessage(text,error=false){
  el.formMessage.innerHTML=text?`<div class="state-banner ${error?'error':'success'}">${esc(text)}</div>`:'';
}

function statusLabel(status){
  if(status==='connected')return 'Connected';
  if(status==='verifying')return 'Checking DNS';
  if(status==='error')return 'Needs attention';
  return 'DNS setup needed';
}

function targetName(d){
  const row=d.target_type==='website'
    ? websites.find(x=>x.id===d.website_id)
    : campaigns.find(x=>x.id===d.campaign_id);
  return row?.name || (d.target_type==='website'?'Website':'Campaign');
}

function availableTargets(){
  return el.type.value==='website'?websites:campaigns;
}

function populateTargets(){
  const rows=availableTargets();
  if(!rows.length){
    el.target.innerHTML='<option value="">No items available</option>';
    el.target.disabled=true;
    el.submit.disabled=true;
    return;
  }
  el.target.disabled=false;
  el.submit.disabled=false;
  el.target.innerHTML=rows.map(row=>`<option value="${row.id}">${esc(row.name)}${row.area?' — '+esc(row.area):''}</option>`).join('');
}

function openDialog(){
  formMessage('');
  el.form.reset();
  el.type.value='website';
  populateTargets();
  if(typeof el.dialog.showModal==='function'){
    el.dialog.showModal();
  }else{
    el.dialog.setAttribute('open','');
  }
  setTimeout(()=>el.hostname.focus(),0);
}

function closeDialog(){
  formMessage('');
  if(el.dialog.open && typeof el.dialog.close==='function'){
    el.dialog.close();
  }else{
    el.dialog.removeAttribute('open');
  }
}

function render(){
  if(!domains.length){
    el.grid.innerHTML=`<div class="empty-state-card"><h3>No custom domains yet</h3><p>Connect a domain when a Website or Campaign is ready to go live.</p><button class="btn" id="emptyAddDomain" type="button">Connect domain</button></div>`;
    document.getElementById('emptyAddDomain').onclick=openDialog;
    return;
  }

  el.grid.innerHTML=domains.map(d=>`<article class="domain-stage3-card">
    <div class="domain-card-top">
      <div><h3>${esc(d.hostname)}</h3><p>${esc(targetName(d))} · ${d.target_type==='website'?'Website':'Campaign microsite'}</p></div>
      <span class="status-chip ${d.status==='connected'?'published':'draft'}">${statusLabel(d.status)}</span>
    </div>
    <div class="domain-dns-box">
      <strong>DNS records</strong>
      <div><span>CNAME</span><code>www → sites.campaignplatform.example</code></div>
      <div><span>A</span><code>@ → 203.0.113.10</code></div>
    </div>
    <div class="library-card-actions">
      <button class="btn secondary small" type="button" data-check-domain="${d.id}">Check DNS</button>
      <button class="btn danger-outline small" type="button" data-remove-domain="${d.id}">Remove</button>
    </div>
  </article>`).join('');

  el.grid.querySelectorAll('[data-check-domain]').forEach(button=>{
    button.onclick=async()=>{
      button.disabled=true;
      button.textContent='Checking…';
      const r=await sb.from('domains')
        .update({status:'verifying',last_checked_at:new Date().toISOString()})
        .eq('id',button.dataset.checkDomain)
        .select()
        .single();
      if(r.error){
        pageMessage(r.error.message,true);
        button.disabled=false;
        button.textContent='Check DNS';
        return;
      }
      domains=domains.map(d=>d.id===r.data.id?r.data:d);
      render();
    };
  });

  el.grid.querySelectorAll('[data-remove-domain]').forEach(button=>{
    button.onclick=async()=>{
      const r=await sb.from('domains').delete().eq('id',button.dataset.removeDomain);
      if(r.error){
        pageMessage(r.error.message,true);
        return;
      }
      domains=domains.filter(d=>d.id!==button.dataset.removeDomain);
      render();
    };
  });
}

/* Bind dismiss controls immediately, before any network request. */
el.close.onclick=closeDialog;
el.cancel.onclick=closeDialog;
el.open.onclick=openDialog;
el.type.onchange=populateTargets;

/* Escape is handled natively by <dialog>; keep the cancel event from closing oddly. */
el.dialog.addEventListener('cancel',event=>{
  event.preventDefault();
  closeDialog();
});

/* Clicking the dimmed backdrop closes the native dialog. */
el.dialog.addEventListener('click',event=>{
  const rect=el.dialog.getBoundingClientRect();
  const inside=
    event.clientX>=rect.left &&
    event.clientX<=rect.right &&
    event.clientY>=rect.top &&
    event.clientY<=rect.bottom;
  if(!inside)closeDialog();
});

el.form.onsubmit=async event=>{
  event.preventDefault();
  formMessage('');

  const host=el.hostname.value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//,'')
    .replace(/\/.*$/,'')
    .replace(/^www\./,'');

  if(!host){
    formMessage('Enter a domain name.',true);
    el.hostname.focus();
    return;
  }
  if(!el.target.value){
    formMessage('Choose a Website or Campaign microsite.',true);
    return;
  }

  el.submit.disabled=true;
  el.submit.textContent='Adding…';

  const isWebsite=el.type.value==='website';
  const payload={
    account_id:account.id,
    hostname:host,
    target_type:el.type.value,
    website_id:isWebsite?el.target.value:null,
    campaign_id:isWebsite?null:el.target.value,
    status:'pending',
    dns_instructions:{
      cname:{name:'www',value:'sites.campaignplatform.example'},
      a:{name:'@',value:'203.0.113.10'}
    }
  };

  const r=await sb.from('domains').insert(payload).select().single();

  el.submit.disabled=false;
  el.submit.textContent='Add domain';

  if(r.error){
    formMessage(r.error.message,true);
    return;
  }

  domains.unshift(r.data);
  closeDialog();
  render();
};

const {data:{session}}=await sb.auth.getSession();
if(!session){
  location.replace('login.html?next=domains.html');
  return;
}

const accountResult=await sb.from('accounts').select('id,name').limit(1).single();
if(accountResult.error){
  pageMessage(accountResult.error.message,true);
  return;
}
account=accountResult.data;

const [websiteResult,campaignResult,domainResult]=await Promise.all([
  sb.from('websites').select('id,name,area').eq('account_id',account.id).order('name'),
  sb.from('campaigns').select('id,name').eq('account_id',account.id).order('name'),
  sb.from('domains').select('*').eq('account_id',account.id).order('created_at',{ascending:false})
]);

if(websiteResult.error||campaignResult.error||domainResult.error){
  pageMessage((websiteResult.error||campaignResult.error||domainResult.error).message,true);
  return;
}

websites=websiteResult.data||[];
campaigns=campaignResult.data||[];
domains=domainResult.data||[];

el.accountName.textContent=account.name||'Signed in';
el.accountInitials.textContent=(account.name||'CP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();

el.logout.onclick=async event=>{
  event.preventDefault();
  await sb.auth.signOut();
  location.href='login.html';
};

populateTargets();
render();
})();