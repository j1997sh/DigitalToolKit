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
