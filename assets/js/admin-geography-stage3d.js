document.addEventListener('cp-admin-ready',async()=>{
const {sb,orgId}=window.CP_ADMIN,esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const r=await sb.rpc('org_admin_geography_insights',{p_org:orgId});
if(r.error){adminGeographyMessage.innerHTML=`<div class="state-banner error">${esc(r.error.message)}</div>`;return}
const d=r.data||{},total=(d.resolved||0)+(d.unresolved||0),pct=total?Math.round((d.resolved/total)*100):0;
adminGeoKpis.innerHTML=`<div class="admin-kpi"><strong>${total}</strong><span>People</span></div><div class="admin-kpi"><strong>${d.resolved||0}</strong><span>Geography resolved</span></div><div class="admin-kpi"><strong>${d.unresolved||0}</strong><span>Needs geography</span></div><div class="admin-kpi"><strong>${pct}%</strong><span>Resolution rate</span></div>`;
function rank(rows,type){
 if(!rows?.length)return '<p class="muted">No geography data yet.</p>';
 return rows.map(x=>`<a class="geo-rank-row" href="admin-data.html?${type}=${encodeURIComponent(x.name)}"><div><strong>${esc(x.name)}</strong><small>${x.code?esc(x.code):'No code recorded'}</small></div><div><b>${x.people||0}</b><span>People</span></div>${x.opted_in!==undefined?`<div><b>${x.opted_in||0}</b><span>Opted in</span></div>`:''}${x.actions!==undefined?`<div><b>${x.actions||0}</b><span>Actions</span></div>`:''}</a>`).join('');
}
adminConstituencies.innerHTML=rank(d.constituencies,'constituency');
adminWards.innerHTML=rank(d.wards,'ward');
adminAuthorities.innerHTML=rank(d.local_authorities,'authority');
adminRegions.innerHTML=rank(d.regions,'region');
});