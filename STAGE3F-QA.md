# Stage 3F stability QA

Local authenticated database QA
- Website create/edit/publish/version: PASS
- Standalone Campaign create/edit/publish/version/delete: PASS
- Survey create/question edit/publish/response: PASS
- Creative save/reopen state including image path: PASS
- Person dedupe across survey + campaign action: PASS
- Person geography/consent/voting intention: PASS
- Domain create/status update: PASS
- Local account isolation: PASS (direct visibility remains one account only)

HQ database QA
- Global Admin membership: PASS
- Organisation overview: PASS
- Local account directory/detail: PASS
- Geography: PASS
- Supporter data: PASS
- Supporter journeys: PASS
- 7/30/90 day performance reporting: PASS
- Geographic performance: PASS
- Account performance: PASS
- Direct local-table isolation while Global Admin: PASS

Frontend cleanup
- Removed seeded Joe/Sarah local database fallback.
- Removed prototype website/public-site/editor/People/survey-library modules from shared app runtime.
- Removed old local new-site creator.
- Replaced static People demo row with loading state.
- Local workspace now uses a minimal synchronous cache populated by Supabase.
