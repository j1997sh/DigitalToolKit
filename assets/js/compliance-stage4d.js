(async function(){
'use strict';const sb=window.cpSupabase;const {data:{session}}=await sb.auth.getSession();if(!session)return;
const r=await sb.rpc('local_compliance_settings');if(r.error)return;
const cfg=r.data||{},privacy=cfg.privacy||{},imprint=cfg.imprint||{};
const host=document.querySelector('.app-content');if(!host)return;
const card=document.createElement('section');card.className='panel compliance-settings-card';card.innerHTML=`
<div class="panel-head"><div><h3>Privacy, tracking & imprint</h3><p class="muted">Controls for public Websites and standalone Campaigns.</p></div><button class="btn small" id="saveCompliance">Save</button></div>
<div class="compliance-grid">
<div>
<h4>Tracking</h4>
<label class="field"><span>Tracking mode</span><select id="privacyMode"><option value="strict">Strict</option><option value="standard">Standard</option><option value="full">Full</option></select></label>
<label class="field"><span>Analytics retention</span><select id="retentionDays"><option value="90">90 days</option><option value="180">180 days</option><option value="365">365 days</option><option value="730">2 years</option></select></label>
<label class="toggle-row"><input id="privacyBanner" type="checkbox"><span>Show privacy choices banner</span></label>
<label class="field"><span>Privacy policy version</span><input id="privacyVersion"></label>
<label class="field"><span>Privacy URL</span><input id="privacyUrl"></label>
<button class="btn secondary small" id="runRetention">Run retention cleanup now</button><small class="muted" id="retentionResult"></small>
</div>
<div>
<h4>Political imprint</h4>
<label class="toggle-row"><input id="imprintEnabled" type="checkbox"><span>Show imprint on public pages</span></label>
<label class="field"><span>Full imprint text</span><textarea id="imprintText" placeholder="Enter the exact imprint text required for this campaign."></textarea></label>
<p class="muted">Or store the component parts below. Full imprint text takes precedence.</p>
<label class="field"><span>Promoter name</span><input id="promoterName"></label>
<label class="field"><span>Promoter address</span><input id="promoterAddress"></label>
<label class="field"><span>Publisher name</span><input id="publisherName"></label>
<label class="field"><span>Publisher address</span><input id="publisherAddress"></label>
</div></div>`;
host.appendChild(card);
privacyMode.value=privacy.tracking_mode||'standard';retentionDays.value=String(privacy.analytics_retention_days||180);privacyBanner.checked=privacy.banner_enabled!==false;privacyVersion.value=privacy.policy_version||'1';privacyUrl.value=privacy.privacy_url||'/privacy';
imprintEnabled.checked=imprint.enabled!==false;imprintText.value=imprint.text||'';promoterName.value=imprint.promoter_name||'';promoterAddress.value=imprint.promoter_address||'';publisherName.value=imprint.publisher_name||'';publisherAddress.value=imprint.publisher_address||'';
saveCompliance.onclick=async()=>{saveCompliance.disabled=true;saveCompliance.textContent='Saving…';const rr=await sb.rpc('local_update_compliance_settings',{p_privacy:{...privacy,tracking_mode:privacyMode.value,analytics_retention_days:Number(retentionDays.value),banner_enabled:privacyBanner.checked,policy_version:privacyVersion.value||'1',privacy_url:privacyUrl.value||'/privacy'},p_imprint:{enabled:imprintEnabled.checked,text:imprintText.value.trim(),promoter_name:promoterName.value.trim(),promoter_address:promoterAddress.value.trim(),publisher_name:publisherName.value.trim(),publisher_address:publisherAddress.value.trim()}});saveCompliance.textContent=rr.error?'Save failed':'Saved';setTimeout(()=>{saveCompliance.disabled=false;saveCompliance.textContent='Save'},1000)};
runRetention.onclick=async()=>{runRetention.disabled=true;retentionResult.textContent='Running…';const rr=await sb.rpc('run_local_retention_cleanup');retentionResult.textContent=rr.error?rr.error.message:`Deleted ${rr.data?.page_views_deleted||0} old page views and ${rr.data?.sessions_deleted||0} old sessions.`;runRetention.disabled=false};
})();