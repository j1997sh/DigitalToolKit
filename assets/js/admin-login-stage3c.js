(function(){'use strict';const sb=window.cpSupabase,form=document.getElementById('adminLoginForm'),msg=document.getElementById('adminLoginMessage');const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));form.onsubmit=async e=>{e.preventDefault();const btn=form.querySelector('button');btn.disabled=true;btn.textContent='Signing in…';const r=await sb.auth.signInWithPassword({email:adminEmail.value.trim(),password:adminPassword.value});if(r.error){msg.innerHTML=`<div class="state-banner error">${esc(r.error.message)}</div>`;btn.disabled=false;btn.textContent='Log in to HQ';return}const mr=await sb.from('organisation_memberships').select('organisation_id,role').eq('user_id',r.data.user.id).in('role',['global_admin','regional_admin']).limit(1).maybeSingle();
if(mr.error){
  await sb.auth.signOut();
  msg.innerHTML=`<div class="state-banner error">Could not check organisation access: ${esc(mr.error.message)}</div>`;
  btn.disabled=false;
  btn.textContent='Log in to HQ';
  return;
}
if(!mr.data){
  await sb.auth.signOut();
  msg.innerHTML='<div class="state-banner error">This account does not have organisation admin access.</div>';
  btn.disabled=false;
  btn.textContent='Log in to HQ';
  return;
}sessionStorage.setItem('cp_admin_org',mr.data.organisation_id);location.href='admin-dashboard.html'}})();