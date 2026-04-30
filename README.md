# FridgeMate

FridgeMate is a local-first fridge and pantry tracker built as a portfolio project.
It helps users manage ingredients, track expiry dates, reduce food waste, and get recipe suggestions based on what they already have.

## Overview

Current product scope:

- Ingredient CRUD with expiry tracking
- Recipe recommendations with pantry-aware scoring
- OCR-based ingredient import from shopping screenshots
- Guest mode with local-first IndexedDB persistence
- Authenticated mode with JWT-based login and user-scoped server persistence
- Express + Prisma backend with PostgreSQL-backed ingredient storage

The project is intentionally practical and understandable. It is not a full enterprise architecture, but it now has clearer boundaries so authenticated persistence and local-first fallback can evolve without rewriting the app.

For product strategy beyond the current feature set, see [docs/BUSINESS_ROADMAP.md](docs/BUSINESS_ROADMAP.md).
For KPI instrumentation and event naming, see [docs/ANALYTICS_EVENTS.md](docs/ANALYTICS_EVENTS.md).

## Features

### Ingredient management

- Add, edit, delete, and mark ingredients as consumed
- Track quantity, category, storage type, purchase date, expiry date, and notes
- Search by ingredient name or notes
- Filter by category and storage type
- Sort by expiry date
- Shopping panel for consumed items

### Expiry awareness

- D-day style expiry labels
- Expiring-soon and expired summaries
- Dashboard preview of ingredients to use first

### Recipe recommendations

- Rule-based menu scoring using fridge ingredients, pantry staples, and expiring items
- Backend-connected mode can use a hybrid recipe recommender: structured ingredient matching first, pgvector similarity as a secondary signal
- Pantry staple support for items like oil, soy sauce, or salt
- Recipe cards focus on menu fit, owned ingredients, missing ingredients, and missing seasonings
- External search buttons for 10000recipe, YouTube, and Naver instead of storing cooking steps in-app
- Recommendation groups:
  - Ready now
  - Buy one more
  - Use soon

### Recipe import

- Food Safety Korea recipe XML import is reduced to recipe name, category, cooking method, raw ingredient text, tags, and optional nutrition
- Public recipe imports do not store `MANUAL01~20`, `MANUAL_IMG01~20`, or crawled recipe bodies
- Recipe import stores raw payloads, parsed ingredients, embedding text, and embedding status so failed embedding jobs do not block the catalog import
- LLM-based ingredient normalization can run in batches and falls back to rule-based normalization with confidence and review flags
- Recipe ingredient parsing preserves the raw ingredient text while splitting sections such as `양념장`, `소스`, and `고명`

### OCR import

- Upload screenshot with a step-by-step review flow
- Paste OCR text directly when the phone or server has already extracted receipt text
- Extract text in the browser with Tesseract.js
- Parse shopping/order text into ingredient candidates
- Use a dedicated receipt parser for receipt OCR so product name, unit price, quantity, total price, and discount lines can be reconstructed separately from Coupang or Kurly order parsing
- Review and selectively save parsed items
- Learn user corrections for future imports

### UI and usability

- Condensed header and page hero layout for faster scanning on desktop and mobile
- Dashboard cards prioritize urgent expiry work and next actions
- Ingredient cards emphasize consume/restore first, with edit and delete as secondary actions
- Recipe recommendation screen uses tighter summary blocks and compact pantry controls

### Local-first data flow

- Works without a backend by using IndexedDB
- Ingredient add, edit, consume/restore, and delete actions write to IndexedDB first
- Keeps guest and authenticated caches in separate IndexedDB scopes
- Authenticated users can manually sync from the account page
- Manual sync sends the current local ingredient snapshot to the server and replaces the server copy
- Deleting an ingredient does not call the server until the user manually syncs

### Authentication and persistence

- Sign up, log in, log out, and restore a persistent session with short-lived access tokens and rotating refresh tokens
- Protect ingredient and recipe API access on the backend
- Scope server-backed ingredients by user
- Keep guest mode separate instead of forcing account creation
- Offer a manual "import guest ingredients" step after login instead of auto-merging local data
- Keep guest import and server sync as separate actions

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- React Context + custom hooks + local component state
- IndexedDB

### Backend

- Express
- Prisma
- PostgreSQL
- JWT bearer auth with Node `crypto`
- Redis-backed auth throttling and logout token revocation with memory fallback

### Testing and tooling

- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier
- GitHub Actions

### OCR and AI

- Tesseract.js
- Anthropic API (optional, rule-based fallback exists)

## Refactored Structure

```text
fridgemate/
├── prisma/
│   └── schema.prisma
├── server/
│   └── src/
│       ├── controllers/      # Request/response handlers
│       ├── db/               # Prisma client and DB health helpers
│       ├── lib/              # Validation and shared backend utilities
│       ├── routes/           # Express route definitions
│       ├── services/         # Business logic and DB-backed operations
│       ├── app.js
│       ├── config.js
│       └── index.js
├── src/
│   ├── api/                  # Fetch wrappers for backend requests
│   ├── components/           # Reusable UI components
│   ├── data/                 # Seed data and pantry defaults
│   ├── db/                   # IndexedDB implementation
│   ├── features/
│   │   ├── import/           # Import flow helpers
│   │   ├── ingredients/      # Ingredient fields, selectors, repository
│   │   └── recipes/          # Recommendation view helpers
│   ├── hooks/                # App-level state hooks
│   ├── pages/                # Route-level screens
│   ├── test/                 # Shared test setup and smoke test
│   ├── utils/                # Pure utilities used across features
│   ├── App.jsx
│   └── main.jsx
├── docs/
├── scripts/
├── railway.json
├── vercel.json
└── package.json
```

