# FridgeMate

FridgeMate is a local-first fridge and pantry tracker built as a practical portfolio project. It helps users manage ingredients, track expiry dates, reduce food waste, import shopping text with OCR, and find recipe ideas from the food they already have.

## Overview

Current product scope:

- Ingredient CRUD with expiry tracking
- Local-first IndexedDB persistence for guest and authenticated users
- Manual server sync from the account page
- Recipe recommendations with pantry-aware scoring
- OCR import with review-before-save
- Receipt OCR parsing and correction learning
- Shopping panel for consumed ingredients
- JWT-based signup, login, logout, and session restore
- Express + Prisma backend with PostgreSQL storage
- Optional AI recipe suggestions when `ANTHROPIC_API_KEY` is configured

The app is intentionally simple enough for one developer to understand and maintain, while still having clear boundaries between UI, local storage, backend APIs, auth, OCR, and recommendation logic.

For v1 release stabilization, see [docs/V1_STABILIZATION_PLAN.md](docs/V1_STABILIZATION_PLAN.md).
For deployment checks, see [docs/DEPLOY_CHECKLIST.md](docs/DEPLOY_CHECKLIST.md).
For product strategy, see [docs/BUSINESS_ROADMAP.md](docs/BUSINESS_ROADMAP.md).
For KPI instrumentation and event naming, see [docs/ANALYTICS_EVENTS.md](docs/ANALYTICS_EVENTS.md).

## Current Status

FridgeMate is currently being stabilized around a deployable v1 MVP. Larger OCR taxonomy, pgvector, and recipe-ranking expansion work is paused until the v1 auth, sync, CI, and deployment path is solid.

Shipped and working:

- Local ingredient CRUD, expiry tracking, filtering, sorting, and shopping list workflows
- IndexedDB persistence for guest and authenticated local scopes
- Manual account-page ingredient sync to the backend
- JWT auth with cookie-based session restore
- Guest ingredient import after login without automatic server upload
- OCR import with review-before-save
- Dedicated receipt parsing for grocery/mart-style OCR text
- Rule-based recipe recommendations with pantry-aware scoring
- Recipe import and hybrid recommendation backend scaffolding, treated as v2/lab work for deployment planning
- Vitest coverage for date logic, recommendations, import parsing, auth, IndexedDB, and `useIngredients`

Still intentionally limited:

- Server sync is one-way local-to-server replace, not two-way merge
- Cross-device conflict handling is not implemented yet
- Pantry staple ownership is still frontend/local-first oriented
- Production deployment and long-term operations are the current stabilization focus
- Browser E2E coverage exists as scaffolding but is not broad enough to be called complete

## Recent Updates

Recent work focused on making the app more stable for MVP usage:

- Switched ingredient CRUD from automatic API writes to local-first IndexedDB writes
- Added manual "server sync" from the account page for authenticated users
- Added `POST /api/ingredients/sync` to replace the server ingredient list with the local snapshot
- Added sync UI state: dirty, syncing, synced, error, last sync time, and error messages
- Stopped ingredient deletion from calling the server immediately
- Kept guest import separate from server sync so login does not trigger automatic uploads
- Expanded receipt OCR parsing and tests
- Updated docs and changelog to reflect the local-first plus optional backend architecture

## Features

### Ingredient Management

- Add, edit, delete, consume, and restore ingredients
- Track quantity, category, storage type, purchase date, expiry date, and notes
- Search by ingredient name or notes
- Filter by category and storage type
- Sort by expiry date
- Keep a shopping panel for consumed items

### Local-First Storage

- IndexedDB is the day-to-day source of truth on the device
- Guest and authenticated caches are kept in separate IndexedDB scopes
- Ingredient add, edit, consume/restore, and delete actions write locally first
- Server API calls are not made automatically during ingredient CRUD
- Deleted ingredients are removed from the server only after a manual sync

### Manual Ingredient Sync

Authenticated users can sync from the account page.

