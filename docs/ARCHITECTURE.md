# FridgeMate Architecture

FridgeMate is a local-first React app with an optional Express and Prisma backend.

## Modes

Local-only mode:

- `VITE_API_URL` is empty
- ingredient data reads and writes directly through IndexedDB
- no account is required
- OCR import and rule-based recommendations remain available

Backend-connected mode:

- `VITE_API_URL` points to the API
- auth, recipe APIs, import correction APIs, and recommendation event APIs can be used
- ingredient CRUD still writes locally first
- server persistence happens through explicit account-page sync actions

## Frontend Layers

```text
src/pages
  -> src/components
  -> src/hooks
  -> src/api and src/db
  -> src/utils
```

Pages own screen-level workflows. Hooks coordinate app state, IndexedDB, network status, auth, and recommendations. API clients isolate backend requests. Utilities keep date logic, import parsing, recommendation scoring, and sync decisions testable.

## Backend Layers

```text
server/src/app.js
  -> routes
  -> controllers
  -> services
  -> Prisma
  -> PostgreSQL
```

Routes define API boundaries. Controllers handle request and response shape. Services contain validation and persistence logic. Prisma owns database access.

## Data Strategy

The active working copy lives in IndexedDB. This keeps the app usable when the backend is not configured or temporarily unavailable.

Authenticated users can:

- push the current local ingredient snapshot to the server
- pull the current server ingredient snapshot into the device cache

This is an explicit overwrite sync strategy for the current milestone. Conflict-aware two-way sync is planned.

## Recommendation Flow

Local row:

- uses bundled recipes and rule-based scoring
- considers fridge ingredients, pantry staples, and urgent expiration dates
- renders immediately

AI/DB row:

- waits for viewport entry before calling backend recommendations
- requires backend mode and login
- can use DB-backed hybrid recommendation services
- falls back or hides gracefully depending on error type

Recommendation events:

- impressions and clicks are posted to `/api/recommendation-events`
- authenticated events are associated with the user when a valid token exists
- anonymous backend-mode events can still store session-level data
- export scripts produce JSONL or CSV datasets for future ranking work

## Security Boundaries

- auth cookies are `httpOnly`
- frontend code does not store access or refresh tokens in localStorage
- API keys stay in server/local environment files
- Supabase service role keys must never use a `VITE_` prefix
- local environment files are ignored by git
