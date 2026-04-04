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

The project is intentionally practical and understandable. It is not a full enterprise architecture, but it now has clearer boundaries so future features like authentication and user-based persistence can be added without rewriting the app.

## Features

### Ingredient management

- Add, edit, delete, and mark ingredients as consumed
- Track quantity, category, storage type, purchase date, expiry date, and notes
- Filter by category and storage type
- Sort by expiry date
- Shopping panel for consumed items

### Expiry awareness

- D-day style expiry labels
- Expiring-soon and expired summaries
- Dashboard preview of ingredients to use first

### Recipe recommendations

- Rule-based scoring using required ingredients, optional ingredients, and expiring items
- Pantry staple support for items like oil, soy sauce, or salt
- Recommendation groups:
  - Ready now
  - Buy one more
  - Use soon

### OCR import

- Upload screenshot
- Extract text in the browser with Tesseract.js
- Parse shopping/order text into ingredient candidates
- Review and selectively save parsed items
- Learn user corrections for future imports

### Local-first data flow

- Works without a backend by using IndexedDB
- Uses the API when the user is authenticated
- Falls back to IndexedDB on network or 5xx API failures for authenticated sessions
- Keeps guest and authenticated caches in separate IndexedDB scopes
- Mirrors successful API reads and writes into the authenticated local cache

### Authentication and persistence

- Sign up, log in, log out, and restore a persistent session with JWT bearer tokens
- Protect ingredient and recipe API access on the backend
- Scope server-backed ingredients by user
- Keep guest mode separate instead of forcing account creation
- Offer a manual "import guest ingredients" step after login instead of auto-merging local data

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

### Testing and tooling

- Vitest
- React Testing Library
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
     -> API first when backend is enabled
     -> IndexedDB only when backend is disabled
     -> IndexedDB fallback on network / 5xx API failure
  -> React state update
  -> mirror successful API data into IndexedDB
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
  - JWT bearer auth protects the API
  - ingredients are scoped by `userId`
  - IndexedDB acts as a user-scoped local cache
  - successful server reads and writes mirror into the authenticated cache

This keeps the project simple enough for a portfolio app while making the data boundary easy to explain:

```text
Route
  -> auth middleware
  -> controller
  -> service
  -> Prisma query scoped by userId
```

The sync strategy is also slightly stronger than a naive last-write-wins approach:

- guest mode remains fully local
- authenticated mode compares cached and remote items by `updatedAt`
- newer remote items replace stale local cache entries
- pending local fallback writes are retained with sync metadata for future improvement

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

### Frontend + backend mode

Set the API URL and database connection in `.env`.

```env
VITE_API_URL=http://localhost:4000/api
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/fridgemate?schema=public
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=replace-this-in-production
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=
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
npm run test:run
npm run build
```

Optional:

```bash
npm run test:coverage
npm run lint
```

## Suggested Next Improvements

- Add conflict-aware sync uploads for pending authenticated writes
- Move shared recipe data/logic into a dedicated `shared/` module if the backend becomes a permanent part of the app
- Add component-level tests for page flows
- Add user-scoped pantry staple persistence so auth mode covers the full recipe context
