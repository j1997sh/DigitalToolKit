(function(){
let started=false;
async function init(){
 if(started||!window.CP_ADMIN)return;started=true;
 const {sb,orgId}=window.CP_ADMIN;let audiences=[];
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const msg=(t,e=false)=>audienceMessage.innerHTML=t?`<div class="state-banner ${e?'error':'success'}">${esc(t)}</div>`:'';
 const areaKey=s=>String(s||'').normalize('NFKD').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
 function parseCSV(text){const rows=[];let row=[],field='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(q&&n==='"'){field+='"';i++}else q=!q}else if(c===','&&!q){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[]}else field+=c}if(field.length||row.length){row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row)}if(rows.length<2)return[];const heads=rows[0].map(x=>x.trim().toLowerCase());return rows.slice(1).map(r=>Object.fromEntries(heads.map((h,i)=>[h,(r[i]||'').trim()])))}
 function normaliseRow(x){
   let area=(x.area||x.constituency||x.ward||'').trim(),filename=(x.filename||x.file||x.audience_file||'').trim();
   let id=(x.audience_id||x.id||'').trim(),name=(x.audience_name||x.name||'').trim(),ref=(x.audience_ref||x.custom_audience||'').trim();
   if(ref&&!id){const colon=ref.indexOf(':');if(colon>0){id=ref.slice(0,colon).trim();name=ref.slice(colon+1).trim()}}
   if(!area&&filename)area=filename.replace(/\.csv$/i,'');
   return {area,area_key:areaKey(area),filename,audience_id:id,audience_name:name};
 }
 function render(){
   const q=audienceSearch.value.trim().toLowerCase(),rows=audiences.filter(x=>!q||`${x.area} ${x.filename||''} ${x.audience_id} ${x.audience_name}`.toLowerCase().includes(q));
   audienceKpis.innerHTML=[['Stored audiences',audiences.length],['With source filename',audiences.filter(x=>x.filename).length],['Ready for matching',audiences.filter(x=>x.audience_id&&x.audience_name).length]].map(x=>`<div class="admin-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
   audienceList.innerHTML=rows.length?`<div class="performance-table-wrap"><table class="performance-table"><thead><tr><th>Area</th><th>Audience file</th><th>Meta Custom Audience</th><th>Match key</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.area)}</strong></td><td><code>${esc(x.filename||`${x.area_key}.csv`)}</code></td><td><strong>${esc(x.audience_name)}</strong><small>${esc(x.audience_id)}</small></td><td><code>${esc(x.area_key)}</code></td><td><button class="btn danger-outline small" data-delete-audience="${x.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="workspace-empty-state"><div><h3>No Facebook audience mappings yet</h3><p>Import the audience mapping CSV once and every central campaign can reuse it.</p></div></div>';
   document.querySelectorAll('[data-delete-audience]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this Facebook audience mapping?'))return;const r=await sb.rpc('org_admin_delete_facebook_audience',{p_audience:b.dataset.deleteAudience});if(r.error)return msg(r.error.message,true);msg('Audience mapping deleted.');await load()});
 }
 async function load(){const r=await sb.rpc('org_admin_facebook_audiences',{p_org:orgId});if(r.error)return msg(r.error.message,true);audiences=r.data||[];render()}
 async function saveRows(rows){const valid=rows.map(normaliseRow).filter(x=>x.area&&x.audience_id&&x.audience_name);if(!valid.length)return msg('No valid audience mappings found. Include area + audience_id + audience_name, or filename + audience_ref.',true);const r=await sb.rpc('org_admin_upsert_facebook_audiences',{p_org:orgId,p_rows:valid});if(r.error)return msg(r.error.message,true);msg(`${r.data.saved} audience mapping${r.data.saved===1?'':'s'} saved.${r.data.errors?` ${r.data.errors} failed.`:''}`,!!r.data.errors);await load()}
 audienceSearch.oninput=render;
 audienceCsv.onchange=async()=>{const f=audienceCsv.files?.[0];if(!f)return;await saveRows(parseCSV(await f.text()));audienceCsv.value=''};
 downloadAudienceTemplate.onclick=()=>{const csv='area,filename,audience_id,audience_name\nBirmingham Ladywood,birminghamladywood.csv,123456789,Birmingham Ladywood\nBirmingham Erdington,birminghamerdington.csv,987654321,Birmingham Erdington\n';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='facebook-audience-library-template.csv';a.click();URL.revokeObjectURL(a.href)};
 addAudience.onclick=()=>audienceEditDialog.showModal();
 document.querySelectorAll('[data-close-audience]').forEach(x=>x.onclick=()=>audienceEditDialog.close());
 audienceEditForm.onsubmit=async e=>{e.preventDefault();await saveRows([{area:audienceArea.value,filename:audienceFilename.value,audience_id:audienceId.value,audience_name:audienceName.value}]);audienceEditDialog.close();audienceEditForm.reset()};
 await load();
}
if(window.CP_ADMIN)init().catch(console.error);else document.addEventListener('cp-admin-ready',()=>init().catch(console.error),{once:true});
})();