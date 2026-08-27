(async()=>{
 const sb=window.cpSupabase;if(!sb)return;
 const {data:{session}}=await sb.auth.getSession();if(!session){location.href='login.html?next=home.html';return}
 const [ar,wr,cr,pr,sr]=await Promise.all([
   sb.from('accounts').select('id,name,first_name,last_name,rollout_candidate_id').limit(1).single(),
   sb.from('websites').select('id,name,area,publishing_state,has_unpublished_changes').order('created_at').limit(1),
   sb.from('campaigns').select('id',{count:'exact',head:true}),
   sb.from('people').select('id',{count:'exact',head:true}),
   sb.from('survey_responses').select('id',{count:'exact',head:true})
 ]);
 const a=ar.data||{},name=a.first_name||a.name?.split(/\s+/)[0]||'there';
 homeGreeting.textContent=`Welcome, ${name}.`;
 const w=wr.data?.[0]||null;
 if(w){
   homeWebsite.href='website-overview.html?id='+encodeURIComponent(w.id);
   const state=w.publishing_state==='live'?(w.has_unpublished_changes?'Live · draft changes':'Website live'):'Website draft';
   homeReadyState.innerHTML=`<span class="home-state-chip ${w.publishing_state==='live'?'live':'draft'}">${state}</span>`;
 }else{
   homeWebsite.href='website-create.html';
   homeWebsite.querySelector('strong').textContent='Create website →';
   homeReadyState.innerHTML='<span class="home-state-chip draft">No website yet</span>';
 }
 const secondary=document.querySelectorAll('.home-secondary-card');
 const setBadge=(index,value,label)=>{if(!secondary[index])return;const b=document.createElement('small');b.className='home-count';b.textContent=`${value||0} ${label}`;secondary[index].querySelector('div').appendChild(b)};
 setBadge(0,sr.count,'responses');
 setBadge(2,(cr.count||0)+(pr.count||0),'campaign items');
})();