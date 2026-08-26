document.addEventListener('cp-admin-ready',async()=>{
const {sb,orgId}=window.CP_ADMIN;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const [ov,ac,act,ints,insights,journeys,geo,trendData,geoPerf]=await Promise.all([
  sb.rpc('org_admin_overview',{p_org:orgId}),
  sb.rpc('org_admin_accounts',{p_org:orgId}),
  sb.rpc('org_admin_recent_activity',{p_org:orgId,p_limit:8}),
  sb.rpc('org_admin_integration_summary',{p_org:orgId}),
  sb.rpc('org_admin_network_insights',{p_org:orgId}),
  sb.rpc('org_admin_supporter_journeys',{p_org:orgId,p_limit:12}),sb.rpc('org_admin_growth_trends',{p_org:orgId,p_days:90}),sb.rpc('org_admin_geographic_performance',{p_org:orgId}),sb.rpc('org_admin_geography_insights',{p_org:orgId})
]);
if(ov.error||insights.error){
  adminDashboardMessage.innerHTML=`<div class="state-banner error">${esc((ov.error||insights.error).message)}</div>`;
  return;
}
const o=ov.data,i=insights.data;
adminKpis.innerHTML=[['Local accounts',o.accounts],['Websites',o.websites],['Campaigns',o.campaigns],['People',o.people],['Survey responses',o.survey_responses],['Supporter actions',o.actions]].map(x=>`<div class="admin-kpi"><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join('');
adminAccountPreview.innerHTML=(ac.data||[]).slice(0,6).map(a=>`<a class="admin-list-row" href="admin-account.html?id=${a.account_id}"><div><strong>${esc(a.account_name)}</strong><small>${a.people} People · ${a.websites} Websites · ${a.campaigns} Campaigns</small></div><span>Open →</span></a>`).join('')||'<p class="muted">No local accounts.</p>';
adminIntegrationPreview.innerHTML=(ints.data||[]).length?(ints.data||[]).map(x=>`<div class="admin-list-row"><div><strong>${esc(x.connection_name||x.provider)}</strong><small>${x.status} · ${x.queued} queued · ${x.errors} errors</small></div></div>`).join(''):'<div class="admin-empty"><strong>No central CRM connected</strong><p>Connect NationBuilder once for the whole organisation.</p></div>';
adminRecentActivity.innerHTML=(act.data||[]).map(a=>`<div class="admin-list-row"><div><strong>${esc(a.person_name||'Supporter')} · ${esc(a.action_type)}</strong><small>${esc(a.account_name)} · ${new Date(a.created_at).toLocaleString()}</small></div></div>`).join('')||'<p class="muted">No recent activity.</p>';

function bars(rows){
  if(!rows||!rows.length)return '<p class="muted">No data yet.</p>';
  const max=Math.max(...rows.map(r=>Number(r.count||0)),1);
  return rows.slice(0,8).map(r=>`<div class="admin-bar-row"><div><span>${esc(r.name)}</span><strong>${r.count}</strong></div><div class="admin-bar-track"><span style="width:${Math.max(4,(Number(r.count)/max)*100)}%"></span></div></div>`).join('');
}
const consent=i.consent||{};
adminConsentBreakdown.innerHTML=`<div class="admin-consent-grid"><div><strong>${consent.yes||0}</strong><span>Opted in</span></div><div><strong>${consent.no||0}</strong><span>Not opted in</span></div><div><strong>${consent.unknown||0}</strong><span>Unknown</span></div></div>`;
adminSourceBreakdown.innerHTML=bars(i.sources||[]);
adminTagBreakdown.innerHTML=bars(i.tags||[]);
adminVotingBreakdown.innerHTML=bars(i.voting_intention||[]);

function performance(rows,label){
  if(!rows||!rows.length)return '<p class="muted">No data yet.</p>';
  return rows.slice(0,8).map(r=>`<div class="admin-performance-row"><div><strong>${esc(r.name)}</strong><small>${esc(r.account||'')}</small></div><span><b>${r[label]||0}</b> ${label}</span></div>`).join('');
}
adminWebsitePerformance.innerHTML=performance(i.websites||[],'actions');
adminCampaignPerformance.innerHTML=performance(i.campaigns||[],'actions');
adminSurveyPerformance.innerHTML=performance(i.surveys||[],'responses');

const gd=geo.data||{},consts=(gd.constituencies||[]).filter(x=>x.name!=='Unknown').slice(0,5);
adminGeoTeaser.innerHTML=`<div class="admin-geo-summary"><div><strong>${gd.resolved||0}</strong><span>People resolved</span></div><div><strong>${gd.unresolved||0}</strong><span>Need geography</span></div></div><div class="admin-geo-top">${consts.map(x=>`<a href="admin-data.html?constituency=${encodeURIComponent(x.name)}"><span>${esc(x.name)}</span><strong>${x.people}</strong></a>`).join('')||'<p class="muted">No constituency data yet.</p>'}</div>`;
const trendRows=trendData?.data||[],last30=trendRows.slice(-30),last7=trendRows.slice(-7);
const sumPerf=(rows,key)=>rows.reduce((n,x)=>n+Number(x[key]||0),0);
const fastest=[...(geoPerf?.data||[])].filter(x=>x.constituency!=='Unknown').sort((a,b)=>Number(b.growth_rate||0)-Number(a.growth_rate||0))[0];
if(document.getElementById('dashboardPerformance'))dashboardPerformance.innerHTML=[
 ['New People · 7d',sumPerf(last7,'new_people')],
 ['New People · 30d',sumPerf(last30,'new_people')],
 ['Campaign backs · 30d',sumPerf(last30,'campaign_backs')],
 ['Survey responses · 30d',sumPerf(last30,'survey_responses')]
].map(x=>`<div class="dashboard-perf-cell"><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join('')+(fastest?`<a class="dashboard-perf-fastest" href="admin-data.html?constituency=${encodeURIComponent(fastest.constituency)}"><span>Fastest-growing constituency</span><strong>${esc(fastest.constituency)}</strong><small>${Number(fastest.growth_rate||0).toFixed(1)}% 30-day growth</small></a>`:'');
adminSupporterJourneys.innerHTML=(journeys.data||[]).map(j=>{
  const origin=[j.website_name,j.campaign_name,j.survey_name].filter(Boolean).join(' · ')||'Direct';
  const consent=j.consent_email===true?'Email opt-in':j.consent_email===false?'No email opt-in':'Consent unknown';
  const tagHtml=(j.tags||[]).slice(0,5).map(t=>`<span class="admin-tag">${esc(t)}</span>`).join('');
  return `<div class="admin-journey-row">
    <div class="admin-journey-main"><strong>${esc(j.person_name||'Supporter')}</strong><span>${esc(j.action_type)} · ${esc(j.account_name)}</span><small>${esc(origin)} · ${esc(j.source||'Unknown source')} · ${consent}${j.voting_intention?' · '+esc(j.voting_intention):''}</small></div>
    <div class="admin-journey-tags">${tagHtml}</div>
    <time>${new Date(j.created_at).toLocaleString()}</time>
  </div>`;
}).join('')||'<p class="muted">No supporter journeys yet.</p>';
});