window.CP_STAGE2 = {
  url: "https://nfbokxuyprzllgsocgyt.supabase.co",
  publishableKey: "sb_publishable_z6gtM0U8i4WtzNf89vlHFg_0r6Qn0Oh"
};
window.cpSupabase = window.supabase.createClient(
  window.CP_STAGE2.url,
  window.CP_STAGE2.publishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);


/* Stage 8D: shared local Home navigation */
(function(){
  function addHomeNav(){
    document.querySelectorAll('.app-sidebar .side-nav').forEach(nav=>{
      if(nav.querySelector('a[href="home.html"]'))return;
      const a=document.createElement('a');a.href='home.html';a.textContent='Home';
      const dash=nav.querySelector('a[href="dashboard.html"]');
      if(dash)nav.insertBefore(a,dash);else nav.prepend(a);
      const file=location.pathname.split('/').pop()||'home.html';
      if(file==='home.html'){nav.querySelectorAll('a').forEach(x=>x.classList.remove('active'));a.classList.add('active')}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addHomeNav);else addHomeNav();
})();
