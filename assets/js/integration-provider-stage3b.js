(async function(){
'use strict';
const sb=window.cpSupabase,provider=document.body.dataset.integrationProvider,msg=document.getElementById('providerMessage'),off=document.getElementById('providerDisconnected'),on=document.getElementById('providerConnected'),hero=document.getElementById('providerHeroStatus');
let account=null,integration=null,logs=[],jobs=[],people=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const nice=s=>s?new Date(s).toLocaleString():'Never';
function show(t,error=false){msg.innerHTML=`<div class="state-banner ${error?'error':'success'}">${esc(t)}</div>`}
async function invoke(name,body){const r=await sb.functions.invoke(name,{body});if(r.error)throw new Error(r.error.message||'Function failed');if(r.data?.error)throw new Error(r.data.error);return r.data}
async function refresh(){
 const [ir,lr,jr,pr]=await Promise.all([
  sb.from('integrations').select('*').eq('provider',provider).maybeSingle(),
  sb.from('integration_sync_log').select('*').order('created_at',{ascending:false}).limit(30),
  sb.from('integration_jobs').select('*').order('created_at',{ascending:false}).limit(100),
  sb.from('people').select('id,external_ids')
 ]);
 integration=ir.data||null;logs=(lr.data||[]).filter(x=>!integration||x.integration_id===integration.id);jobs=(jr.data||[]).filter(x=>!integration||x.integration_id===integration.id);people=pr.data||[];render()
}
function connectionForm(){
 if(provider==='votesource') return `<section class="panel integration-setup-panel"><div class="panel-head"><div><h3>Provider API required</h3><p class="muted">The sync engine has a VoteSource adapter slot, queue and logs, but Campaign Platform will not guess its authentication or endpoints.</p></div></div><div class="integration-api-required"><strong>Needed to finish this connector</strong><span>Authentication method</span><span>Base API URL</span><span>Person create/update endpoint</span><span>Tag / campaign-data endpoints</span></div></section>`;
 if(provider==='nationbuilder') return `<section class="panel integration-setup-panel"><div class="panel-head"><div><h3>Connect NationBuilder</h3><p class="muted">Use a NationBuilder API access token for the current connection flow. The token is sent straight to the server-side worker and is never stored in browser data. Once production hosting is in place, this screen can switch to NationBuilder OAuth without changing the sync engine.</p></div></div><form id="providerConnectForm" class="integration-connect-form"><label class="field"><span>Nation slug</span><input id="nationSlug" placeholder="your-nation" required></label><label class="field"><span>Connection name</span><input id="connectionName" placeholder="Main NationBuilder"></label><label class="field"><span>Access token</span><input id="accessToken" type="password" autocomplete="off" required></label><div class="button-row"><button class="btn" type="submit">Verify & connect</button></div></form></section>`;
 return `<section class="panel integration-setup-panel"><div class="panel-head"><div><h3>Connect Mailchimp</h3><p class="muted">Connect one Mailchimp audience. Only supporters with an email address can be synced.</p></div></div><form id="providerConnectForm" class="integration-connect-form"><label class="field"><span>Data centre</span><input id="dataCenter" placeholder="us6" required></label><label class="field"><span>Audience ID</span><input id="audienceId" required></label><label class="field"><span>Connection name</span><input id="connectionName" placeholder="Campaign supporters"></label><label class="field"><span>Access token</span><input id="accessToken" type="password" autocomplete="off" required></label><div class="button-row"><button class="btn" type="submit">Verify & connect</button></div></form></section>`;
}
function connectedView(){
 const synced=people.filter(p=>p.external_ids&&p.external_ids[provider]).length,queued=jobs.filter(j=>j.status==='queued'||j.status==='running').length,errors=jobs.filter(j=>j.status==='error').length,success=jobs.filter(j=>j.status==='success').length;
 const rules=integration.rules||{},mapping=integration.mappings||{};
 return `<section class="connection-summary stage3b-connection-summary"><div><span class="status-chip published">Connected</span><h2>${esc(integration.connection_name||provider)}</h2><p class="muted">Last sync: ${nice(integration.last_sync_at)}</p></div><div class="button-row"><button class="btn secondary small" id="runSync">Sync all People</button><button class="btn danger-outline small" id="disconnectProvider">Disconnect</button></div></section>
 <div class="sync-stat-grid"><div class="sync-stat"><strong>${synced}</strong><small>People linked</small></div><div class="sync-stat"><strong>${queued}</strong><small>Queued</small></div><div class="sync-stat"><strong>${success}</strong><small>Completed jobs</small></div><div class="sync-stat"><strong>${errors}</strong><small>Errors</small></div></div>
 <div class="integration-tabs"><button class="integration-tab active" data-tab="mapping">Sync settings</button><button class="integration-tab" data-tab="rules">Action rules</button><button class="integration-tab" data-tab="log">Sync log</button></div>
 <section class="integration-panel active" data-panel="mapping"><div class="mapping-section">
  <div class="integration-setting-row"><div><strong>Automatic sync</strong><p>Queue a Person whenever they take a matching action.</p></div><label class="switch-control"><input type="checkbox" id="autoSync" ${integration.auto_sync?'checked':''}><span></span></label></div>
  <h3>Standard person mapping</h3><table class="mapping-table"><tbody>
   <tr><td>Email</td><td>${provider==='mailchimp'?'Email address':'email'}</td><td>Always when present</td></tr>
   <tr><td>First / last name</td><td>${provider==='mailchimp'?'FNAME / LNAME':'first_name / last_name'}</td><td>On</td></tr>
   <tr><td>Postcode</td><td>${provider==='mailchimp'?'POSTCODE merge field':'registered address'}</td><td>On</td></tr>
   <tr><td>Email consent</td><td>${provider==='mailchimp'?'subscriber status':'email opt-in'}</td><td>On</td></tr>
   <tr><td>Campaign Platform tags</td><td>${provider==='mailchimp'?'contact tags':'person tags'}</td><td>On</td></tr>
  </tbody></table>
  <label class="field"><span>Voting intention custom field slug (NationBuilder only)</span><input id="votingField" value="${esc(mapping.voting_intention_field||'')}" ${provider!=='nationbuilder'?'disabled':''} placeholder="voting_intention"></label>
  <button class="btn small" id="saveSyncSettings">Save settings</button>
 </div></section>
 <section class="integration-panel" data-panel="rules"><div class="mapping-section"><h3>Actions that trigger automatic sync</h3><p class="muted">Leave all selected to sync every supporter action.</p>${['survey_response','campaign_back','signup','volunteer'].map(a=>`<label class="integration-check-row"><input type="checkbox" data-action-rule="${a}" ${(rules.action_types||[]).length===0||(rules.action_types||[]).includes(a)?'checked':''}><span>${a.replace('_',' ')}</span></label>`).join('')}<button class="btn small" id="saveRules">Save rules</button></div></section>
 <section class="integration-panel" data-panel="log"><div class="sync-log-stage3b">${logs.length?logs.map(l=>`<div class="sync-log-row ${l.status}"><span class="sync-log-dot"></span><div><strong>${esc(l.message||l.status)}</strong><small>${nice(l.created_at)}</small></div></div>`).join(''):'<div class="empty-state-card compact"><p>No sync activity yet.</p></div>'}</div>${errors?'<button class="btn secondary small" id="retryErrors">Retry failed jobs</button>':''}</section>`;
}
function bind(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-panel]').forEach(p=>p.classList.toggle('active',p.dataset.panel===b.dataset.tab))});
 const f=document.getElementById('providerConnectForm');if(f)f.onsubmit=async e=>{e.preventDefault();const btn=f.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Checking…';try{const body={provider,action:'connect',access_token:accessToken.value,connection_name:connectionName.value};if(provider==='nationbuilder')body.nation_slug=nationSlug.value;if(provider==='mailchimp'){body.data_center=dataCenter.value;body.audience_id=audienceId.value}await invoke('integration-connect',body);show('Connection verified.');await refresh()}catch(err){show(err.message,true);btn.disabled=false;btn.textContent='Verify & connect'}};
 const dis=document.getElementById('disconnectProvider');if(dis)dis.onclick=async()=>{dis.disabled=true;try{await invoke('integration-connect',{provider,action:'disconnect'});show('Disconnected.');await refresh()}catch(e){show(e.message,true);dis.disabled=false}};
 const run=document.getElementById('runSync');if(run)run.onclick=async()=>{run.disabled=true;run.textContent='Syncing…';try{const r=await invoke('integration-sync',{integration_id:integration.id,full_sync:true});show(`Sync processed ${r.processed||0} records${r.errors?` with ${r.errors} errors`:''}.`,!!r.errors);await refresh()}catch(e){show(e.message,true);run.disabled=false;run.textContent='Sync all People'}};
 const save=document.getElementById('saveSyncSettings');if(save)save.onclick=async()=>{const mappings={...(integration.mappings||{}),voting_intention_field:votingField?.value?.trim()||''};const r=await sb.from('integrations').update({auto_sync:autoSync.checked,mappings}).eq('id',integration.id);if(r.error){show(r.error.message,true);return}show('Sync settings saved.');await refresh()};
 const sr=document.getElementById('saveRules');if(sr)sr.onclick=async()=>{const checked=[...document.querySelectorAll('[data-action-rule]:checked')].map(x=>x.dataset.actionRule);const all=[...document.querySelectorAll('[data-action-rule]')].map(x=>x.dataset.actionRule);const action_types=checked.length===all.length?[]:checked;const r=await sb.from('integrations').update({rules:{...(integration.rules||{}),action_types}}).eq('id',integration.id);if(r.error){show(r.error.message,true);return}show('Action rules saved.');await refresh()};
 const retry=document.getElementById('retryErrors');if(retry)retry.onclick=async()=>{retry.disabled=true;const ids=jobs.filter(j=>j.status==='error').map(j=>j.id);if(ids.length){const r=await sb.from('integration_jobs').update({status:'queued',last_error:null}).in('id',ids);if(r.error){show(r.error.message,true);return}try{await invoke('integration-sync',{integration_id:integration.id});show('Failed jobs retried.');await refresh()}catch(e){show(e.message,true)}}};
}
function render(){
 const connected=integration?.status==='connected';
 hero.innerHTML=`<span class="status-chip ${connected?'published':'draft'}">${connected?'Connected':integration?.status==='error'?'Needs attention':'Not connected'}</span>`;
 off.innerHTML=connected?'':connectionForm(); on.innerHTML=connected?connectedView():'';
 bind()
}
const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('login.html?next='+encodeURIComponent(location.pathname.split('/').pop()));return}
const ar=await sb.from('accounts').select('*').limit(1).single();if(ar.error){show(ar.error.message,true);return}account=ar.data;document.querySelector('[data-account-name]').textContent=account.name||'Signed in';document.querySelector('[data-account-initials]').textContent=(account.name||'CP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();document.querySelector('[data-logout]').onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href='login.html'};
await refresh()
})();