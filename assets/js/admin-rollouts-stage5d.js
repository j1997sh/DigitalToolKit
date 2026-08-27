document.addEventListener('cp-admin-ready',async()=>{
 const {sb,orgId}=window.CP_ADMIN;
 const msg=(t,e=false)=>rolloutMessage.innerHTML=t?`<div class="state-banner ${e?'error':'success'}">${t}</div>`:'';
 async function load(){
  const r=await sb.rpc('org_admin_rollouts',{p_org:orgId});
  if(r.error){msg('Rollouts could not be loaded.',true);return}
  const rows=r.data||[];
  const sums=rows.reduce((a,x)=>({c:a.c+Number(x.candidates||0),p:a.p+Number(x.provisioned||0),a:a.a+Number(x.activated||0),l:a.l+Number(x.live||0)}),{c:0,p:0,a:0,l:0});
  rolloutKpis.innerHTML=[['Candidates',sums.c],['Provisioned',sums.p],['Activated',sums.a],['Live sites',sums.l]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  rolloutRows.innerHTML=rows.length?rows.map(x=>`<tr><td><a href="admin-rollout.html?id=${x.id}"><strong>${x.name}</strong></a></td><td>${x.election_date||'—'}</td><td>${x.candidates}</td><td>${x.provisioned}</td><td>${x.activated}</td><td>${x.live}</td><td>${x.missing_photos}</td><td>${x.status}</td></tr>`).join(''):'<tr><td colspan="8">No election rollouts yet.</td></tr>';
 }
 const open=()=>rolloutDialog.showModal?rolloutDialog.showModal():rolloutDialog.setAttribute('open','');
 const close=()=>rolloutDialog.open&&rolloutDialog.close?rolloutDialog.close():rolloutDialog.removeAttribute('open');
 newRollout.onclick=open;rolloutClose.onclick=close;rolloutCancel.onclick=close;
 rolloutForm.onsubmit=async e=>{e.preventDefault();rolloutSubmit.disabled=true;rolloutSubmit.textContent='Creating…';const r=await sb.rpc('org_admin_create_rollout',{p_org:orgId,p_name:rolloutName.value.trim(),p_election_date:rolloutDate.value||null,p_election_type:rolloutType.value,p_description:rolloutDescription.value.trim()||null,p_default_branding:{primary:'#08254a',secondary:'#1476d4'},p_default_content:{}});rolloutSubmit.disabled=false;rolloutSubmit.textContent='Create rollout';if(r.error)return msg(r.error.message,true);location.href='admin-rollout.html?id='+r.data};
 await load();
});