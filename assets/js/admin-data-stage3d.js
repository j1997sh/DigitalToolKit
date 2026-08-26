document.addEventListener('cp-admin-ready',async()=>{
const {sb,orgId}=window.CP_ADMIN,esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let rows=[],filtered=[];
const r=await sb.rpc('org_admin_people_data',{p_org:orgId,p_limit:10000});
if(r.error){adminDataMessage.innerHTML=`<div class="state-banner error">${esc(r.error.message)}</div>`;return}
rows=r.data||[];
const uniq=fn=>[...new Set(rows.map(fn).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
function fill(id,values){const s=document.getElementById(id),first=s.options[0].outerHTML;s.innerHTML=first+values.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}
fill('dataAccount',uniq(x=>x.account_name));fill('dataConstituency',uniq(x=>x.parliamentary_constituency));fill('dataWard',uniq(x=>x.ward));fill('dataSource',uniq(x=>x.source));fill('dataVoting',uniq(x=>x.voting_intention));fill('dataTag',uniq(x=>x.tags).flat());
const q=new URLSearchParams(location.search);if(q.get('constituency'))dataConstituency.value=q.get('constituency');if(q.get('ward'))dataWard.value=q.get('ward');if(q.get('authority')){}if(q.get('region')){}
function origin(x){return [x.latest_website,x.latest_campaign,x.latest_survey].filter(Boolean).join(' · ')||x.latest_action||'—'}
function consent(x){return x.consent_email===true?'Opted in':x.consent_email===false?'Not opted in':'Unknown'}
function apply(){
 const search=dataSearch.value.trim().toLowerCase(),account=dataAccount.value,constituency=dataConstituency.value,ward=dataWard.value,source=dataSource.value,voting=dataVoting.value,tag=dataTag.value,c=dataConsent.value;
 filtered=rows.filter(x=>{
  const hay=[x.first_name,x.last_name,x.email,x.postcode,x.ward,x.parliamentary_constituency,x.local_authority,...(x.tags||[])].join(' ').toLowerCase();
  return (!search||hay.includes(search))&&(!account||x.account_name===account)&&(!constituency||x.parliamentary_constituency===constituency)&&(!ward||x.ward===ward)&&(!source||x.source===source)&&(!voting||x.voting_intention===voting)&&(!tag||(x.tags||[]).includes(tag))&&(!c||(c==='yes'?x.consent_email===true:c==='no'?x.consent_email===false:x.consent_email==null));
 });
 dataCount.textContent=`${filtered.length} ${filtered.length===1?'Person':'People'}`;
 adminDataRows.innerHTML=filtered.map(x=>`<tr>
 <td><strong>${esc([x.first_name,x.last_name].filter(Boolean).join(' ')||'Unnamed')}</strong><small>${esc(x.email||'No email')}</small></td>
 <td>${esc(x.account_name||'')}</td><td>${esc(x.postcode||'—')}</td><td>${esc(x.ward||'—')}</td><td>${esc(x.parliamentary_constituency||'—')}</td><td>${esc(x.local_authority||'—')}</td>
 <td>${esc(x.source||'—')}</td><td><span class="data-consent ${x.consent_email===true?'yes':x.consent_email===false?'no':'unknown'}">${consent(x)}</span></td><td>${esc(x.voting_intention||'—')}</td>
 <td><strong>${esc(origin(x))}</strong><small>${esc(x.latest_action||'')}</small></td>
 <td><div class="admin-journey-tags">${(x.tags||[]).slice(0,5).map(t=>`<span class="admin-tag">${esc(t)}</span>`).join('')}</div></td>
 <td><strong>${x.action_count||0}</strong> actions<small>${x.response_count||0} responses</small></td></tr>`).join('')||'<tr><td colspan="12" class="muted">No People match these filters.</td></tr>';
}
[dataSearch,dataAccount,dataConstituency,dataWard,dataSource,dataConsent,dataVoting,dataTag].forEach(x=>x.addEventListener(x.tagName==='INPUT'?'input':'change',apply));
dataClearFilters.onclick=()=>{dataSearch.value='';[dataAccount,dataConstituency,dataWard,dataSource,dataConsent,dataVoting,dataTag].forEach(x=>x.value='');history.replaceState(null,'','admin-data.html');apply()};
adminDataExport.onclick=()=>{
 const cols=['first_name','last_name','email','phone','address_line1','address_line2','town_city','postcode','ward','ward_code','local_authority','local_authority_code','parliamentary_constituency','parliamentary_constituency_code','region','nation','source','consent_email','voting_intention','account_name','latest_website','latest_campaign','latest_survey','latest_action','action_count','response_count','tags'];
 const csv=[cols.join(','),...filtered.map(x=>cols.map(k=>`"${String(k==='tags'?(x[k]||[]).join('|'):(x[k]??'')).replaceAll('"','""')}"`).join(','))].join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='campaign-platform-supporter-data.csv';a.click();URL.revokeObjectURL(a.href);
};
apply();
});