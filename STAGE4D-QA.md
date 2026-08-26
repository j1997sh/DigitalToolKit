# Stage 4D Privacy / Consent / Imprint QA

Database QA:
- Anonymous public privacy configuration: PASS
- Anonymous consent-event recording: PASS
- Local owner compliance settings update: PASS
- HQ privacy summary: PASS (25 organisation accounts)
- Retention cleanup is owner-scoped.

Tracking behavior:
- Strict mode blocks analytics tracking until analytics consent.
- Standard/full can use session-only analytics before persistent consent.
- Persistent visitor ID is used only when analytics consent is present.
- Marketing click IDs and detailed content/term attribution are stripped without marketing consent.
- Consent choices include necessary, analytics and marketing.
- Visitor can reopen Privacy choices.
- Consent event stores policy version and timestamp.

Imprint:
- Local Settings includes full imprint text and structured promoter/publisher fields.
- Full text takes precedence.
- Imprint can be enabled/disabled.
- Public Website and standalone Campaign include the configured imprint in the footer.
- HQ can see whether each local account has complete/missing imprint configuration.

Retention:
- Configurable 90/180/365/730-day analytics retention.
- Local cleanup deletes expired page views and sessions and detaches stale session references safely.
- Automatic scheduled execution is intentionally deferred until the hosting/scheduler layer; users can run cleanup immediately from Settings now.