- The account page shows sync status, unsynced changes, last sync time, and errors
- Pressing the sync button reads the current IndexedDB ingredient list
- The app posts the full local snapshot to `POST /api/ingredients/sync`
- The backend replaces the user's server ingredient list with that local snapshot
- `lastSyncedAt` is stored in `localStorage` under `fridgemate-last-synced-at`

This is a last-write-wins MVP sync strategy. It is deliberately simpler than two-way merge and can later evolve into `updatedAt`-based conflict resolution with delete markers.

### Expiry Awareness

- D-day style expiry labels
- Expiring-soon and expired summaries
- Dashboard preview of ingredients to use first

### Recipe Recommendations

- Rule-based scoring using fridge ingredients, pantry staples, and expiring items
- Optional backend hybrid recommender scaffolding exists, but v1 deployment should rely on the rule-based recommendation path
- Pantry staple support for oil, soy sauce, salt, and similar basics
- Recipe cards show match rate, owned ingredients, missing ingredients, and missing seasonings
- External search links for 10000recipe, YouTube, and Naver instead of storing cooking steps in-app
- Recommendation groups: Ready now, Buy one more, Use soon

### Recipe Import

- Food Safety Korea XML import stores recipe name, category, cooking method, raw ingredient text, tags, and optional nutrition
- Public imports do not store `MANUAL01~20`, `MANUAL_IMG01~20`, or crawled recipe bodies
- Recipe import, embeddings, and LLM normalization are v2/lab capabilities, not v1 release blockers

### OCR Import

- Upload shopping screenshots and review parsed candidates before saving
- Paste OCR text directly when text has already been extracted elsewhere
- Extract text in the browser with Tesseract.js
- Route Coupang, Kurly, receipt, and generic shopping text through separate parsers
- Receipt parsing reconstructs product name, unit price, quantity, total price, and discounts
- Learn user corrections for future imports
- Existing parser rules, aliases, confidence metadata, unit extraction, and duplicate review handling should be preserved during v1 stabilization

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- React Context and custom hooks
- IndexedDB

### Backend

- Express
- Prisma
- PostgreSQL
- JWT auth with `httpOnly` access and refresh cookies
- Redis-backed auth throttling and logout token revocation with memory fallback
- Optional pgvector scaffolding for v2/lab work

### Testing and Tooling

- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier
- GitHub Actions

### OCR and AI

- Tesseract.js
- Anthropic API for optional AI suggestions
- OpenAI-compatible embedding scaffolding for v2/lab work

## Project Structure

```text
fridgemate/
|-- prisma/
|   `-- schema.prisma
|-- server/
|   `-- src/
|       |-- controllers/
|       |-- db/
|       |-- lib/
|       |-- routes/
|       |-- services/
|       |-- app.js
|       |-- config.js
|       `-- index.js
|-- src/
|   |-- api/
|   |-- components/
|   |-- data/
|   |-- db/
|   |-- features/
|   |   |-- auth/
|   |   |-- import/
|   |   |-- ingredients/
|   |   `-- recipes/
|   |-- hooks/
|   |-- pages/
|   |-- test/
|   |-- utils/
|   |-- App.jsx
|   `-- main.jsx
|-- docs/
|-- scripts/
|-- railway.json
|-- vercel.json
`-- package.json
```

## Data Flow

### Ingredient CRUD

```text
UI action
  -> page component
  -> useIngredients hook
  -> IndexedDB save/update/delete
  -> mark syncStatus as dirty
  -> update React state
```

### Manual Server Sync

```text
Account page sync button
  -> syncIngredientsToServer()
  -> read current IndexedDB snapshot
  -> POST /api/ingredients/sync
  -> replace server ingredient list with local list
  -> mark syncStatus as synced or error
```

### Guest Ingredient Import

```text
Login
  -> detect guest IndexedDB ingredients
  -> user chooses guest import
  -> copy guest ingredients into authenticated local scope
  -> user manually syncs later if they want server persistence
```

### Recipe Recommendations

```text
RecipesPage / HomePage
  -> useRecipeRecommendations
  -> local recommendation engine
  -> optional backend recommendation API
  -> pantry staples merged into available ingredients
```

## Authentication and Persistence

FridgeMate supports two clear modes:

