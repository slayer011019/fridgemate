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

The browser entry renders route components through `React.lazy`, so OCR, public recipe catalog, recommendation, and account code load only when their routes are visited. The initial production JavaScript chunk is about 160 KB minified instead of the previous 623 KB monolith. SEO generation uses the separate synchronous `AppServer` entry, preserving complete static markup for all public routes without forcing those page modules into the initial browser bundle.

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

Every API response receives a server-generated `x-request-id`. Failure and slow-request telemetry records only the request ID, method, top-level API group, status, duration, and bounded error name/code; it deliberately excludes query strings, request bodies, user IDs, and raw error messages. Optional AI usage telemetry records provider/model/count/token/duration fields and a cost estimate only when an operator supplies the current per-million-token price. Prompts, recipe text, API keys, and vectors are never telemetry fields.

## Data Strategy

The active working copy lives in IndexedDB. This keeps the app usable when the backend is not configured or temporarily unavailable.

Authenticated users can:

- push only pending local ingredient changes to the server
- pull the complete server sync state, including deletion tombstones, into the device cache

Sync remains an explicit account-page action. Each record uses a stable `clientId`; local and server copies are merged with newest-`updatedAt` wins. IndexedDB persists `pendingCreate`, `pendingUpdate`, and `pendingDelete`, while normal UI reads hide records with `deletedAt`. The server keeps soft-deleted rows as tombstones so an older device cannot recreate a deleted ingredient. Clean local records absent from the complete server state are removed, while unsent local records are retained.

The server keeps its existing value when timestamps are equal, making retries and equal-time conflicts deterministic. Sync timestamps more than five minutes ahead of server time are rejected before the transaction starts so one incorrect device clock cannot pin a record in the future. This is a safety bound, not a logical-clock replacement.

`GET /api/ingredients` remains an active-record API. `GET /api/ingredients/sync` includes tombstones for reconciliation, and `POST /api/ingredients/sync` accepts record-level `changes` rather than treating one device's list as a destructive replacement snapshot. All three paths remain authenticated and user-scoped inside the PostgreSQL RLS transaction boundary.

Playwright starts its two Vite modes through `e2e/globalSetup.js`. They run in the Playwright process and are closed by the returned teardown callback, avoiding the Windows child-process leak seen with the built-in `webServer` shell path.

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

Semantic recipe retrieval groundwork:

- production recipe embeddings are stored separately in `recipe_embeddings`
- the table references the existing production `recipes(id)` UUID instead of changing `recipes`
- embedding generation builds deterministic text from production-shaped recipe and recipe ingredient rows
- empty ingredient categories are resolved at runtime by a shared pure classifier with explicit-category, section-marker, normalized-name, title-match, and substantial-quantity evidence; unsupported rows remain `unknown`
- structured scoring counts only `main` rows as core requirements, separates seasonings, ignores optional/garnish/liquid rows for `canMakeNow`, and gives unknown rows only a small conservative penalty
- vector candidate retrieval filters `recipe_embeddings` by model and dimensions, then joins `recipes` and loads matching `recipe_ingredients`
- Prisma recipe catalog models map the existing UUID-based Supabase columns instead of the earlier experimental cuid/inline-embedding shape
- pgvector search is a candidate retrieval step, not the final recommendation ranker
- rule-based reranking keeps ingredient ownership, expiration urgency, and missing ingredient penalties in control
- the fixed quality fixture and in-memory evaluator prevent old and new embedding-text versions from being mixed during release decisions

## Security Boundaries

- auth cookies are `httpOnly`
- tenant-sensitive ingredient and OCR correction queries run inside a transaction-local PostgreSQL user scope, backed by forced RLS policies and a non-bypass runtime role
- frontend code does not store access or refresh tokens in localStorage
- API keys stay in server/local environment files
- Supabase service role keys must never use a `VITE_` prefix
- local environment files are ignored by git
