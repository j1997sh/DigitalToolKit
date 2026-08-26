# Stage 5A Hosting / Domain Routing QA

Database transactional QA passed:
- Clean `/site/<slug>` route resolves a live Website deployment.
- Clean `/campaign/<slug>` route resolves a live standalone Campaign deployment.
- Connected custom domain resolves the correct immutable deployment.
- Non-primary `www` hostname returns a 308 redirect target to the primary canonical hostname.
- Missing public route returns 404.
- Admin paths are not handled by the public router.
- Unpublishing a Website makes both clean path and custom-domain resolution return 404.

Domain lifecycle:
- Unique TXT ownership verification is generated per domain.
- Ownership verification and routing verification are separate states.
- Primary domain can be selected per Website/Campaign target.
- HTTPS state is modeled independently (`pending`, `provisioning`, `active`, `error`).
- Final CNAME/A routing target is intentionally not fabricated until a production public host is chosen.

GitHub Pages testing:
- `404.html` acts as a project-path-aware clean-route fallback.
- It preserves `/site/<slug>` or `/campaign/<slug>` in the address bar and loads the correct public renderer.
- Production should use a host with real rewrite/redirect support so 200/308/404 are returned at the HTTP layer.

Public/admin isolation:
- Public router has no admin route.
- Public renderers receive immutable live deployment snapshots.
- Local/admin app remains a separate application surface.


## Final frontend compatibility
- Domain UI uses the Stage 5A owner-scoped RPCs deployed in Supabase.
- Connecting a root domain creates root + www as a pair.
- TXT verification uses DNS-over-HTTPS and updates both entries.
- Primary/canonical controls are wired to the live backend.
- GitHub Pages 404 fallback establishes the repository root as the base URL, then renders the clean public route without changing the browser URL.
