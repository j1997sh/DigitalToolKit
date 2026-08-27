document.addEventListener('cp-admin-ready',async()=>{
 const {sb,orgId,role}=window.CP_ADMIN;
 const r=await sb.rpc('org_admin_hosting_settings',{p_org:orgId});
 if(r.error){hostingMessage.innerHTML='<div class="state-banner error">Hosting settings could not be loaded.</div>';return}
 const cfg=r.data||{};
 hostProvider.value=cfg.provider||'cloudflare_pages';
 pagesProject.value=cfg.pages_project||'';
 publicHostUrl.value=cfg.public_url||'';
 domainAutomation.checked=!!cfg.domain_automation;
 if(role!=='global_admin'){saveHosting.disabled=true;saveHosting.title='Global admin required'}
 saveHosting.onclick=async()=>{
  saveHosting.disabled=true;saveHosting.textContent='Saving…';
  let url=publicHostUrl.value.trim().replace(/\/+$/,'');
  if(url&&!/^https:\/\//i.test(url)){hostingMessage.innerHTML='<div class="state-banner error">Public host URL must use HTTPS.</div>';saveHosting.disabled=false;saveHosting.textContent='Save';return}
  const rr=await sb.rpc('org_admin_update_hosting_settings',{p_org:orgId,p_settings:{provider:hostProvider.value,pages_project:pagesProject.value.trim(),public_url:url,domain_automation:domainAutomation.checked}});
  if(rr.error){hostingMessage.innerHTML='<div class="state-banner error">Could not save hosting settings.</div>'}else{hostingMessage.innerHTML='<div class="state-banner success">Public host settings saved.</div>'}
  saveHosting.disabled=false;saveHosting.textContent='Save';
 };
});