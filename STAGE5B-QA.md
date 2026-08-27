# Stage 5B Security / Abuse Protection QA

Database functional QA:
- Public tracking rate limit: PASS.
- Request after configured threshold rejected: PASS.
- Rate-limit threshold event persists for HQ reporting: PASS.
- Duplicate same-path page view within 5 seconds suppressed: PASS.
- Public malformed email validation: PASS.
- Sensitive account/deployment/domain audit events: PASS.
- HQ security readiness returns all organisation accounts: PASS (25).
- Daily retention cron installed and active: PASS (`17 3 * * *`).

Application protections now active:
- per-account/session tracking limits
- per-account/session survey limits
- per-account/session signup/campaign-action limits
- field length and email format validation
- JSON payload size ceilings
- action type allowlists
- duplicate page-view suppression
- obvious crawler/headless analytics filtering
- generic public-facing submission errors
- security audit log
- rate-limit threshold/security events
- automatic daily analytics retention cleanup

CAPTCHA:
- Cloudflare Turnstile is prepared in settings.
- CAPTCHA cannot be enabled until `server_verification=true`.
- No browser-only/fake CAPTCHA is presented as secure.
- Secret-backed token verification remains a production-host/Edge Function task.

Production host controls still required:
- HTTPS/HSTS and certificate automation
- CSP and HTTP security headers
- edge/IP throttling
- secret-backed Turnstile verification
These are documented in SECURITY-HEADERS-STAGE5B.md.
