(async function(){
'use strict';
const sb=window.cpSupabase;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const {data:{session}}=await sb.auth.getSession();
if(!session){location.replace('login.html?next='+encodeURIComponent('analytics.html'));return}
let days=30;
function n(v){return Number(v||0)}
function rate(a,b){return n(b)?((n(a)/n(b))*100).toFixed(1)+'%':'0.0%'}
function list(rows){
 if(!rows?.length)return '<p class="muted">No tracked traffic yet.</p>';
 return rows.slice(0,10).map(x=>`<div class="attribution-row"><div><strong>${esc(x.label)}</strong><small>${x.visitors} visitors · ${x.page_views} views</small></div><div><b>${x.sessions}</b><span>sessions</span></div><div><b>${x.conversions}</b><span>conversions</span></div><div><b>${Number(x.conversion_rate||0).toFixed(1)}%</b><span>rate</span></div></div>`).join('');
}
function chart(rows){
 if(!rows?.length)return '<p class="muted">No tracked traffic yet.</p>';
 const w=900,h=240,pad=28,max=Math.max(...rows.map(x=>Math.max(n(x.sessions),n(x.visitors),n(x.conversions))),1);
 const x=i=>pad+(i/Math.max(rows.length-1,1))*(w-pad*2), y=v=>h-pad-(n(v)/max)*(h-pad*2);
 const path=k=>rows.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(r[k]).toFixed(1)).join(' ');
 const every=Math.max(1,Math.ceil(rows.length/6));
 const labels=rows.map((r,i)=>i%every===0||i===rows.length-1?`<text x="${x(i)}" y="${h-6}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${new Date(r.trend_date+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'})}</text>`:'').join('');
 return `<div class="analytics-legend"><span><i class="legend-line one"></i>Sessions</span><span><i class="legend-line two"></i>Visitors</span><span><i class="legend-line three"></i>Conversions</span></div><svg class="performance-svg analytics-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line class="chart-grid" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"></line><path class="analytics-line one" d="${path('sessions')}"></path><path class="analytics-line two" d="${path('visitors')}"></path><path class="analytics-line three" d="${path('conversions')}"></path>${labels}</svg>`;
}
async function load(){
 const [ov,tr,src,med,cam,land,assets,recent]=await Promise.all([
  sb.rpc('local_attribution_overview',{p_days:days}),
  sb.rpc('local_attribution_trends',{p_days:days}),
  sb.rpc('local_attribution_channels',{p_days:days,p_dimension:'source'}),
  sb.rpc('local_attribution_channels',{p_days:days,p_dimension:'medium'}),
  sb.rpc('local_attribution_channels',{p_days:days,p_dimension:'campaign'}),
  sb.rpc('local_attribution_channels',{p_days:days,p_dimension:'landing'}),
  sb.rpc('local_attribution_assets',{p_days:days}),
  sb.rpc('local_recent_conversions',{p_limit:30})
 ]);
 const err=[ov,tr,src,med,cam,land,assets,recent].find(x=>x.error)?.error;
 if(err){localAnalyticsMessage.innerHTML=`<div class="state-banner error">${esc(err.message)}</div>`;return}
 const o=ov.data||{};
 localAnalyticsKpis.innerHTML=[
  ['Sessions',o.sessions||0],['Visitors',o.visitors||0],['Page views',o.page_views||0],
  ['Converted sessions',o.converted_sessions||0],['Conversion rate',rate(o.converted_sessions,o.sessions)]
 ].map(x=>`<div class="performance-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
 localAnalyticsTrend.innerHTML=chart(tr.data||[]);
 localSources.innerHTML=list(src.data);localMediums.innerHTML=list(med.data);localUtmCampaigns.innerHTML=list(cam.data);localLandings.innerHTML=list(land.data);
 localAssetRows.innerHTML=(assets.data||[]).map(x=>`<tr><td><span class="asset-type-chip">${esc(x.asset_type)}</span></td><td><strong>${esc(x.asset_name)}</strong></td><td>${x.sessions}</td><td>${x.visitors}</td><td>${x.page_views}</td><td>${x.conversions}</td><td><strong>${Number(x.conversion_rate||0).toFixed(1)}%</strong></td></tr>`).join('')||'<tr><td colspan="7" class="muted">No tracked asset traffic yet.</td></tr>';
 localRecentConversions.innerHTML=(recent.data||[]).map(x=>`<a class="local-conversion-row" href="person.html?id=${x.person_id}"><div><strong>${esc(x.person_name||'Supporter')}</strong><small>${esc(x.conversion_type||'conversion')}${x.asset_name?' · '+esc(x.asset_name):''}</small></div><div><span>${esc(x.source||'Direct')}</span><small>${[x.medium,x.utm_campaign].filter(Boolean).map(esc).join(' · ')||'No UTM detail'}</small></div><time>${new Date(x.converted_at).toLocaleString()}</time></a>`).join('')||'<p class="muted">No attributed conversions yet.</p>';
 document.querySelectorAll('[data-days]').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===days));
}
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.days);load()});
await load();
})();