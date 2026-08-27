# Stage 5B production HTTP security policy

These are host-level controls and should be enabled on the production public host, not simulated with GitHub Pages:

- HTTPS only with HTTP -> HTTPS redirect
- Strict-Transport-Security after custom-domain certificate provisioning is stable
- Content-Security-Policy allowing only the Campaign Platform origin, Supabase API/storage, postcodes.io, configured CAPTCHA provider, and explicitly configured analytics/advertising providers
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy denying unnecessary browser features
- frame-ancestors / X-Frame-Options protection for admin application
- no-store/private caching for authenticated admin pages
- CDN/edge request throttling ahead of public submission endpoints

Application-side protections already implemented:
- per-account/session tracking and conversion rate limits
- public payload validation and size ceilings
- public action allowlists
- duplicate page-view suppression
- obvious bot/headless analytics filtering
- abuse-event logging
- sensitive admin audit logging
- daily automated retention cleanup
- immutable live public deployment snapshots
- no application analytics IP storage

CAPTCHA:
Cloudflare Turnstile is the prepared provider. Do not enable it until the production verifier holds the secret server-side and verifies tokens before public RPC execution.
