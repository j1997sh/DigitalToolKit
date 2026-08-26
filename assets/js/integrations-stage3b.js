(async function(){
'use strict';
const sb=window.cpSupabase,grid=document.getElementById('integrationLibraryGrid'),msg=document.getElementById('integrationLibraryMessage');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const providers={
 nationbuilder:{name:'NationBuilder',mark:'NB',href:'integration-nationbuilder.html',desc:'Sync people, tags, consent and source data.'},
 votesource:{name:'VoteSource',mark:'VS',href:'integration-votesource.html',desc:'Adapter ready for the provider API specification.'},
 mailchimp:{name:'Mailchimp',mark:'MC',href:'integration-mailchimp.html',desc:'Sync opted-in supporters into an email audience.'}
};
const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('login.html?next=integrations.html');return}
const [ar,ir,jr]=await Promise.all([sb.from('accounts').select('*').limit(1).single(),sb.from('integrations').select('*'),sb.from('integration_jobs').select('integration_id,status')]);
if(ar.error||ir.error||jr.error){msg.innerHTML=`<div class="state-banner error">${esc((ar.error||ir.error||jr.error).message)}</div>`;return}
const account=ar.data,rows=ir.data||[],jobs=jr.data||[];
document.querySelector('[data-account-name]').textContent=account.name||'Signed in';document.querySelector('[data-account-initials]').textContent=(account.name||'CP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
document.querySelector('[data-logout]').onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href='login.html'};
grid.innerHTML=Object.entries(providers).map(([key,p])=>{
 const i=rows.find(x=>x.provider===key),connected=i?.status==='connected',errors=i?jobs.filter(j=>j.integration_id===i.id&&j.status==='error').length:0,queued=i?jobs.filter(j=>j.integration_id===i.id&&j.status==='queued').length:0;
 const label=connected?'Connected':i?.status==='error'?'Needs attention':'Not connected';
 return `<article class="integration-card stage3b-integration-card"><div class="integration-card-top"><div class="integration-logo">${p.mark}</div><span class="status-chip ${connected?'published':'draft'}">${label}</span></div><h3>${p.name}</h3><p class="muted">${p.desc}</p>${i?`<div class="integration-mini-stats"><span><strong>${queued}</strong> queued</span><span><strong>${errors}</strong> errors</span></div>`:''}<div class="button-row"><a class="btn ${connected?'':'secondary'} small" href="${p.href}">${connected?'Manage connection':'Set up'}</a></div></article>`
}).join('');
})();