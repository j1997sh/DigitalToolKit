(async()=>{
 const sb=window.cpSupabase,qs=new URLSearchParams(location.search),token=qs.get('token')||'',email=qs.get('email')||'';
 const message=(t,e=false)=>activationMessage.innerHTML=`<div class="state-banner ${e?'error':'success'}">${t}</div>`;
 activationEmail.value=email;activationSigninEmail.value=email;
 async function claim(){const r=await sb.rpc('claim_rollout_account',{p_token:token});if(r.error){message(r.error.message,true);return false}message('Campaign workspace activated. Opening your dashboard…');setTimeout(()=>location.href='dashboard.html',900);return true}
 const {data:{session}}=await sb.auth.getSession();if(session&&token){await claim();return}
 activationSignup.onsubmit=async e=>{e.preventDefault();if(!token)return message('Activation token is missing.',true);activationCreate.disabled=true;activationCreate.textContent='Creating…';const r=await sb.auth.signUp({email:activationEmail.value.trim(),password:activationPassword.value});activationCreate.disabled=false;activationCreate.textContent='Create login and activate';if(r.error)return message(r.error.message,true);if(r.data.session)await claim();else message('Check your email to confirm your login, then reopen this activation link.')};
 activationSignin.onsubmit=async e=>{e.preventDefault();if(!token)return message('Activation token is missing.',true);const r=await sb.auth.signInWithPassword({email:activationSigninEmail.value.trim(),password:activationSigninPassword.value});if(r.error)return message(r.error.message,true);await claim()};
})();