(function(){
'use strict';
function cleanPath(){
  const p=location.pathname||'/';
  const s=p.indexOf('/site/'),c=p.indexOf('/campaign/');
  if(s>=0)return p.slice(s);
  if(c>=0)return p.slice(c);
  return p;
}
async function resolve(entityType,fallbackIdentifier){
  const sb=window.cpSupabase;if(!sb)throw new Error('Public router unavailable');
  const path=cleanPath();
  let rr=await sb.rpc('public_route_request',{p_hostname:location.hostname,p_path:path});
  if(rr.error)throw rr.error;
  let route=rr.data;
  if(route?.status===308&&route.redirect_url){location.replace(route.redirect_url);return null}
  if(route?.status===200&&route.entity_type===entityType){
    setCanonical(route.canonical_url);return route
  }
  if(fallbackIdentifier){
    const dr=await sb.rpc('public_resolve_deployment',{p_entity_type:entityType,p_identifier:fallbackIdentifier,p_hostname:location.hostname});
    if(dr.error)throw dr.error;
    if(dr.data){
      const canonical=entityType==='website'?'/site/'+fallbackIdentifier:'/campaign/'+fallbackIdentifier;
      setCanonical(canonical);
      return {status:200,entity_type:entityType,deployment:dr.data,canonical_url:canonical,route_source:'legacy_query'}
    }
  }
  return route||{status:404,reason:'route_not_found'}
}
function setCanonical(url){
  if(!url)return;
  let absolute=url;
  try{absolute=new URL(url,location.origin).href}catch(_){}
  let link=document.querySelector('link[rel="canonical"]');
  if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link)}
  link.href=absolute;
}
window.CPPublicRouter={resolve,cleanPath,setCanonical};
})();