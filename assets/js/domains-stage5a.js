(async function(){
'use strict';
const sb=window.cpSupabase;
const el={
 grid:document.getElementById('domainGrid'),message:document.getElementById('domainMessage'),dialog:document.getElementById('domainDialog'),
 open:document.getElementById('addDomainButton'),close:document.getElementById('domainDialogClose'),cancel:document.getElementById('domainCancel'),
 form:document.getElementById('domainForm'),hostname:document.getElementById('domainHostname'),type:document.getElementById('domainTargetType'),
 target:document.getElementById('domainTargetId'),formMessage:document.getElementById('domainFormMessage'),submit:document.getElementById('domainSubmit'),
 accountName:document.getElementById('domainAccountName'),accountInitials:document.getElementById('domainAccountInitials'),logout:document.getElementById('domainLogout')
};
let account=null,websites=[],campaigns=[],domains=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pageMessage=(text,error=false)=>{el.message.innerHTML=text?`<div class="state-banner ${error?'error':'success'}">${esc(text)}</div>`:''};
const formMessage=(text,error=false)=>{el.formMessage.innerHTML=text?`<div class="state-banner ${error?'error':'success'}">${esc(text)}</div>`:''};
const baseHost=h=>String(h||'').replace(/^www\./,'');
function targetName(d){const row=d.target_type==='website'?websites.find(x=>x.id===d.website_id):campaigns.find(x=>x.id===d.campaign_id);return row?.name||(d.target_type==='website'?'Website':'Campaign')}
function statusLabel(d){if(d.status==='connected')return d.ssl_status==='active'?'Live · HTTPS':'Verified · HTTPS pending';if(d.status==='verifying')return 'Waiting for DNS';if(d.status==='error')return 'Needs attention';return 'DNS setup needed'}
function pairFor(d){const root=baseHost(d.hostname);return domains.filter(x=>baseHost(x.hostname)===root&&x.target_type===d.target_type&&x.website_id===d.website_id&&x.campaign_id===d.campaign_id)}
function populateTargets(){const rows=el.type.value==='website'?websites:campaigns;el.target.innerHTML=rows.length?rows.map(x=>`<option value="${x.id}">${esc(x.name)}${x.area?' — '+esc(x.area):''}</option>`).join(''):'<option value="">No items available</option>';el.target.disabled=!rows.length;el.submit.disabled=!rows.length}
function openDialog(){formMessage('');el.form.reset();el.type.value='website';populateTargets();el.dialog.showModal?el.dialog.showModal():el.dialog.setAttribute('open','');setTimeout(()=>el.hostname.focus(),0)}
function closeDialog(){formMessage('');if(el.dialog.open&&el.dialog.close)el.dialog.close();else el.dialog.removeAttribute('open')}
async function lookupTxt(name){
 const r=await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`);
 if(!r.ok)throw new Error('DNS lookup failed');
 const j=await r.json();return (j.Answer||[]).map(x=>String(x.data||'').replace(/^"|"$/g,'').split('" "').join(''))
}
async function verify(d,button){
 button.disabled=true;button.textContent='Checking…';
 try{
  const answers=await lookupTxt(d.expected_txt_name);
  const ok=answers.some(x=>x.includes(d.expected_txt_value));
  for(const row of pairFor(d)){
    const r=await sb.rpc('local_domain_mark_verification',{p_domain_id:row.id,p_verified:ok,p_error:ok?null:'TXT verification record not found yet.',p_ssl_status:ok?'provisioning':row.ssl_status||'pending'});
    if(r.error)throw r.error;
  }
  await loadDomains();
  pageMessage(ok?'Ownership verified. HTTPS will activate when the production public host is connected.':'TXT verification record not found yet. DNS changes can take time.',!ok)
 }catch(e){pageMessage(e.message,true)}
 finally{button.disabled=false;button.textContent='Check verification'}
}
function render(){
 if(!domains.length){
  el.grid.innerHTML='<div class="empty-state-card"><h3>No custom domains yet</h3><p>Add a domain you already own. Campaign Platform will give you a TXT verification record to add at your registrar.</p><button class="btn" id="emptyAddDomain">Connect domain</button></div>';
  document.getElementById('emptyAddDomain').onclick=openDialog;return;
 }
 el.grid.innerHTML=domains.map(d=>`<article class="domain-stage3-card stage5-domain-card">
  <div class="domain-card-top"><div><h3>${esc(d.hostname)}</h3><p>${esc(targetName(d))} · ${d.target_type==='website'?'Website':'Campaign'}${d.is_primary?' · Primary':''}</p></div><span class="status-chip ${d.status==='connected'?'published':'draft'}">${esc(statusLabel(d))}</span></div>
  <div class="domain-route-meta"><div><span>Primary</span><strong>${d.is_primary?'Yes':'No'}</strong></div><div><span>HTTPS</span><strong>${esc(d.ssl_status||'pending')}</strong></div><div><span>Canonical</span><strong>${esc(d.canonical_hostname||baseHost(d.hostname))}</strong></div></div>
  <div class="domain-dns-box"><strong>Verify ownership at your registrar</strong><div><span>TXT name</span><code>${esc(d.expected_txt_name||'_cp-verify.'+baseHost(d.hostname))}</code></div><div><span>TXT value</span><code>${esc(d.expected_txt_value||'Preparing…')}</code></div>
  ${d.expected_cname?`<div><span>Routing</span><code>${esc(d.hostname)} → ${esc(d.expected_cname)}</code></div>`:'<p class="muted">The production routing target will appear here once the public hosting provider is connected.</p>'}</div>
  ${d.last_verification_error?`<p class="domain-error-copy">${esc(d.last_verification_error)}</p>`:''}
  <div class="library-card-actions">
   <button class="btn secondary small" data-check="${d.id}">Check verification</button>
   ${!d.is_primary?`<button class="btn secondary small" data-primary="${d.id}">Make primary</button>`:''}
   <button class="btn secondary small" data-redirect="${d.id}">${d.redirect_to_canonical?'Canonical redirect on':'Canonical redirect off'}</button>
   <button class="btn danger-outline small" data-remove="${d.id}">Remove pair</button>
  </div>
 </article>`).join('');

 el.grid.querySelectorAll('[data-check]').forEach(b=>b.onclick=()=>verify(domains.find(x=>x.id===b.dataset.check),b));
 el.grid.querySelectorAll('[data-primary]').forEach(b=>b.onclick=async()=>{const r=await sb.rpc('local_set_primary_domain',{p_domain_id:b.dataset.primary});if(r.error)return pageMessage(r.error.message,true);await loadDomains();pageMessage('Primary domain updated.')});
 el.grid.querySelectorAll('[data-redirect]').forEach(b=>b.onclick=async()=>{const d=domains.find(x=>x.id===b.dataset.redirect);const r=await sb.rpc('local_domain_set_canonical_redirect',{p_domain_id:d.id,p_enabled:!d.redirect_to_canonical});if(r.error)return pageMessage(r.error.message,true);await loadDomains()});
 el.grid.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{const d=domains.find(x=>x.id===b.dataset.remove);if(!d)return;for(const row of pairFor(d)){const r=await sb.from('domains').delete().eq('id',row.id);if(r.error)return pageMessage(r.error.message,true)}await loadDomains();pageMessage('Domain connection removed.')});
}
async function loadDomains(){const r=await sb.rpc('local_domains_detail');if(r.error)throw r.error;domains=r.data||[];render()}
el.close.onclick=closeDialog;el.cancel.onclick=closeDialog;el.open.onclick=openDialog;el.type.onchange=populateTargets;
el.dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog()});
el.form.onsubmit=async e=>{
 e.preventDefault();formMessage('');
 const host=el.hostname.value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,'');
 if(!host)return formMessage('Enter a domain name.',true);
 if(!el.target.value)return formMessage('Choose a Website or Campaign.',true);
 el.submit.disabled=true;el.submit.textContent='Adding…';
 const r=await sb.rpc('local_connect_domain',{p_hostname:host,p_target_type:el.type.value,p_target_id:el.target.value,p_expected_cname:null,p_include_www:true});
 el.submit.disabled=false;el.submit.textContent='Add domain';
 if(r.error)return formMessage(r.error.message,true);
 closeDialog();await loadDomains();pageMessage('Domain added. Add the TXT record shown below at your registrar, then check verification.')
};
const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('login.html?next=domains.html');return}
const ar=await sb.from('accounts').select('id,name').limit(1).single();if(ar.error)return pageMessage(ar.error.message,true);account=ar.data;
const [wr,cr]=await Promise.all([sb.from('websites').select('id,name,area').order('name'),sb.from('campaigns').select('id,name').order('name')]);
if(wr.error||cr.error)return pageMessage((wr.error||cr.error).message,true);
websites=wr.data||[];campaigns=cr.data||[];
el.accountName.textContent=account.name||'Signed in';el.accountInitials.textContent=(account.name||'CP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
el.logout.onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href='login.html'};
populateTargets();await loadDomains();
})();