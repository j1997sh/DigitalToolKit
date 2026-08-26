# Stage 5A — Public hosting and domain routing

## Public routes
- `/site/<slug>`
- `/campaign/<slug>`
- A custom connected hostname resolves directly to its assigned Website or standalone Campaign.
- Public routing only resolves immutable live deployments.
- Draft/unpublished targets resolve as 404.

## GitHub Pages test mode
GitHub Pages cannot act as the final multi-tenant custom-domain host. Its 404 fallback is used to test clean `/site/` and `/campaign/` routes while preserving the requested URL in the browser.

`404.html` boots the public router and resolves the route through Supabase.

## Production split
The admin application and the public traffic layer are separate concerns:
- Admin/app origin: authenticated Campaign Platform workspace.
- Public origin: router for campaign Websites/Campaigns/custom domains.
Custom voter-facing domains should point only to the public origin.

## Domains
Connecting `example.org` creates:
- `example.org` as primary
- `www.example.org` as secondary
Both target the same live entity. The secondary hostname redirects to the primary canonical hostname when canonical redirects are enabled.

Ownership verification uses a unique DNS TXT token.
The actual CNAME/ALIAS routing target is intentionally not invented in this build; it is assigned when the production public hosting provider is selected.

## HTTPS
The model tracks `pending`, `provisioning`, `active`, and `error`.
TLS certificate issuance itself belongs to the production edge/hosting provider.

## Canonical URLs
The router returns a canonical URL and redirect target. The browser router sets `<link rel="canonical">`; a production edge should perform the returned 308 redirect before HTML rendering.

## Published assets
Public Website and Campaign renderers create signed URLs for image paths contained in the immutable live deployment. Storage anonymous read policy is limited to assets referenced by live deployments.