## Why This Refactor Helps

### Frontend

- `pages/` now focus more on composition and user flow
- `features/ingredients/` centralizes ingredient-specific constants, selectors, and data-source orchestration
- `features/recipes/` groups recommendation presentation logic instead of leaving it inside page components
- `features/import/` keeps import-item selection logic out of the page component

### Backend

- `routes/` are now thin
- `controllers/` handle HTTP request/response concerns
- `services/` contain business logic and Prisma calls

This separation is small enough for a student portfolio project but makes the code easier to explain in an interview.

## Data Flow

### Ingredient flow

```text
UI action
  -> page component
  -> useIngredients hook
  -> ingredientRepository
     -> IndexedDB save/update/delete
     -> mark syncStatus as dirty
  -> React state update

Account page sync button
  -> syncIngredientsToServer()
  -> read current IndexedDB snapshot
  -> POST /api/ingredients/sync
  -> replace the server ingredient list with the local list
  -> mark syncStatus as synced or error
```

### Recommendation flow

```text
RecipesPage / HomePage
  -> useRecipeRecommendations
  -> local recommendation engine
  -> optional backend recommendation API
  -> pantry staples merged into available ingredients
```

### Backend flow

```text
Route
  -> Controller
  -> Service
  -> Prisma / seed data / recommendation engine
  -> JSON response
```

## Authentication and Persistence

FridgeMate now supports two clear modes:

- Guest mode
  - IndexedDB is the source of truth
  - no account is required
  - no protected backend calls are made
- Authenticated mode
  - JWT-backed access cookies protect the API
  - rotating refresh cookies restore the session and mint fresh access cookies
  - access tokens carry issuer, audience, and token id claims
  - ingredients are scoped by `userId`
  - IndexedDB remains the day-to-day source of truth on the device
  - the account page exposes a manual "server sync" action for authenticated users
  - guest ingredient import copies local guest items into the authenticated IndexedDB scope without uploading them automatically

Current auth hardening notes:

- signup and login are rate-limited by IP and normalized email
- email uniqueness is enforced on a normalized database column
- logout revokes the current token until it expires and revokes the refresh session in storage
- access and refresh tokens are stored as `httpOnly` cookies, while the frontend keeps only the last known user snapshot locally

This keeps the project simple enough for a portfolio app while making the data boundary easy to explain:

```text
Route
  -> auth middleware
  -> controller
  -> service
  -> Prisma query scoped by userId
```

Current manual sync is intentionally simple:

- guest mode remains fully local
- local IndexedDB changes are marked dirty in the frontend state
- `lastSyncedAt` is stored in `localStorage` under `fridgemate-last-synced-at`
- `/api/ingredients/sync` replaces the user's server ingredient list with the current local list
- this is a last-write-wins MVP strategy; future sync can extend the same boundary with `updatedAt`-based merge and delete conflict handling

## Getting Started

### Install

```bash
npm install
```

### Frontend-only mode

Set `VITE_API_URL=` in `.env` so the app runs in local-only mode.

```bash
npm run dev
```

To enable frontend error monitoring, also set:

```env
VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

### Frontend + backend mode

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
```

For Supabase, use the pooler URL for runtime database traffic and the direct/session URL for Prisma migrations:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

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

### Health check

```text
http://localhost:4000/health
```

## Tests and Quality

```bash
npm run lint
npm run test:run
npm run build
```

## Security Notes

- Use a random `JWT_SECRET` of at least 32 bytes.
- Keep `ALLOWED_ORIGINS` tight in production instead of broad wildcards.
- Set `REDIS_URL` to share auth throttling and logout revocation across API instances. If Redis is unavailable at boot or fails during runtime, the server falls back to in-memory storage.
- Keep `AUTH_COOKIE_SECURE=true` in production so auth cookies are sent only over HTTPS.
- The SPA no longer stores auth tokens in `localStorage`; only the user snapshot is persisted for local-first recovery.

Optional:

```bash
npm run test:coverage
npm run test:e2e
```

Playwright E2E uses two dev-server projects:

- `local-only`: no backend URL, verifies IndexedDB CRUD and OCR review flow
- `api-mode`: relative `/api` base URL with mocked responses, verifies auth, API CRUD, and fallback behavior

## Suggested Next Improvements

- Add conflict-aware sync uploads for pending authenticated writes
- Move shared recipe data/logic into a dedicated `shared/` module if the backend becomes a permanent part of the app
- Expand Playwright coverage beyond the core five user journeys
- Add user-scoped pantry staple persistence so auth mode covers the full recipe context

## Deployment

1. Add a Railway PostgreSQL plugin and confirm `DATABASE_URL` is available to the backend service.
2. Set Railway environment variables: `JWT_SECRET`, `ALLOWED_ORIGINS`, `CLIENT_ORIGIN`.
3. Set the Vercel environment variables: `VITE_API_URL`, `VITE_SENTRY_DSN` if Sentry monitoring is enabled.
4. Push to GitHub so Railway and Vercel can deploy automatically.
5. Verify the backend health check at `GET /health`.
6. Run an end-to-end smoke test: sign up, log in, add an ingredient, then load recipe recommendations.
