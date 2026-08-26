# Stage 4A QA

## Local runtime carried forward
- Stage 3F `db is not defined` regression removed.
- Creative image upload path uses corrected live Storage RLS.
- Creative image upload autosaves the resulting image path.
- Local account RLS remains owner-scoped.

## Attribution
- Anonymous visitor ID persists in localStorage.
- Session ID persists for the browser session in sessionStorage.
- Page views are recorded through `public_track_visit`.
- UTM source / medium / campaign / content / term, source, referrer and click IDs are captured.
- Survey, Website action, Campaign back and volunteer conversions carry session + attribution.
- Anonymous visitor sessions are linked to the resulting Person at conversion.
- First touch is taken from the earliest recorded visitor session.
- Last touch is taken from the converting session.

## Database transactional QA
- First session: Facebook / paid_social / roads.
- Second session: email / newsletter / followup.
- Survey conversion on second session.
- PASS: Person first touch = Facebook / roads.
- PASS: Person last touch = email / followup.
- PASS: both sessions linked to the Person.
- PASS: Survey Response carries converting session + email attribution.
- PASS: Supporter Action carries converting session + email attribution.
- PASS: HQ source/campaign session and conversion reporting works.

No IP address is stored by Campaign Platform.
