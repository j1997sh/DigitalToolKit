# Stage 5A Public Hosting / Routing

Public traffic:
- `/site/<slug>` -> public Website renderer
- `/campaign/<slug>` -> standalone Campaign renderer
- connected custom hostname -> domain target -> immutable live deployment
- non-primary connected hostname can return a canonical redirect
- unpublished/missing targets return a public 404 state
- canonical URL is written to `<link rel=canonical>`

GitHub Pages test behavior:
- `404.html` is intentionally a clean-route fallback because project Pages has no server rewrite layer.
- It preserves the requested URL and loads the correct public renderer for `/site/` or `/campaign/`.
- This is for testing only. A production edge/static host should rewrite those routes directly to the public app entrypoint with HTTP 200/308/404 responses.

Domain lifecycle:
- Domain remains purchased/renewed at the user's registrar.
- Campaign Platform issues a unique TXT ownership-verification record.
- Ownership verification and routing verification are separate states.
- The final CNAME/A/ALIAS routing target is deliberately not fabricated before the production public host is selected.
- `ssl_status` is ready for host certificate provisioning.

Isolation:
- admin/local workspace pages are not part of the public router.
- public renderers receive only immutable deployment snapshots through SECURITY DEFINER resolver RPCs.
