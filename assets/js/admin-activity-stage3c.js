document.addEventListener('cp-admin-ready',async()=>{
const {sb,orgId}=window.CP_ADMIN,esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const r=await sb.rpc('org_admin_supporter_journeys',{p_org:orgId,p_limit:100});
if(r.error){adminActivity.innerHTML=`<div class="state-banner error">${esc(r.error.message)}</div>`;return}
adminActivity.innerHTML=(r.data||[]).map(j=>{
 const origin=[j.website_name,j.campaign_name,j.survey_name].filter(Boolean).join(' · ')||'Direct';
 const consent=j.consent_email===true?'Email opt-in':j.consent_email===false?'No email opt-in':'Consent unknown';
 return `<div class="admin-journey-row full"><div class="admin-journey-main"><strong>${esc(j.person_name||'Supporter')}</strong><span>${esc(j.action_type)} · ${esc(j.account_name)}</span><small>${esc(origin)} · ${esc(j.source||'Unknown source')} · ${consent}${j.voting_intention?' · '+esc(j.voting_intention):''}</small></div><div class="admin-journey-tags">${(j.tags||[]).map(t=>`<span class="admin-tag">${esc(t)}</span>`).join('')}</div><time>${new Date(j.created_at).toLocaleString()}</time></div>`;
}).join('')||'<p class="muted">No network activity yet.</p>';
});