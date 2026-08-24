# FridgeMate

FridgeMate is an open-source AI-powered refrigerator management app that helps users track ingredients, reduce food waste, and generate recipe suggestions based on available ingredients and expiration dates.

It also serves as a practical reference project for students and junior developers building local-first, AI-assisted food management applications with React, Express, Prisma, PostgreSQL, OCR, and recommendation workflows.

Live demo: https://오늘뭐먹지.com/

## Problem Statement

People often forget what is already in the fridge, miss expiration dates, buy duplicate ingredients, or struggle to decide what to cook before food goes bad. FridgeMate focuses on a practical daily workflow:

- register ingredients quickly
- keep expiration dates visible
- prioritize ingredients that should be used soon
- suggest recipes from available fridge and pantry items
- reduce manual input with OCR-based import and correction learning

## Key Features

Implemented:

- Ingredient CRUD with quantity, category, storage type, purchase date, expiration date, and notes
- D-day style expiration labels, expiring-soon summaries, and expired item visibility
- Local-first IndexedDB persistence for guest and authenticated scopes
- Shopping panel for consumed ingredients and buy-again workflows
- Pantry staple ownership controls for common seasonings and sauces
- Rule-based recipe recommendation groups: ready now, buy one more, and use soon
- OCR import with review-before-save and correction learning
- JWT signup, login, logout, refresh-cookie session restore, and protected routes
- Optional Express API on Node or Cloudflare Workers with Prisma + PostgreSQL
- Recipe catalog imports are restricted to trusted local/CI seeding scripts and are not exposed as user-facing API routes
- Manual server backup and pull sync from the account page
- API fallback behavior that keeps local IndexedDB usable during network or 5xx failures
- Bounded, rate-limited recommendation impression and click event persistence in backend-connected mode
- Public service, contact, privacy, crawler, and sitemap pages for production site transparency
- Recommendation training-data export script for future ranking experiments
- Vitest, React Testing Library, Playwright, ESLint, and GitHub Actions CI

Planned or experimental:

- Conflict-aware two-way sync across devices
- Production operations hardening for hosted frontend/backend deployments
- Broader browser/device E2E coverage
- User-level pantry staple persistence
- Stronger auth recovery UX for expired sessions and offline fallback
- ML-assisted recommendation ranking using collected recommendation events
- Expanded recipe embeddings and pgvector-backed search

## AI Features

FridgeMate uses AI-adjacent and optional AI workflows without making the core app dependent on a paid API key.

Implemented:

- Browser OCR with Tesseract.js for shopping screenshots and receipt-style text
- Ingredient normalization and correction learning for repeated import edits
- Expiration-date aware recommendation scoring that boosts recipes using ingredients that should be consumed soon
- Optional backend AI recipe suggestions when `ANTHROPIC_API_KEY` is configured
- Recommendation event collection for impressions and clicks so future ranking models can learn from real usage
- Training-data export to JSONL or CSV for future model experiments
- Recipe embedding groundwork for future pgvector candidate search

Experimental or planned:

- OpenAI-compatible embedding support for OCR correction suggestions and recipe catalog ranking
- Model-assisted recipe ingredient normalization
- Maintainer automation for issue triage, code review assistance, release note drafting, and documentation updates

See [docs/AI_FEATURES.md](docs/AI_FEATURES.md) for details.

## Current Implementation Status

FridgeMate is in the v1.5 milestone. The app is usable in local-only mode and has an optional backend mode, but production operations and full two-way sync are still being hardened.

Current boundaries:

- Local-only mode is the safest default for everyday CRUD.
- Backend mode is enabled by `VITE_API_URL`.
- Ingredient CRUD writes locally first.
- Authenticated users can manually back up the local snapshot to the server or pull the server snapshot into the local device cache.
- Network failures and 5xx API failures fall back to IndexedDB.
- 4xx API errors should surface to the UI instead of being silently swallowed.
- AI recipe suggestions are optional and require `ANTHROPIC_API_KEY`.
- Embedding and pgvector work is treated as lab/v2 infrastructure unless explicitly wired into a user-facing flow.

