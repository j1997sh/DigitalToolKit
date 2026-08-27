# Campaign Platform public host — Cloudflare Pages

Deploy THIS `public-host` directory as its own Cloudflare Pages project. Do not deploy the admin application to this project.

Build settings
- Framework preset: None
- Build command: leave blank
- Build output directory: `/`
- Root directory: `public-host`

Environment variables / secrets
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `TURNSTILE_SECRET_KEY` (secret)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`
- `CLOUDFLARE_API_TOKEN` (secret, Pages Write permission) — only required for automated custom-domain provisioning
- `ADMIN_ORIGIN` — exact HTTPS origin of the separate Campaign Platform admin app

Routes
- `/site/<slug>` internally rewrites to the Website public shell.
- `/campaign/<slug>` internally rewrites to the standalone Campaign shell.
- `/` resolves by custom hostname, so a connected candidate domain serves its assigned live deployment.
- Unknown/unpublished content shows a public not-found state.

Turnstile
1. Create a Turnstile widget in Cloudflare.
2. Put the public site key in Campaign Platform > Settings > Security.
3. Put the secret in the Pages secret `TURNSTILE_SECRET_KEY`.
4. POST to `/api/security-status` while authenticated to confirm the verifier. The database will then allow CAPTCHA to be enabled.
5. Public forms are submitted through `/api/submit`; when CAPTCHA is enabled, the Pages Function validates the token with Cloudflare Siteverify before calling the allowlisted Supabase RPC.

Custom domains
`/api/domain-provision` can add an authenticated local account's saved domain to the Cloudflare Pages project using the Pages API when the Cloudflare API environment variables are configured. The registrar still owns/renews the domain.

Security
`_headers` adds CSP, clickjacking, MIME-sniffing, referrer and browser-permission restrictions to static responses. API Functions return no-store responses. Database-level rate limits and validation from Stage 5B remain authoritative.

`/api/domain-status` reads the Pages custom-domain API and, once Cloudflare reports the domain `active`, marks routing and HTTPS active in Campaign Platform.
