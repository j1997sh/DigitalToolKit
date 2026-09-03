(async function(){'use strict';
const sb=window.cpSupabase;const {data:{session}}=await sb.auth.getSession();if(!session){location.replace('admin-login.html');return}
let org=sessionStorage.getItem('cp_admin_org'),membership=null;
if(org){const r=await sb.from('organisation_memberships').select('organisation_id,role,organisations(name)').eq('organisation_id',org).eq('user_id',session.user.id).maybeSingle();membership=r.data||null}
if(!membership){const r=await sb.from('organisation_memberships').select('organisation_id,role,organisations(name)').eq('user_id',session.user.id).in('role',['global_admin','regional_admin']).limit(1).maybeSingle();membership=r.data||null;if(membership){org=membership.organisation_id;sessionStorage.setItem('cp_admin_org',org)}}
if(!membership){location.replace('dashboard.html');return}
window.CP_ADMIN={sb,orgId:org,role:membership.role,orgName:membership.organisations?.name||'Organisation'};
const navHtml='<a href="admin-dashboard.html" data-admin-nav="overview">Overview</a><a href="admin-campaigns.html" data-admin-nav="campaigns">Campaigns</a><a href="admin-advertising.html" data-admin-nav="advertising">Advertising</a><a href="admin-data.html" data-admin-nav="data">Supporters &amp; data</a><a href="admin-accounts.html" data-admin-nav="network">Network</a><a href="admin-platform.html" data-admin-nav="platform">Platform</a>';
document.querySelectorAll('.admin-nav').forEach(nav=>{nav.classList.add('admin-nav-consolidated');nav.innerHTML=navHtml});
document.querySelectorAll('[data-admin-org-name]').forEach(x=>x.textContent=window.CP_ADMIN.orgName);const badge=document.getElementById('adminRoleBadge');if(badge)badge.textContent=membership.role==='global_admin'?'Global admin':'Regional admin';
const groups={overview:'overview',central_campaigns:'campaigns',rollouts:'campaigns',templates:'campaigns',content:'campaigns',advertising:'advertising',performance:'advertising',data:'data',attribution:'data',geography:'data',integrations:'data',accounts:'network',activity:'network',privacy:'platform',security:'platform',hosting:'platform'};
const active=groups[window.CP_ADMIN_ACTIVE]||window.CP_ADMIN_ACTIVE||'overview';
const paint=()=>document.querySelectorAll('.admin-nav a').forEach(a=>a.classList.toggle('active',a.dataset.adminNav===active));paint();
const logout=document.getElementById('adminLogout');if(logout)logout.onclick=async()=>{await sb.auth.signOut();sessionStorage.removeItem('cp_admin_org');location.href='admin-login.html'};
setTimeout(()=>{paint();document.dispatchEvent(new CustomEvent('cp-admin-ready'))},0)
})();