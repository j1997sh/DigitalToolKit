document.addEventListener('cp-admin-ready',async()=>{
 const {sb,orgId}=window.CP_ADMIN,id=new URLSearchParams(location.search).get('id');
 if(!id){location.href='admin-rollouts.html';return}
 let candidates=[],dashboard=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const msg=(t,e=false)=>detailMessage.innerHTML=t?`<div class="state-banner ${e?'error':'success'}">${esc(t)}</div>`:'';
 const norm=s=>String(s||'').toLowerCase().trim().replace(/\.[^.]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 function parseCSV(text){
  const rows=[];let row=[],field='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];if(ch==='"'){if(q&&n==='"'){field+='"';i++}else q=!q}else if(ch===','&&!q){row.push(field);field=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[]}else field+=ch}
  if(field||row.length){row.push(field);rows.push(row)}
  if(rows.length<2)return [];
  const head=rows[0].map(x=>x.trim().toLowerCase());
  return rows.slice(1).map(r=>Object.fromEntries(head.map((h,i)=>[h,(r[i]||'').trim()])));
 }
 function toImportRows(rows){
  return rows.map(x=>{
   const priorities=(x.priorities||'').split('|').map(v=>v.trim()).filter(Boolean).map(title=>({title,copy:''}));
   return {candidate_name:x.candidate_name||x.name||'',first_name:x.first_name||'',last_name:x.last_name||'',email:x.email||'',ward:x.ward||'',council:x.council||'',region:x.region||'',association_name:x.association_name||x.association||'',organiser_email:x.organiser_email||'',postcode:x.postcode||'',site_slug:x.site_slug||'',bio:x.bio||'',priorities,candidate_photo_filename:x.candidate_photo_filename||x.photo_filename||'',candidate_photo_url:x.candidate_photo_url||x.photo_url||''}
  })
 }
 function render(){
  const s=dashboard?.summary||{},r=dashboard?.rollout||{};
  rolloutTitle.textContent=r.name||'Election rollout';
  detailKpis.innerHTML=[['Candidates',s.candidates||0],['Provisioned',s.provisioned||0],['Activated',s.activated||0],['Live sites',s.live||0],['Missing photos',s.missing_photos||0]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  const f=candidateFilter.value;
  const rows=candidates.filter(x=>f==='all'||(f==='missing_photo'&&x.photo_status==='missing')||(f==='not_activated'&&x.activation_status!=='activated')||(f==='errors'&&x.validation_status==='error')||(f==='not_live'&&x.publishing_state!=='live'));
  candidateRows.innerHTML=rows.length?rows.map(x=>`<tr><td><strong>${esc(x.candidate_name)}</strong><small>${esc(x.email)}</small></td><td>${esc(x.ward)}<small>${esc(x.council)}</small></td><td><span class="status-chip ${x.photo_status==='missing'?'draft':'published'}">${esc(x.photo_status)}</span>${x.candidate_photo_filename?`<small>${esc(x.candidate_photo_filename)}</small>`:''}</td><td><span class="status-chip ${x.validation_status==='error'?'draft':'published'}">${esc(x.validation_status)}</span>${(x.validation_messages||[]).length?`<small>${esc((x.validation_messages||[]).join(' · '))}</small>`:''}</td><td>${x.provision_status}</td><td>${x.activation_status}</td><td>${x.website_id?`<div class="rollout-site-cell"><span class="status-chip ${x.publishing_state==='live'?'published':'draft'}">${x.publishing_state==='live'?'Live':'Draft'}</span><a class="btn light small" href="editor.html?id=${encodeURIComponent(x.website_id)}" target="_blank">View draft</a></div>`:'—'}</td><td>${x.provision_status==='provisioned'&&x.activation_status!=='activated'?`<button class="btn secondary small" data-activate="${x.id}">Activation link</button>`:''}${x.account_id?` <a class="btn secondary small" href="admin-account.html?id=${x.account_id}">Account</a>`:''}</td></tr>`).join(''):'<tr><td colspan="8">No candidates match this filter.</td></tr>';
  document.querySelectorAll('[data-activate]').forEach(b=>b.onclick=async()=>{const rr=await sb.rpc('org_admin_issue_activation',{p_candidate:b.dataset.activate});if(rr.error)return msg(rr.error.message,true);const url=new URL('activate.html',location.href);url.searchParams.set('token',rr.data.token);url.searchParams.set('email',rr.data.email);await navigator.clipboard.writeText(url.href).catch(()=>{});msg('Activation link created and copied to clipboard.')});
 }
 async function load(){
  const [dr,cr]=await Promise.all([sb.rpc('org_admin_rollout_dashboard',{p_rollout:id}),sb.rpc('org_admin_rollout_candidates',{p_rollout:id})]);
  if(dr.error||cr.error)return msg((dr.error||cr.error).message,true);dashboard=dr.data;candidates=cr.data||[];render()
 }
 downloadTemplate.onclick=()=>{const csv='candidate_name,first_name,last_name,email,ward,council,region,association_name,organiser_email,postcode,site_slug,bio,priorities,candidate_photo_filename,candidate_photo_url\\nJane Smith,Jane,Smith,jane.smith@example.org,West Bloggs,Bloggs Borough Council,East,North Bloggs Association,organiser@example.org,AA1 1AA,jane-smith,Local campaigner,Housing|High streets|Roads,jane.smith.jpg,\\n';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='campaign-platform-rollout-template.csv';a.click();URL.revokeObjectURL(a.href)};
 csvInput.onchange=async()=>{const file=csvInput.files?.[0];if(!file)return;const rows=toImportRows(parseCSV(await file.text()));importStatus.textContent=`${rows.length} CSV rows found. Validating…`;importPreview.innerHTML=rows.slice(0,8).map((x,i)=>`<div class="import-preview-row"><strong>${i+1}. ${esc(x.candidate_name||'Missing name')}</strong><span>${esc(x.ward)} · ${esc(x.council)}</span><small>${esc(x.email)}</small></div>`).join('')+(rows.length>8?`<p class="muted">+ ${rows.length-8} more rows</p>`:'');const rr=await sb.rpc('org_admin_import_rollout_candidates',{p_rollout:id,p_rows:rows});if(rr.error)return msg(rr.error.message,true);importStatus.textContent=`Imported ${rr.data.rows}: ${rr.data.ready} ready, ${rr.data.warnings} warnings, ${rr.data.errors} errors.`;await load();csvInput.value=''};
 photoInput.onchange=async()=>{const files=[...(photoInput.files||[])];if(!files.length)return;let matched=0,unmatched=[];for(const file of files){const key=norm(file.name);const c=candidates.find(x=>norm(x.candidate_photo_filename)===key||norm((x.email||'').split('@')[0])===key||norm(x.site_slug)===key||norm(x.candidate_name)===key);if(!c){unmatched.push(file.name);continue}const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`rollouts/${orgId}/${id}/${c.id}/candidate.${ext}`;const up=await sb.storage.from('campaign-assets').upload(path,file,{upsert:true,contentType:file.type||undefined});if(up.error){unmatched.push(file.name);continue}const ar=await sb.rpc('org_admin_attach_rollout_photo',{p_candidate:c.id,p_storage_path:path,p_original_filename:file.name});if(!ar.error)matched++}msg(`${matched} candidate photo${matched===1?'':'s'} matched and uploaded.${unmatched.length?' Unmatched: '+unmatched.join(', '):''}`,!!unmatched.length);photoInput.value='';await load()};
 provisionButton.onclick=async()=>{provisionButton.disabled=true;provisionButton.textContent='Provisioning…';const rr=await sb.rpc('org_admin_provision_rollout',{p_rollout:id});provisionButton.disabled=false;provisionButton.textContent='Provision ready candidates';if(rr.error)return msg(rr.error.message,true);msg(`${rr.data.created} candidate account/site${rr.data.created===1?'':'s'} provisioned.${rr.data.failed?` ${rr.data.failed} failed.`:''}`,!!rr.data.failed);await load()};
 candidateFilter.onchange=render;
 await load();
});