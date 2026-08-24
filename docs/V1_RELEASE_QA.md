# FridgeMate v1 Release QA

This checklist is the release gate for the deployable v1 MVP. Recipe source seeding is complete and should be treated as data preparation for v2 recommendation work, not as a new v1 UI feature.

## Scope Lock

- Do not add new OCR taxonomy or classifier work.
- Do not add pgvector embeddings.
- Do not split `recipe_ingredients`.
- Do not add recipe recommendation UI for the seeded MFDS data.
- Keep the existing OCR parser, `CANONICAL_RULES`, aliases, confidence metadata, unit extraction, and duplicate review behavior intact.

## Security And Environment

- `.env`, `.env.local`, and `.env.*.local` must stay out of git.
- `SUPABASE_SERVICE_ROLE_KEY` must only be used by local or server-side scripts.
- Do not create `VITE_SUPABASE_SERVICE_ROLE_KEY` or any other `VITE_` service-role key.
- `FOODSAFETY_API_KEY` must not be read from browser code.
- Frontend deployment env should include only browser-safe values such as `VITE_API_URL`, `VITE_ENABLE_OCR`, and optional `VITE_SENTRY_DSN`.

## MFDS Recipe Seeding Status

- Supabase `public.recipes` table has been created from `docs/sql/create_recipes_table.sql`.
- MFDS `COOKRCP01` data has been seeded with `npm run seed:recipes`.
- Re-running the seed is safe because rows are upserted by `external_id`.
- See `docs/recipe-seeding.md` for the SQL, environment variables, and command usage.
- v2 follow-up: derive searchable recipe ingredients, add pgvector embeddings, and connect seeded data to recommendation UI.

## Auth Flow

- Signup creates a user and enters the authenticated app state.
- Login succeeds and returns to the requested protected route.
- Logout revokes the refresh session and clears the local user snapshot.
- Refresh cookies restore the session after reload.
- 401 or 403 refresh failures clear auth and redirect protected routes to login.
- Network or 5xx refresh failures keep the local user snapshot and show a recoverable error.
- Authenticated API requests must send cookies with `credentials: 'include'`.
- Manual ingredient sync uses the authenticated request path and retries once after a successful refresh.

## Guest To User Flow

- A guest can add ingredients locally without a backend session.
- After login, the account page shows the guest import prompt when guest ingredients exist.
- Importing guest ingredients copies them into the authenticated local IndexedDB scope.
- Importing guest ingredients does not upload to the server.
- Server persistence happens only when the user presses the account-page sync button.

## Manual Sync Flow

- Add, edit, consume, restore, and delete write to IndexedDB first.
- These actions must not call `POST /api/ingredients`, `PATCH /api/ingredients/:id`, or `DELETE /api/ingredients/:id`.
- The account-page sync button sends `POST /api/ingredients/sync` with the current local snapshot.
- Deleting locally and then syncing should remove the item from the server snapshot.
- Reload after deletion sync should not restore the deleted item.
- v1 uses replace-style sync. v2 should add `updatedAt` merge plus `deletedAt` or tombstone conflict handling for multi-device writes.

## Deployment Checks

- Vercel `VITE_API_URL` points to the production API `/api` base URL.
- Railway `ALLOWED_ORIGINS` and `CLIENT_ORIGIN` include the exact frontend origin.
- Production cookies use `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=Lax`, and `__Host-` names on the same-site frontend/API domain.
- Cookie-authenticated state changes reject missing or untrusted `Origin`/`Referer` values.
- `GET /health` returns only the public liveness response without database details.
- Signup, login, reload session restore, account sync, logout, and relogin work on the custom domain.

## Core QA Scenario

1. Add an ingredient as guest.
2. Sign up or log in.
3. Import the guest ingredient from the account page.
4. Confirm the ingredient is marked as an unsynced local change.
5. Press the account-page sync button.
6. Reload and confirm the ingredient remains.
7. Delete the ingredient.
8. Press the sync button again.
9. Reload and confirm the deleted ingredient does not return.
10. Log out, log in again, and confirm the server-backed data is still correct.

## Required Commands

```bash
npm run lint
npm run test:run
npm run build
```

Before public release, also run:

```bash
npm run test:e2e
```