## Tech Stack

Frontend:

- React
- Vite
- JavaScript
- Tailwind CSS
- React Context and custom hooks
- IndexedDB

Backend:

- Express
- Prisma
- PostgreSQL
- JWT auth with `httpOnly` access cookies, atomic single-use refresh-token rotation, and server-side CSRF origin verification
- Atomic Redis-backed auth throttling for production Node and SQLite Durable Object throttling for Workers; KV stores Worker token revocations
- Tenant-scoped ingredient reads, updates, and deletes always include the authenticated user ID in database conditions
- PostgreSQL RLS binds ingredient/OCR rows to the authenticated user, account lookup to the submitted normalized email, and refresh sessions to the presented token hash when the API uses the dedicated non-bypass database role

AI, OCR, and data:

- Tesseract.js
- Optional Anthropic API recipe suggestions
- OpenAI-compatible embedding scaffolding
- Recommendation event export for future model training

Testing and tooling:

- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier
- GitHub Actions

## Architecture Overview

FridgeMate keeps the browser database as the day-to-day working copy and treats the backend as an optional authenticated persistence layer.

```text
React UI
  -> page components
  -> hooks and API clients
  -> IndexedDB local cache
  -> optional Express API when VITE_API_URL is configured
  -> Prisma
  -> PostgreSQL
```

Ingredient CRUD:

```text
UI action
  -> useIngredients
  -> IndexedDB save/update/delete
  -> mark local sync status as dirty
  -> update React state
```

Manual sync:

```text
Account backup
  -> read local IndexedDB snapshot
  -> POST /api/ingredients/sync
  -> backend upserts by clientId and removes missing remote rows

Account pull
  -> GET /api/ingredients
  -> replace the authenticated local cache
```

Recommendation events:

```text
RecipesPage
  -> RecommendationRow
  -> impression/click event
  -> /api/recommendation-events
  -> RecommendationEvent table
  -> export:recommendation-training script
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deeper overview.

## Getting Started

Install dependencies:

```bash
npm install
```

Create an environment file:

```bash
cp .env.example .env
```

Run frontend-only local mode:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Environment Variables

Important variables are documented in [.env.example](.env.example) and [server/.env.example](server/.env.example). Use placeholder values locally and never commit real secrets.

Common frontend variables:

```env
VITE_API_URL=
VITE_API_BASE_URL=
VITE_ENABLE_OCR=true
VITE_SENTRY_DSN=
VITE_ADSENSE_ENABLED=false
VITE_ADSENSE_CLIENT=
VITE_ADSENSE_HOME_SLOT=
VITE_ADSENSE_RECIPES_SLOT=
```

Common backend variables:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/fridgemate?schema=public
DIRECT_URL=postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/fridgemate?schema=public
JWT_SECRET=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
RECIPE_EMBEDDING_MODEL=text-embedding-3-small
RECIPE_EMBEDDING_DIMENSIONS=1536
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FOODSAFETY_API_KEY=
```

Rules:

- Keep `JWT_SECRET` strong and private.
- Keep all service role keys server-side only.
- Do not expose private keys with a `VITE_` prefix.
- Leave optional AI keys empty when testing the core app.
- Keep `RECIPE_EMBEDDING_DIMENSIONS` aligned with the `recipe_embeddings.embedding` vector dimension.

Cloudflare Workers deployment is documented in [docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md). AdSense activation and `ads.txt` generation are documented in [docs/ADSENSE_SETUP.md](docs/ADSENSE_SETUP.md).

## Database / Prisma Setup

Validate the Prisma schema:

