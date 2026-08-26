Campaign Platform — Stage 3B real integrations

This build replaces the fake integration screens with a real Supabase-backed sync layer.

Implemented
- NationBuilder credential verification through a JWT-protected Edge Function
- NationBuilder People push/upsert and tag sync
- optional NationBuilder voting-intention custom-field mapping
- Mailchimp credential + audience verification through a JWT-protected Edge Function
- Mailchimp opted-in contact upsert and separate contact-tag sync
- server-only integration_secrets table; tokens are not readable from the browser
- automatic supporter-action sync queue
- manual full People sync
- retryable failed jobs
- integration sync logs
- external provider IDs persisted on People
- automatic-sync action filters
- connect / disconnect state backed by Supabase
- VoteSource adapter slot intentionally held until the provider API specification is available

Production OAuth
NationBuilder and Mailchimp should ultimately use their OAuth flows. The server-side sync engine is already separated from the browser, so OAuth token acquisition/refresh can be added once the production hosting/callback URL is decided.

No provider access tokens are included in this repository.
