# Stage 4C Publishing QA

Database lifecycle tested transactionally as the real authenticated local role:
- Draft → publish v1: PASS
- Editing draft after publish does not alter live snapshot: PASS
- Publish changes → v2: PASS
- Roll back v1 as a new live deployment: PASS
- Rollback does not overwrite the current draft: PASS
- Connected domain resolves the live deployment: PASS
- Unpublish removes public resolution while retaining the draft: PASS
- Anonymous visitors cannot directly read editable Websites/Campaigns/Surveys: PASS
- Public runtime resolves immutable deployment snapshots through a protected RPC.

Existing published Websites/Campaigns were backfilled to public_deployments automatically.
The real Joe Bloggs Website was already Draft before Stage 4C, so it was intentionally not auto-published.

Frontend:
- Website editor publish uses publish_local_entity.
- Campaign editor publish uses publish_local_entity.
- Overview publishing controls support Publish changes / View live / Unpublish / Make live.
- Public Website and Campaign runtimes read live deployment snapshots, not editable records.
- Clean route model displayed as /site/<slug> and /campaign/<slug>.
- GitHub Pages still uses temporary .html query URLs until actual hosting/router work.