```bash
npm run prisma:validate
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Create or apply local migrations:

```bash
npm run prisma:migrate
```

Production deploys should use:

```bash
npm run prisma:deploy
```

## Running Frontend and Backend

Backend mode:

```bash
npm run dev:server
```

In another terminal:

```bash
npm run dev
```

Health check:

```text
http://localhost:4000/health
http://localhost:4000/api/health
```

## Testing

Core checks:

```bash
npm run lint
npm run test:run
npm run build
```

Optional checks:

```bash
npm run test:coverage
npm run test:e2e
npx prisma validate
```

Playwright projects cover local-only CRUD/OCR journeys and mocked API-mode auth, sync, deletion, fallback, and expired-session flows.

## Project Structure

```text
fridgemate/
|-- .github/
|   |-- ISSUE_TEMPLATE/
|   |-- pull_request_template.md
|   `-- workflows/
|-- docs/
|-- e2e/
|-- prisma/
|   |-- migrations/
|   `-- schema.prisma
|-- scripts/
|-- server/
|   `-- src/
|       |-- controllers/
|       |-- db/
|       |-- lib/
|       |-- middleware/
|       |-- routes/
|       `-- services/
|-- src/
|   |-- api/
|   |-- components/
|   |-- data/
|   |-- db/
|   |-- hooks/
|   |-- pages/
|   |-- test/
|   `-- utils/
|-- .env.example
|-- package.json
`-- README.md
```

## Recommendation Event Export

Backend-connected recommendation rows store impression and click events when the API is available. The event table captures ranking-oriented feature snapshots such as rank, score, match rate, missing ingredient count, urgent match count, source, and click labels.

Export JSONL:

```bash
npm run export:recommendation-training -- --format=jsonl --output=data/training/recommendation-training.jsonl
```

Export CSV:

```bash
npm run export:recommendation-training -- --format=csv --output=data/training/recommendation-training.csv
```

This export is intended for offline analysis and future model-ranking experiments. It is not required for normal app usage.

## Recipe Embedding Groundwork

Recipe embeddings are stored vectors for semantic candidate retrieval; storing them is not model training. The first safe step uses a separate production-compatible `recipe_embeddings` table keyed to the existing Supabase-shaped `recipes.id` UUID, leaving the production `recipes` table unchanged.

Dry-run the embedding text and content hash pipeline:

```bash
npm run recipes:embed -- --dry-run --limit=10
```

Semantic retrieval should use pgvector to fetch candidates, then rule-based reranking should prioritize owned ingredients, expiring ingredients, and low missing-ingredient counts. Ranking model training is future work and requires enough recommendation event history.

## Roadmap

Near term:

- Deploy frontend and backend to stable public environments
- Keep CI green across lint, unit tests, build, and core E2E
- Harden auth recovery, guest import, and offline fallback UX
- Document production smoke checks and release notes consistently

Next:

- Implement conflict-aware two-way sync uploads and delete resolution
- Persist pantry ownership per authenticated user
- Expand recommendation event analysis and ranking experiments
- Broaden Playwright coverage across browsers and important devices

Longer term:

- Use AI-assisted maintainership workflows for issue triage, code review assistance, and release note generation
- Improve OCR taxonomy and normalization without removing the review-before-save safety step
- Explore model-assisted recipe search, ingredient matching, and personalization

See [docs/ROADMAP.md](docs/ROADMAP.md).

## Why Open Source

FridgeMate is open source so students and junior developers can study a realistic, compact application that combines:

- local-first frontend architecture
- optional backend persistence
- auth and session restore
- OCR import with human review
- recommendation scoring
- AI/API integration boundaries
- CI, tests, deployment notes, and contributor workflows

The goal is not to present a perfect production system. The goal is to show readable tradeoffs and a maintainable path from MVP to deployable full-stack app.

## Maintainer

Maintained by the FridgeMate project maintainer and contributors.

Maintainer workflow priorities:

- keep issues reproducible
- keep PRs small enough to review
- protect secrets and user data
- require tests or verification notes for behavior changes
- use automation where it improves triage, review, and release documentation

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), then open an issue or pull request using the GitHub templates.

Good first contribution areas:

- documentation improvements
- test coverage for existing behavior
- accessibility and responsive UI fixes
- OCR parser examples and regression cases
- recipe recommendation scoring explanations

## License

FridgeMate is released under the [MIT License](LICENSE).
