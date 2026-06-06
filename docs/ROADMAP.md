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

- Implement conflict-aware two-way sync uploads
- Add delete conflict handling with tombstones or equivalent server state
- Persist pantry staple ownership per authenticated user
- Expand browser E2E coverage
- Add release notes and maintainer automation around recurring workflows

## AI and Data Roadmap

- Analyze recommendation impression/click exports
- Prototype ranking improvements from collected feature snapshots
- Expand ingredient normalization examples
- Improve OCR parser regression coverage
- Explore model-assisted recipe search and personalization

## Non-Goals for Now

- Automatic server writes for every ingredient CRUD action
- Replacing review-before-save OCR with fully automatic imports
- Treating experimental embedding or pgvector work as required for normal app usage
