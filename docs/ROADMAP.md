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
- CI, unit tests, and core E2E coverage

## Near Term

- Deploy frontend and backend to stable public environments
- Keep lint, tests, build, and core E2E green in CI
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
- Keep the ingredient-first embedding text at or above the current 9/10 Hit@5 result while expanding the fixture beyond UUID-order smoke coverage
- Review and execute the checkpointed limited `recipe_embeddings` backfill now that the in-memory 7/10 release gate is satisfied; full replacement remains blocked on stored-vector integrity and smoke checks
- Keep semantic API publication separate from the backfill and require stored-vector quality verification first
- Normalize recommendation event keys into `local:<seed-id>` and `catalog:<uuid>` with a nullable catalog recipe FK
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
