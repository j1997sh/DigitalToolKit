(function(){
'use strict';
let turnstilePromise=null;
function captchaConfig(compliance){return compliance?.security?.captcha||{}}
function active(compliance){
 const c=captchaConfig(compliance);
 return !!(c.enabled&&c.server_verification&&c.site_key);
}
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(turnstilePromise)return turnstilePromise;
 turnstilePromise=new Promise((resolve,reject)=>{
   window.cpTurnstileLoaded=()=>resolve(window.turnstile);
   const s=document.createElement('script');
   s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=cpTurnstileLoaded&render=explicit';
   s.async=true;s.defer=true;s.onerror=()=>reject(new Error('Verification could not load.'));
   document.head.appendChild(s);
 });
 return turnstilePromise;
}
async function prepare(form,compliance){
 if(!form||!active(compliance))return;
 const c=captchaConfig(compliance);
 let box=form.querySelector('[data-cp-turnstile]');
 if(!box){
   box=document.createElement('div');
   box.dataset.cpTurnstile='1';
   box.className='cp-turnstile-wrap';
   const btn=form.querySelector('button[type="submit"]');
   if(btn)btn.before(box);else form.appendChild(box);
 }
 if(box.dataset.widgetId)return;
 const ts=await loadTurnstile();
 const id=ts.render(box,{sitekey:c.site_key,theme:'auto'});
 box.dataset.widgetId=String(id);
}
function token(form){
 return form?.querySelector('input[name="cf-turnstile-response"]')?.value||'';
}
function reset(form){
 const box=form?.querySelector('[data-cp-turnstile]');
 if(box?.dataset.widgetId&&window.turnstile){
   try{window.turnstile.reset(Number(box.dataset.widgetId))}catch(_){}
 }
}
async function rpc(name,params,form,compliance){
 const body={rpc:name,params:params||{},turnstile_token:token(form)};
 const r=await fetch('/api/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});
 let data={};
 try{data=await r.json()}catch(_){}
 if(!r.ok)return {data:null,error:{message:data?.error||'Request failed',status:r.status}};
 return {data:data?.data??null,error:null}
}
window.CPPublicSubmit={prepare,rpc,reset,active};
})();