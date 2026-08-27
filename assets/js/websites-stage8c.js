(async()=>{
 const grid=document.getElementById('sharedWebsiteGrid');if(!grid||!window.cpSupabase)return;
 const sb=window.cpSupabase,esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const [wr,cr,nr,er,dr]=await Promise.all([
   sb.from('websites').select('*').order('created_at'),
   sb.from('campaigns').select('id,account_id,publishing_state'),
   sb.from('local_news').select('id,website_id,status'),
   sb.from('local_events').select('id,website_id,status,starts_at'),
   sb.from('domains').select('website_id,hostname,status,is_primary')
 ]);
 if(wr.error)return;
 const websites=wr.data||[],campaigns=cr.data||[],news=nr.data||[],events=er.data||[],domains=dr.data||[];
 if(!websites.length){grid.innerHTML='<div class="empty-state-card library-empty"><h3>No websites yet</h3><p>Create your first campaign website to get started.</p><a class="btn" href="website-create.html">Create website</a></div>';return}
 grid.className='website-manager-list';
 grid.innerHTML=websites.map(w=>{
   const d=domains.find(x=>x.website_id===w.id&&x.is_primary)||domains.find(x=>x.website_id===w.id);
   const n=news.filter(x=>x.website_id===w.id&&x.status==='published').length;
   const e=events.filter(x=>x.website_id===w.id&&x.status==='published').length;
   const live=w.publishing_state==='live';
   return `<article class="website-manager-card">
    <div class="website-manager-main">
      <div><span class="status-chip ${live?'published':'draft'}">${live?'Live':'Draft'}</span><h3>${esc(w.name)}</h3><p>${esc(w.area||'Local campaign')}</p></div>
      <div class="website-manager-domain"><small>Domain</small><strong>${d?esc(d.hostname):'Not connected'}</strong><span>${d?esc(d.status):''}</span></div>
    </div>
    <div class="website-manager-meta"><span><b>${n}</b> News</span><span><b>${e}</b> Events</span><span><b>${w.has_unpublished_changes?'Yes':'No'}</b> Draft changes</span></div>
    <div class="website-manager-actions"><a class="btn small" href="website-overview.html?id=${w.id}">Manage website</a><a class="btn light small" href="editor.html?site=${encodeURIComponent(w.id)}">Edit</a><a class="btn light small" href="site-content.html?website=${w.id}">News & events</a></div>
   </article>`
 }).join('')+`<article class="website-manager-create"><div><h3>Create another website</h3><p>Set up another candidate or local campaign site under this account.</p></div><a class="btn light" href="website-create.html">Create website</a></article>`;
})();