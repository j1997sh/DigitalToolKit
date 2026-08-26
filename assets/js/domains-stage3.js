(async function(){
'use strict';
const sb=window.cpSupabase,
grid=document.getElementById('domainGrid'),
msg=document.getElementById('domainMessage'),
dialog=document.getElementById('domainDialog'),
addButton=document.getElementById('addDomainButton'),
closeButton=document.getElementById('domainDialogClose'),
cancelButton=document.getElementById('domainCancel'),
form=document.getElementById('domainForm'),
hostnameInput=document.getElementById('domainHostname'),
targetType=document.getElementById('domainTargetType'),
targetId=document.getElementById('domainTargetId'),
accountName=document.getElementById('domainAccountName'),
accountInitials=document.getElementById('domainAccountInitials'),
logoutButton=document.getElementById('domainLogout');
let account=null,websites=[],campaigns=[],domains=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function statusLabel(s){return s==='connected'?'Connected':s==='verifying'?'Checking DNS':s==='error'?'Needs attention':'DNS setup needed'}
function targetName(d){return d.target_type==='website'?(websites.find(x=>x.id===d.website_id)?.name||'Website'):(campaigns.find(x=>x.id===d.campaign_id)?.name||'Campaign')}
function render(){
  grid.innerHTML=domains.length?domains.map(d=>`<article class="domain-stage3-card">
    <div class="domain-card-top"><div><h3>${esc(d.hostname)}</h3><p>${esc(targetName(d))} · ${d.target_type==='website'?'Website':'Campaign microsite'}</p></div><span class="status-chip ${d.status==='connected'?'published':'draft'}">${statusLabel(d.status)}</span></div>
    <div class="domain-dns-box"><strong>DNS records</strong><div><span>CNAME</span><code>www → sites.campaignplatform.example</code></div><div><span>A</span><code>@ → 203.0.113.10</code></div></div>
    <div class="library-card-actions"><button class="btn secondary small" data-check="${d.id}">Check DNS</button><button class="btn danger-outline small" data-remove="${d.id}">Remove</button></div>
  </article>`).join(''):`<div class="empty-state-card"><h3>No custom domains yet</h3><p>Connect a domain when a Website or Campaign is ready to go live.</p><button class="btn" id="emptyAddDomain">Connect domain</button></div>`;
  document.getElementById('emptyAddDomain')?.addEventListener('click',openDialog);
  grid.querySelectorAll('[data-check]').forEach(b=>b.onclick=async()=>{const id=b.dataset.check;b.disabled=true;b.textContent='Checking…';const r=await sb.from('domains').update({status:'verifying',last_checked_at:new Date().toISOString()}).eq('id',id).select().single();if(r.error){show(r.error.message,true);return}domains=domains.map(x=>x.id===id?r.data:x);render()});
  grid.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{const id=b.dataset.remove;const r=await sb.from('domains').delete().eq('id',id);if(r.error){show(r.error.message,true);return}domains=domains.filter(x=>x.id!==id);render()});
}
function show(t,error=false){msg.innerHTML=`<div class="state-banner ${error?'error':'success'}">${esc(t)}</div>`}
function targetOptions(){const type=targetType.value,rows=type==='website'?websites:campaigns;targetId.innerHTML=rows.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
function openDialog(){dialog.hidden=false;targetOptions();requestAnimationFrame(()=>hostnameInput.focus())}
function closeDialog(){dialog.hidden=true;form.reset();targetOptions();msg.innerHTML=''}
addButton.addEventListener('click',e=>{e.preventDefault();openDialog()});
closeButton.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeDialog()});
cancelButton.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeDialog()});
targetType.addEventListener('change',targetOptions);
dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.hidden){e.preventDefault();closeDialog()}});
form.onsubmit=async e=>{e.preventDefault();const host=hostnameInput.value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'');if(!host){show('Enter a domain name.',true);hostnameInput.focus();return}const type=targetType.value,id=targetId.value;const payload={account_id:account.id,hostname:host,target_type:type,website_id:type==='website'?id:null,campaign_id:type==='campaign'?id:null,status:'pending',dns_instructions:{cname:{name:'www',value:'sites.campaignplatform.example'},a:{name:'@',value:'203.0.113.10'}}};const r=await sb.from('domains').insert(payload).select().single();if(r.error){show(r.error.message,true);return}domains.unshift(r.data);closeDialog();render()};
const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('login.html?next=domains.html');return}
const [ar,wr,cr,dr]=await Promise.all([sb.from('accounts').select('*').limit(1).single(),sb.from('websites').select('id,name').order('name'),sb.from('campaigns').select('id,name').order('name'),sb.from('domains').select('*').order('created_at',{ascending:false})]);
if(ar.error||wr.error||cr.error||dr.error){show((ar.error||wr.error||cr.error||dr.error).message,true);return}
account=ar.data;websites=wr.data||[];campaigns=cr.data||[];domains=dr.data||[];
accountName.textContent=account.name||'Signed in';accountInitials.textContent=(account.name||'CP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
logoutButton.onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href='login.html'};render()
})();