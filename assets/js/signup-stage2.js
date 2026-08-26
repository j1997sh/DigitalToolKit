(function(){
  'use strict';
  const sb=window.cpSupabase;
  const form=document.getElementById('stage2SignupForm');
  const message=document.getElementById('signupMessage');
  const button=document.getElementById('signupSubmit');

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    message.innerHTML='';
    const first=document.getElementById('signupFirstName').value.trim();
    const last=document.getElementById('signupLastName').value.trim();
    const email=document.getElementById('signupEmail').value.trim();
    const password=document.getElementById('signupPassword').value;

    button.disabled=true;button.textContent='Creating account…';
    const {data,error}=await sb.auth.signUp({
      email,password,
      options:{data:{first_name:first,last_name:last,full_name:[first,last].filter(Boolean).join(' ')}}
    });

    if(error){
      message.innerHTML=`<div class="state-banner error">${error.message}</div>`;
      button.disabled=false;button.textContent='Create account';return;
    }

    if(data.session){
      location.href='dashboard.html';
      return;
    }

    message.innerHTML='<div class="state-banner success">Account created. Check your email to confirm your address, then log in.</div>';
    button.disabled=false;button.textContent='Create account';
  });
})();