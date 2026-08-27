(async function(){
'use strict';
const sb=window.cpSupabase;const {data:{session}}=await sb.auth.getSession();if(!session)return;
const r=await sb.rpc('local_security_settings');if(r.error)return;
const cfg=r.data||{},sec=cfg.security||{},limits=sec.rate_limits||{},captcha=sec.captcha||{};
const host=document.querySelector('.app-content');if(!host)return;
const panel=document.createElement('section');panel.className='panel security-settings-panel';panel.innerHTML=`
<div class="panel-head"><div><h3>Security & abuse protection</h3><p class="muted">Public rate limits, bot filtering and CAPTCHA readiness.</p></div><button class="btn small" id="saveSecurity">Save</button></div>
<div class="security-settings-grid">
<div>
<h4>Public request limits</h4>
<label class="field"><span>Analytics requests per minute / session</span><input id="trackLimit" type="number" min="20" max="500" value="${Number(limits.tracking_per_minute||120)}"></label>
<label class="field"><span>Signups / campaign actions per hour / session</span><input id="conversionLimit" type="number" min="2" max="50" value="${Number(limits.conversion_per_hour||10)}"></label>
<label class="field"><span>Survey submissions per hour / session</span><input id="surveyLimit" type="number" min="1" max="30" value="${Number(limits.survey_per_hour||6)}"></label>
<label class="toggle-row"><input id="botFiltering" type="checkbox" ${sec.bot_filtering!==false?'checked':''}><span>Filter obvious bot/headless analytics traffic</span></label>
</div>
<div>
<h4>CAPTCHA</h4>
<div class="security-status-box ${captcha.server_verification?'ready':'pending'}"><strong>${captcha.server_verification?'Server verification active':'Awaiting production verifier'}</strong><p>CAPTCHA must be verified server-side. A browser-only checkbox would not provide meaningful protection.</p></div>
<label class="field"><span>Provider</span><select id="captchaProvider"><option value="turnstile">Cloudflare Turnstile</option></select></label>
<label class="field"><span>Public site key</span><input id="captchaSiteKey" value="${String(captcha.site_key||'').replace(/"/g,'&quot;')}" placeholder="Add after production host is configured"></label>
<label class="toggle-row"><input id="captchaEnabled" type="checkbox" ${captcha.enabled?'checked':''} ${captcha.server_verification?'':'disabled'}><span>Require CAPTCHA on public submissions</span></label>
<p class="muted">The enable switch stays locked until a secret-backed server verifier is connected.</p><button class="btn secondary small" id="checkVerifier" type="button">Check production verifier</button><small class="muted" id="verifierResult"></small>
</div></div>
<div class="security-runtime-note"><strong>Already active</strong><span>Database rate limiting, payload size/format validation, action allowlists, duplicate page-view suppression, abuse event logging and security audit logging.</span></div>`;
host.appendChild(panel);
saveSecurity.onclick=async()=>{saveSecurity.disabled=true;saveSecurity.textContent='Saving…';const next={...sec,rate_limits:{tracking_per_minute:Math.max(20,Math.min(500,Number(trackLimit.value)||120)),conversion_per_hour:Math.max(2,Math.min(50,Number(conversionLimit.value)||10)),survey_per_hour:Math.max(1,Math.min(30,Number(surveyLimit.value)||6))},bot_filtering:botFiltering.checked,audit_logging:true,captcha:{...captcha,provider:captchaProvider.value,site_key:captchaSiteKey.value.trim(),enabled:captcha.server_verification?captchaEnabled.checked:false}};const rr=await sb.rpc('local_update_security_settings',{p_security:next});saveSecurity.textContent=rr.error?'Save failed':'Saved';setTimeout(()=>{saveSecurity.disabled=false;saveSecurity.textContent='Save'},1000)};

checkVerifier.onclick=async()=>{
 checkVerifier.disabled=true;verifierResult.textContent='Checking…';
 try{
  const hr=await sb.rpc('local_public_host_config');const base=String(hr.data?.public_url||'').replace(/\/+$/,'');
  if(!base)throw new Error('HQ has not configured the public host yet.');
  const {data:{session}}=await sb.auth.getSession();
  const rr=await fetch(base+'/api/security-status',{method:'POST',headers:{'authorization':'Bearer '+session.access_token}});
  const j=await rr.json();if(!rr.ok)throw new Error(j.error||'Verifier check failed.');
  verifierResult.textContent=j.server_verification?'Server-side Turnstile verification is connected.':'Turnstile secret is not configured on the public host.';
  if(j.server_verification){captchaEnabled.disabled=false}
 }catch(e){verifierResult.textContent=e.message}
 checkVerifier.disabled=false;
};
})();