- Guest mode
  - IndexedDB is the source of truth
  - no account is required
  - no protected backend calls are made
- Authenticated mode
  - JWT-backed cookies protect the API
  - rotating refresh cookies restore sessions
  - ingredients are scoped by `userId` on the backend
  - IndexedDB remains the active local working copy
  - server persistence happens only through account-page manual sync

Auth hardening notes:

- Signup and login are rate-limited by IP and normalized email
- Email uniqueness is enforced on a normalized database column
- Logout revokes the current access token and refresh session
- The SPA does not store auth tokens in `localStorage`; it keeps only the last known user snapshot for local-first recovery

## Getting Started

### Install

```bash
npm install
```

### Frontend-Only Mode

Set `VITE_API_URL=` in `.env` so the app runs in local-only mode.

```bash
npm run dev
```

Optional frontend error monitoring:

```env
VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

### Frontend + Backend Mode

Set the API URL and database connection in `.env`.

```env
VITE_API_URL=http://localhost:4000/api
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/fridgemate?schema=public
DIRECT_URL=postgresql://USER:PASSWORD@localhost:5432/fridgemate?schema=public
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=replace-this-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
JWT_ISSUER=fridgemate-api
JWT_AUDIENCE=fridgemate-client
ACCESS_TOKEN_COOKIE_NAME=fridgemate_access
REFRESH_TOKEN_COOKIE_NAME=fridgemate_refresh
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=Lax
REDIS_URL=redis://localhost:6379
AUTH_REDIS_PREFIX=fridgemate:auth
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
RECIPE_EMBEDDING_MODEL=text-embedding-3-small
RECIPE_EMBEDDING_DIMENSIONS=1536
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=512
```

For Supabase, use the pooler URL for runtime database traffic and the direct/session URL for Prisma migrations:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

For v1 deployment, leave AI and embedding keys empty unless you are intentionally testing lab features. OCR import still works through the existing browser parser and review flow without pgvector.

Then run:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev:server
```

In another terminal:

```bash
npm run dev
```

### Health Check

```text
http://localhost:4000/health
```

## Tests and Quality

```bash
npm run lint
npm run test:run
npm run build
```

Optional:

```bash
npm run test:coverage
npm run test:e2e
```

Playwright E2E uses two dev-server projects:

- `local-only`: no backend URL, verifies IndexedDB CRUD and OCR review flow
- `api-mode`: relative `/api` base URL with mocked responses, verifies auth, manual sync, and fallback behavior

## Security Notes

- Use a random `JWT_SECRET` of at least 32 bytes.
- Keep `ALLOWED_ORIGINS` tight in production instead of broad wildcards.
- Set `REDIS_URL` to share auth throttling and logout revocation across API instances.
- Keep `AUTH_COOKIE_SECURE=true` in production so auth cookies are sent only over HTTPS.
- Keep API keys out of client-visible environment variables.

## Deployment

1. Add a PostgreSQL database and confirm `DATABASE_URL` is available to the backend service.
2. Set backend environment variables: `JWT_SECRET`, `ALLOWED_ORIGINS`, `CLIENT_ORIGIN`, and optional AI keys.
3. Set frontend environment variables: `VITE_API_URL` and optionally `VITE_SENTRY_DSN`.
4. Run Prisma migrations against the production database.
5. Deploy the backend and frontend.
6. Verify `GET /health`.
7. Smoke test: sign up, log in, add an ingredient, sync from the account page, reload, and load recipe recommendations.

## v2 Expansion Plan

- Add conflict-aware two-way sync using `updatedAt` and delete markers
- Add a server pull/download action so authenticated users can restore server data onto a new device
- Persist pantry staple ownership per user
- Harden auth recovery UX around expired sessions and offline fallback
- Revisit pgvector-backed recipe and OCR correction suggestions after v1 is deployed
- Expand recipe recommendation ranking and recipe catalog seeding
- Harden OCR taxonomy/classifier behavior without replacing the existing parser abruptly
- Expand Playwright coverage beyond the core journeys
- Move shared recipe data and normalization logic into a dedicated shared module if the backend becomes permanent
