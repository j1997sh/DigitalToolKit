(async()=>{
 const root=document.getElementById('websiteOverviewRoot');if(!root||!window.cpSupabase)return;
 const sb=window.cpSupabase,id=new URLSearchParams(location.search).get('id');if(!id)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const [wr,cr,nr,er,sr,dr]=await Promise.all([
  sb.from('websites').select('*').eq('id',id).single(),
  sb.from('campaigns').select('id,name,headline,publishing_state,status,updated_at').order('updated_at',{ascending:false}),
  sb.from('local_news').select('id,title,status,published_at,created_at').eq('website_id',id).order('created_at',{ascending:false}).limit(1),
  sb.from('local_events').select('id,title,status,starts_at,location_name,attendee_count').eq('website_id',id).order('starts_at',{ascending:true}).limit(1),
  sb.from('surveys').select('id,name,status,response_count').eq('website_id',id).order('created_at',{ascending:false}).limit(1),
  sb.from('domains').select('hostname,status,is_primary').eq('website_id',id).order('is_primary',{ascending:false}).limit(1)
 ]);
 if(wr.error)return;
 const w=wr.data,campaigns=(cr.data||[]).filter(c=>c),news=nr.data?.[0]||null,event=er.data?.[0]||null,survey=sr.data?.[0]||null,domain=dr.data?.[0]||null;
 const contentUrl='site-content.html?website='+encodeURIComponent(id);
 const editUrl='editor.html?site='+encodeURIComponent(id);
 const previewUrl='editor.html?id='+encodeURIComponent(id);
 const activeCampaign=campaigns.find(c=>c.publishing_state==='live')||campaigns[0]||null;
 const live=w.publishing_state==='live';
 const date=x=>x?new Date(x).toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'}):'—';
 root.innerHTML=`
 <section class="website-command-hero">
   <div class="website-command-title">
     <span class="status-chip ${live?'published':'draft'}">${live?'Live':'Draft'}</span>
     <h2>${esc(w.name)}</h2>
     <p>${esc(w.area||'Local campaign')}${domain?` · ${esc(domain.hostname)}`:''}</p>
   </div>
   <div class="website-command-actions">
     <a class="website-job-card primary-job" href="${editUrl}">
       <span class="website-job-icon">01</span><div><strong>Edit website</strong><small>Homepage, about, priorities and images</small></div><b>Open →</b>
     </a>
     <a class="website-job-card" href="${contentUrl}">
       <span class="website-job-icon">02</span><div><strong>News & events</strong><small>Publish local updates and upcoming events</small></div><b>Open →</b>
     </a>
     <a class="website-job-card" href="campaigns.html">
       <span class="website-job-icon">03</span><div><strong>Campaigns</strong><small>Create and manage local issue campaigns</small></div><b>Open →</b>
     </a>
     <a class="website-job-card" href="${previewUrl}">
       <span class="website-job-icon">04</span><div><strong>Preview</strong><small>Check the current draft before publishing</small></div><b>Open →</b>
     </a>
   </div>
 </section>

 <div class="website-management-grid">
  <section class="panel website-status-panel">
    <div class="panel-head"><div><h3>Your website</h3><p class="muted">The content currently connected to this site.</p></div></div>
    <div class="website-content-summary">
      <a href="${editUrl}"><span>Homepage & about</span><strong>Manage</strong></a>
      <a href="${contentUrl}"><span>News</span><strong>${news?esc(news.title):'Add story'}</strong><small>${news?esc(news.status):'No stories yet'}</small></a>
      <a href="campaigns.html"><span>Campaigns</span><strong>${activeCampaign?esc(activeCampaign.headline||activeCampaign.name):'Add campaign'}</strong><small>${campaigns.length} campaign${campaigns.length===1?'':'s'}</small></a>
      <a href="${contentUrl}"><span>Events</span><strong>${event?esc(event.title):'Add event'}</strong><small>${event?date(event.starts_at):'No events yet'}</small></a>
      <a href="${survey?`survey-overview.html?id=${survey.id}`:'surveys.html'}"><span>Survey</span><strong>${survey?esc(survey.name):'No survey'}</strong><small>${survey?`${survey.response_count||0} responses`:'Add or link a survey'}</small></a>
    </div>
  </section>

  <section class="panel website-publish-summary">
    <div class="panel-head"><div><h3>Publishing status</h3><p class="muted">What residents can currently see.</p></div></div>
    <div class="website-publish-state ${live?'is-live':'is-draft'}">
      <strong>${live?'Website is live':'Website is not live'}</strong>
      <span>${w.has_unpublished_changes?'Draft changes are waiting to be published.':live?'Published version is up to date.':'Finish your content, preview it and publish when ready.'}</span>
    </div>
    <dl class="website-status-list">
      <div><dt>Domain</dt><dd>${domain?esc(domain.hostname):'No custom domain'}</dd></div>
      <div><dt>Domain status</dt><dd>${domain?esc(domain.status):'—'}</dd></div>
      <div><dt>Last published</dt><dd>${date(w.published_at)}</dd></div>
      <div><dt>Draft changes</dt><dd>${w.has_unpublished_changes?'Yes':'No'}</dd></div>
    </dl>
    <div class="button-row"><a class="btn secondary small" href="domains.html">Domains</a><a class="btn secondary small" href="${previewUrl}">Preview draft</a></div>
  </section>
 </div>`;
})();