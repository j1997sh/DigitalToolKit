(function(){
'use strict';const sb=window.cpSupabase,form=document.getElementById('stage2SignupForm'),message=document.getElementById('signupMessage'),button=document.getElementById('signupSubmit'),geoStatus=document.getElementById('signupGeoStatus');let geo={};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function lookup(postcode){
 const pc=postcode.trim();if(!pc)throw new Error('Enter a postcode first.');
 const r=await fetch('https://api.postcodes.io/postcodes/'+encodeURIComponent(pc));if(!r.ok)throw new Error('Postcode not found.');
 const j=await r.json(),x=j.result||{},codes=x.codes||{};
 return {ward:x.admin_ward||'',ward_code:codes.admin_ward||'',local_authority:x.admin_district||'',local_authority_code:codes.admin_district||'',parliamentary_constituency:x.parliamentary_constituency||'',parliamentary_constituency_code:codes.parliamentary_constituency||'',region:x.region||'',nation:x.country||'',latitude:x.latitude,longitude:x.longitude};
}
signupLookupPostcode.onclick=async()=>{signupLookupPostcode.disabled=true;signupLookupPostcode.textContent='Looking up…';try{geo=await lookup(signupPostcode.value);signupConstituency.value=geo.parliamentary_constituency;signupWard.value=geo.ward;signupAuthority.value=geo.local_authority;geoStatus.innerHTML=`<div class="geo-resolved">Found: ${esc(geo.parliamentary_constituency||'constituency')} · ${esc(geo.ward||'ward')}</div>`}catch(e){geoStatus.innerHTML=`<div class="state-banner error">${esc(e.message)}</div>`}finally{signupLookupPostcode.disabled=false;signupLookupPostcode.textContent='Look up political geography'}};
form.onsubmit=async e=>{e.preventDefault();message.innerHTML='';button.disabled=true;button.textContent='Creating account…';
 if(!geo.parliamentary_constituency){try{geo=await lookup(signupPostcode.value)}catch(_){}}
 const first=signupFirstName.value.trim(),last=signupLastName.value.trim();
 const data={first_name:first,last_name:last,full_name:[first,last].filter(Boolean).join(' '),account_type:signupAccountType.value,address_line1:signupAddress1.value.trim(),address_line2:signupAddress2.value.trim(),town_city:signupTown.value.trim(),postcode:signupPostcode.value.trim(),represented_ward:signupWard.value.trim()||geo.ward||'',represented_ward_code:geo.ward_code||'',local_authority:signupAuthority.value.trim()||geo.local_authority||'',local_authority_code:geo.local_authority_code||'',parliamentary_constituency:signupConstituency.value.trim()||geo.parliamentary_constituency||'',parliamentary_constituency_code:geo.parliamentary_constituency_code||'',region:geo.region||'',nation:geo.nation||'',latitude:geo.latitude??'',longitude:geo.longitude??''};
 const r=await sb.auth.signUp({email:signupEmail.value.trim(),password:signupPassword.value,options:{data}});
 if(r.error){message.innerHTML=`<div class="state-banner error">${esc(r.error.message)}</div>`;button.disabled=false;button.textContent='Create account';return}
 if(r.data.session){location.href='dashboard.html';return}
 message.innerHTML='<div class="state-banner success">Account created. Check your email to confirm your address, then log in.</div>';button.disabled=false;button.textContent='Create account';
};
})();