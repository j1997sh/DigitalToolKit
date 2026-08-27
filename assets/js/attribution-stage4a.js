(function(){
'use strict';
const SESSION_KEY='cp_attribution_session_id';
const VISITOR_KEY='cp_attribution_visitor_id';
const SESSION_VISITOR_KEY='cp_attribution_session_visitor_id';
const TOUCH_KEY='cp_attribution_current_touch';
const CONSENT_KEY='cp_privacy_consent';
const uuid=()=>crypto.randomUUID();
const valid=id=>/^[0-9a-f-]{36}$/i.test(id||'');
function sid(){let id=sessionStorage.getItem(SESSION_KEY);if(!valid(id)){id=uuid();sessionStorage.setItem(SESSION_KEY,id)}return id}
function getConsent(){try{return JSON.parse(localStorage.getItem(CONSENT_KEY)||'null')}catch(_){return null}}
function saveConsent(c){localStorage.setItem(CONSENT_KEY,JSON.stringify(c))}
function visitor(persistent){
 const store=persistent?localStorage:sessionStorage,key=persistent?VISITOR_KEY:SESSION_VISITOR_KEY;
 let id=store.getItem(key);if(!valid(id)){id=uuid();store.setItem(key,id)}return id
}
function rawTouch(){
 const q=new URLSearchParams(location.search),out={};
 ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','source','fbclid','gclid','msclkid'].forEach(k=>{const v=q.get(k);if(v)out[k]=v});
 if(document.referrer)out.referrer=document.referrer;
 out.landing_path=location.pathname;out.captured_at=new Date().toISOString();return out
}
let config=null,currentTouch={},tracked=false;
function allowedTouch(){
 const consent=getConsent(),t={...rawTouch()};
 if(!consent?.marketing){delete t.fbclid;delete t.gclid;delete t.msclkid;delete t.utm_content;delete t.utm_term}
 return t
}
function storeTouch(){
 let saved={};try{saved=JSON.parse(sessionStorage.getItem(TOUCH_KEY)||'{}')}catch(_){}
 const now=allowedTouch(),q=new URLSearchParams(location.search),has=['utm_source','utm_medium','utm_campaign','source','fbclid','gclid','msclkid'].some(k=>q.get(k));
 if(has||!Object.keys(saved).length)saved={...saved,...now}; else saved={...saved,referrer:saved.referrer||now.referrer,landing_path:saved.landing_path||now.landing_path};
 sessionStorage.setItem(TOUCH_KEY,JSON.stringify(saved));currentTouch=saved;return saved
}
async function recordConsent(c,eventType){
 if(!config?.account_id||!window.cpSupabase)return;
 await window.cpSupabase.rpc('public_record_consent',{p_account_id:config.account_id,p_visitor_id:c.analytics?visitor(true):visitor(false),p_session_id:sid(),p_necessary:true,p_analytics:!!c.analytics,p_marketing:!!c.marketing,p_policy_version:c.policy_version||config.privacy?.policy_version||'1',p_event_type:eventType||'set',p_source:'banner'});
}
function renderPrivacyUI(){
 if(!config?.privacy?.banner_enabled)return;
 const existing=getConsent(),version=String(config.privacy.policy_version||'1');
 let box=document.getElementById('cpPrivacyBanner');
 if(existing&&String(existing.policy_version)===version)return;
 if(box)box.remove();
 box=document.createElement('div');box.id='cpPrivacyBanner';box.className='cp-privacy-banner';
 box.innerHTML=`<div><strong>Privacy choices</strong><p>We use necessary storage to make this site work. With your permission, analytics helps us understand visits and campaign engagement. Marketing tracking is separate.</p>
 <label><input type="checkbox" checked disabled> Necessary</label>
 <label><input type="checkbox" id="cpConsentAnalytics"> Analytics</label>
 <label><input type="checkbox" id="cpConsentMarketing"> Marketing / advertising</label></div>
 <div class="cp-privacy-actions"><button id="cpNecessaryOnly" class="btn secondary small">Necessary only</button><button id="cpSavePrivacy" class="btn small">Save choices</button></div>`;
 document.body.appendChild(box);
 const save=async(a,m)=>{const c={necessary:true,analytics:a,marketing:m,policy_version:version,updated_at:new Date().toISOString()};saveConsent(c);await recordConsent(c,'set');box.remove();if(a&&!tracked&&window.CPAttribution._lastTrack)track(window.CPAttribution._lastTrack)};
 cpNecessaryOnly.onclick=()=>save(false,false);cpSavePrivacy.onclick=()=>save(cpConsentAnalytics.checked,cpConsentMarketing.checked);
}
function openChoices(){
 localStorage.removeItem(CONSENT_KEY);renderPrivacyUI()
}
async function configure(c){config=c||{};storeTouch();renderPrivacyUI();return config}

function likelyBot(){
 const ua=String(navigator.userAgent||'').toLowerCase();
 return navigator.webdriver===true||/(bot|crawler|spider|headless|lighthouse|pagespeed|pingdom|uptimerobot|facebookexternalhit|slurp)/.test(ua);
}
async function track(opts={}){
 window.CPAttribution._lastTrack=opts;
 if(!window.cpSupabase||!config)return null;
 if((config.security?.bot_filtering!==false)&&likelyBot())return {data:null,error:null,filtered:true};
 const consent=getConsent(),mode=config.privacy?.tracking_mode||'standard';
 if(mode==='strict'&&!consent?.analytics)return null;
 const persistent=!!consent?.analytics;
 currentTouch=storeTouch();
 const r=await window.cpSupabase.rpc('public_track_visit',{p_session_id:sid(),p_visitor_id:visitor(persistent),p_website_id:opts.websiteId||null,p_campaign_id:opts.campaignId||null,p_path:location.pathname,p_full_url:location.href,p_referrer:document.referrer||null,p_attribution:currentTouch});
 if(!r.error)tracked=true;return r
}
function context(){
 const consent=getConsent();
 return {visitor_id:visitor(!!consent?.analytics),session_id:sid(),attribution:{...currentTouch},source:currentTouch.utm_source||currentTouch.source||'direct',consent:consent||{necessary:true,analytics:false,marketing:false}}
}
window.CPAttribution={configure,track,context,openChoices,getConsent,get tracked(){return tracked},_lastTrack:null};
})();