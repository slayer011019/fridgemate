# FridgeMate Roadmap

FridgeMate is moving from a local-first MVP toward a deployable open-source reference app for AI-assisted food management.

## Current Milestone: v1.5

Implemented:

- local ingredient CRUD and IndexedDB persistence
- expiration tracking and D-day labels
- pantry-aware recipe recommendations
- OCR import with review-before-save
- correction learning for imports
- optional Express, Prisma, and PostgreSQL backend
- JWT auth and session restore
- manual server backup and pull sync
- first-pass conflict-aware manual sync with persisted pending states and deletion tombstones
- recommendation impression and click event collection
- recommendation training-data export
- complete 1,166-row recipe embedding coverage with no missing or stale vectors
- feature-flagged semantic recipe endpoint with bounded inputs and request limits
- CI, unit tests, and core E2E coverage
- Node.js 24 GitHub Actions with route-level browser code splitting
- Metadata-only API request correlation, latency/error telemetry, and optional AI token/cost metrics

## Near Term

- Keep the public frontend and Cloudflare Worker stable with production smoke tests and rollback notes
- Keep lint, tests, build, and core E2E green in CI
- Preserve the accepted recovered-migration checksum caveat and verify migration status before every future production migration
- Harden auth recovery when sessions expire
- Polish guest import and manual sync messaging
- Improve documentation for first-time contributors

## v2.0

- Validate conflict-aware manual sync against production and multiple real devices
- Add tombstone retention/compaction after all clients have a safe synchronization checkpoint
- Replace device-clock ordering with a server-issued revision or hybrid logical version if manual sync expands further
- Persist pantry staple ownership per authenticated user
- Expand browser E2E coverage
- Add release notes and maintainer automation around recurring workflows

## AI and Data Roadmap

- Analyze recommendation impression/click exports
- Keep all 1,166 production embeddings current and preserve zero missing, duplicate, and orphan rows
- Track vector-only quality separately from final ranking: the current home-meal baseline is 60% raw Hit@5, 95% candidate recall at 100, and 75% reranked Hit@5
- Enable `SEMANTIC_RECIPE_API_ENABLED` only after staging smoke tests confirm the feature-flagged endpoint and rule fallback
- Add a nullable catalog recipe FK to recommendation events after measuring how many historical text IDs can be safely linked; new browser events already use `local:<seed-id>` and `catalog:<uuid>` keys
- Add canonical dishes, aliases, and source-attributed popularity signals after catalog recipe IDs are stable
- Prototype ranking improvements from collected feature snapshots
- Expand ingredient normalization examples
- Improve OCR parser regression coverage
- Explore model-assisted recipe search and personalization

## Non-Goals for Now

- Automatic server writes for every ingredient CRUD action
- Replacing review-before-save OCR with fully automatic imports
- Treating experimental embedding or pgvector work as required for normal app usage
- Treating embedding storage as model training
