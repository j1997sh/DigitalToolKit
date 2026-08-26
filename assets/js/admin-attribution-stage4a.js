document.addEventListener('cp-admin-ready',async()=>{
'use strict';
const {sb,orgId}=window.CP_ADMIN;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let days=30;
async function load(){
  const [ov,src,med,cam,land,acc]=await Promise.all([
    sb.rpc('org_admin_attribution_overview',{p_org:orgId,p_days:days}),
    sb.rpc('org_admin_attribution_channels',{p_org:orgId,p_days:days,p_dimension:'source'}),
    sb.rpc('org_admin_attribution_channels',{p_org:orgId,p_days:days,p_dimension:'medium'}),
    sb.rpc('org_admin_attribution_channels',{p_org:orgId,p_days:days,p_dimension:'campaign'}),
    sb.rpc('org_admin_attribution_channels',{p_org:orgId,p_days:days,p_dimension:'landing'}),
    sb.rpc('org_admin_attribution_accounts',{p_org:orgId,p_days:days})
  ]);
  const err=[ov,src,med,cam,land,acc].find(x=>x.error)?.error;
  if(err){attributionMessage.innerHTML=`<div class="state-banner error">${esc(err.message)}</div>`;return}
  const o=ov.data||{},rate=Number(o.sessions||0)?((Number(o.converted_sessions||0)/Number(o.sessions))*100).toFixed(1):'0.0';
  attributionKpis.innerHTML=[
    ['Sessions',o.sessions||0],['Unique visitors',o.visitors||0],['Page views',o.page_views||0],['Converted sessions',o.converted_sessions||0],['Conversion rate',rate+'%']
  ].map(x=>`<div class="performance-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  function rows(data){
    if(!data?.length)return '<p class="muted">No tracked traffic yet. New visits will begin appearing after Stage 4A is deployed.</p>';
    return data.slice(0,12).map(x=>`<div class="attribution-row"><div><strong>${esc(x.label)}</strong><small>${x.visitors} visitors · ${x.page_views} page views</small></div><div><b>${x.sessions}</b><span>sessions</span></div><div><b>${x.conversions}</b><span>conversions</span></div><div><b>${Number(x.conversion_rate||0).toFixed(1)}%</b><span>rate</span></div></div>`).join('');
  }
  sourceAttribution.innerHTML=rows(src.data);mediumAttribution.innerHTML=rows(med.data);campaignAttribution.innerHTML=rows(cam.data);landingAttribution.innerHTML=rows(land.data);
  accountAttribution.innerHTML=(acc.data||[]).map(x=>`<tr><td><a href="admin-account.html?id=${x.account_id}"><strong>${esc(x.account_name)}</strong></a></td><td>${x.sessions}</td><td>${x.visitors}</td><td>${x.page_views}</td><td>${x.conversions}</td><td><strong>${Number(x.conversion_rate||0).toFixed(1)}%</strong></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No tracked traffic yet.</td></tr>';
  document.querySelectorAll('[data-days]').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===days));
}
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.days);load()});
await load();
});