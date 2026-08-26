document.addEventListener('cp-admin-ready',async()=>{
'use strict';
const {sb,orgId}=window.CP_ADMIN;
const message=document.getElementById('performanceMessage');
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let trends=[],geography=[],accounts=[],range=90;

const [tr,gr,ar]=await Promise.all([
  sb.rpc('org_admin_growth_trends',{p_org:orgId,p_days:90}),
  sb.rpc('org_admin_geographic_performance',{p_org:orgId}),
  sb.rpc('org_admin_account_performance',{p_org:orgId})
]);
if(tr.error||gr.error||ar.error){
  message.innerHTML=`<div class="state-banner error">${esc((tr.error||gr.error||ar.error).message)}</div>`;
  return;
}
trends=tr.data||[]; geography=gr.data||[]; accounts=ar.data||[];
performanceUpdated.textContent='Updated from live Campaign Platform data';

function number(v){return Number(v||0)}
function pct(v){return `${number(v).toFixed(number(v)%1?1:0)}%`}
function prettyIssue(v){return v?String(v).replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase()):'—'}
function rangeRows(){return trends.slice(-range)}
function sum(key,rows=rangeRows()){return rows.reduce((n,x)=>n+number(x[key]),0)}
function previousRows(){
 const end=trends.length-range;
 const start=Math.max(0,end-range);
 return trends.slice(start,end);
}
function delta(current,previous){
 if(previous===0)return current>0?100:0;
 return ((current-previous)/previous)*100;
}
function trendLabel(v){
 const n=number(v);
 if(n>0)return `<span class="metric-change up">+${n.toFixed(1)}%</span>`;
 if(n<0)return `<span class="metric-change down">${n.toFixed(1)}%</span>`;
 return `<span class="metric-change flat">0%</span>`;
}

function renderKpis(){
 const rows=rangeRows(),prev=previousRows();
 const newPeople=sum('new_people',rows),prevPeople=sum('new_people',prev);
 const actions=sum('supporter_actions',rows),prevActions=sum('supporter_actions',prev);
 const responses=sum('survey_responses',rows),prevResponses=sum('survey_responses',prev);
 const backs=sum('campaign_backs',rows),vols=sum('volunteers',rows);
 performanceKpis.innerHTML=[
  ['New People',newPeople,trendLabel(delta(newPeople,prevPeople))],
  ['Supporter actions',actions,trendLabel(delta(actions,prevActions))],
  ['Survey responses',responses,trendLabel(delta(responses,prevResponses))],
  ['Campaign backers',backs,'<span class="metric-note">Recorded actions</span>'],
  ['Volunteer actions',vols,'<span class="metric-note">Recorded actions</span>']
 ].map(x=>`<div class="performance-kpi"><span>${x[0]}</span><strong>${x[1]}</strong>${x[2]}</div>`).join('');
}

function lineChart(elId,key,label){
 const el=document.getElementById(elId),rows=rangeRows(),w=900,h=230,pad=28;
 if(!rows.length){el.innerHTML='<p class="muted">No data.</p>';return}
 const vals=rows.map(x=>number(x[key])),max=Math.max(...vals,1);
 const pts=rows.map((x,i)=>{
   const px=pad+(i/(Math.max(rows.length-1,1)))*(w-pad*2);
   const py=h-pad-(number(x[key])/max)*(h-pad*2);
   return [px,py];
 });
 const path=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
 const area=`M ${pts[0][0].toFixed(1)} ${h-pad} `+pts.map(p=>`L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')+` L ${pts[pts.length-1][0].toFixed(1)} ${h-pad} Z`;
 const every=Math.max(1,Math.ceil(rows.length/6));
 const labels=rows.map((x,i)=>i%every===0||i===rows.length-1?`<text x="${pts[i][0]}" y="${h-6}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${new Date(x.trend_date+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'})}</text>`:'').join('');
 el.innerHTML=`<svg class="performance-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="${esc(label)}">
  <defs><linearGradient id="fill-${elId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-opacity=".18"/><stop offset="100%" stop-opacity="0"/></linearGradient></defs>
  <line class="chart-grid" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"></line>
  <line class="chart-grid" x1="${pad}" y1="${pad}" x2="${w-pad}" y2="${pad}"></line>
  <path class="chart-area" d="${area}" fill="url(#fill-${elId})"></path>
  <path class="chart-line" d="${path}"></path>${labels}
 </svg>`;
}

function miniBars(elId,key){
 const el=document.getElementById(elId),rows=rangeRows(),buckets=[];
 const groups=range<=7?7:range<=30?10:12,step=Math.ceil(rows.length/groups);
 for(let i=0;i<rows.length;i+=step){
   const chunk=rows.slice(i,i+step);
   buckets.push({label:new Date(chunk[0].trend_date+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'}),value:chunk.reduce((n,x)=>n+number(x[key]),0)});
 }
 const max=Math.max(...buckets.map(x=>x.value),1);
 el.innerHTML=`<div class="mini-bars">${buckets.map(b=>`<div class="mini-bar-col" title="${esc(b.label)}: ${b.value}"><span style="height:${Math.max(3,(b.value/max)*100)}%"></span></div>`).join('')}</div><div class="mini-bar-total"><strong>${sum(key)}</strong><span>in selected period</span></div>`;
}

function renderHeadlineLists(){
 const growth=[...geography].filter(x=>x.constituency!=='Unknown').sort((a,b)=>number(b.growth_rate)-number(a.growth_rate)||number(b.new_30d)-number(a.new_30d)).slice(0,7);
 fastGrowth.innerHTML=growth.map((x,i)=>`<a class="performance-rank-row" href="admin-data.html?constituency=${encodeURIComponent(x.constituency)}"><b>${i+1}</b><div><strong>${esc(x.constituency)}</strong><small>${x.new_30d} new in 30 days · ${x.people} total</small></div>${trendLabel(x.growth_rate)}</a>`).join('')||'<p class="muted">No data yet.</p>';
 const consent=[...geography].filter(x=>x.constituency!=='Unknown').sort((a,b)=>number(b.consent_rate)-number(a.consent_rate)||number(b.people)-number(a.people)).slice(0,7);
 consentLeaders.innerHTML=consent.map((x,i)=>`<a class="performance-rank-row" href="admin-data.html?constituency=${encodeURIComponent(x.constituency)}"><b>${i+1}</b><div><strong>${esc(x.constituency)}</strong><small>${x.opted_in} opted in · ${x.people} People</small></div><span class="rate-badge">${pct(x.consent_rate)}</span></a>`).join('')||'<p class="muted">No data yet.</p>';
}

function renderGeoTable(){
 const q=geoPerformanceSearch.value.trim().toLowerCase(),sort=geoPerformanceSort.value;
 const rows=[...geography].filter(x=>!q||String(x.constituency).toLowerCase().includes(q)).sort((a,b)=>number(b[sort])-number(a[sort])||String(a.constituency).localeCompare(String(b.constituency)));
 geoPerformanceRows.innerHTML=rows.map(x=>`<tr>
  <td><a href="admin-data.html?constituency=${encodeURIComponent(x.constituency)}"><strong>${esc(x.constituency)}</strong></a></td>
  <td>${x.people}</td><td>${x.new_7d}</td><td>${x.new_30d}</td>
  <td>${trendLabel(x.growth_rate)}</td><td>${pct(x.consent_rate)}</td><td>${x.campaign_backers}</td><td>${x.responses}</td>
  <td><span class="issue-chip">${esc(prettyIssue(x.top_issue))}</span><small>${x.top_issue_count||0} tagged</small></td>
 </tr>`).join('')||'<tr><td colspan="9" class="muted">No matching constituencies.</td></tr>';
}

function renderAccountTable(){
 const q=accountPerformanceSearch.value.trim().toLowerCase(),sort=accountPerformanceSort.value;
 const rows=[...accounts].filter(x=>!q||String(x.account_name).toLowerCase().includes(q)).sort((a,b)=>number(b[sort])-number(a[sort])||String(a.account_name).localeCompare(String(b.account_name)));
 accountPerformanceRows.innerHTML=rows.map(x=>`<tr>
  <td><a href="admin-account.html?id=${x.account_id}"><strong>${esc(x.account_name)}</strong></a></td>
  <td>${x.people}</td><td>${x.new_30d}</td><td>${x.actions}</td><td>${x.responses}</td><td>${x.campaign_backers}</td><td>${x.volunteer_people}</td>
  <td>${pct(x.consent_rate)}</td><td><strong>${pct(x.campaign_participation_rate)}</strong></td><td><span class="issue-chip">${esc(prettyIssue(x.top_issue))}</span></td>
 </tr>`).join('')||'<tr><td colspan="10" class="muted">No matching accounts.</td></tr>';
}

function renderRange(){
 renderKpis();
 lineChart('growthChart','new_people','New People over time');
 miniBars('actionsChart','supporter_actions');
 miniBars('responsesChart','survey_responses');
 document.querySelectorAll('[data-range]').forEach(b=>b.classList.toggle('active',number(b.dataset.range)===range));
}
document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{range=number(b.dataset.range);renderRange()});
geoPerformanceSearch.oninput=renderGeoTable;geoPerformanceSort.onchange=renderGeoTable;
accountPerformanceSearch.oninput=renderAccountTable;accountPerformanceSort.onchange=renderAccountTable;

renderRange();renderHeadlineLists();renderGeoTable();renderAccountTable();
});