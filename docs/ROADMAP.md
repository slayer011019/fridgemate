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
- Node.js 24 GitHub Actions with route-level browser code splitting
- Metadata-only API request correlation, latency/error telemetry, and optional AI token/cost metrics

## Near Term

- Deploy frontend and backend to stable public environments
- Keep lint, tests, build, and core E2E green in CI
- Review the two recovered migration checksum differences before applying the pending ingredient tombstone migration
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
- Keep the ingredient-first embedding text at or above the stored-vector Hit@5 `10/10` result while expanding the fixture beyond UUID-order smoke coverage
- Continue from the verified third 25-row missing batch at `recipes=1,166`, `embeddings=1,078`, `current=95`, `missing=88`, and `stale=983`; each further batch remains separately approved and capped, while the fixed ten-query stored-vector gate remains Hit@1 `9/10` and Hit@5 `10/10`
- Run the separate 20-recipe Korean home-meal fixture after full vector coverage; it uses realistic pantry subsets, expiring ingredients, alias cases, and a 70% Hit@5 gate without replacing the UUID regression fixture
- Keep semantic API publication separate from the backfill and require complete coverage, integrity verification, and a final stored-vector quality rerun first
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
