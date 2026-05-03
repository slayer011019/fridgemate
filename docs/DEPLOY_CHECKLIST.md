# Deployment Checklist

FridgeMate v1 deployment verification checklist for Vercel, Railway, Supabase, auth cookies, and manual sync.

## Scope Gate

- [ ] Do not add new OCR taxonomy/classifier work for this release.
- [ ] Do not add new pgvector or recipe seeding work for this release.
- [ ] Keep existing OCR parser behavior and tests intact.
- [ ] Treat local IndexedDB as the working copy.
- [ ] Keep server writes limited to the account-page manual sync button.

## Quality Gate

- [ ] `npm run lint`
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] `npm run test:e2e`

## Vercel Frontend

- [ ] `VITE_API_URL=https://YOUR_API_DOMAIN/api`
- [ ] `VITE_ENABLE_OCR=true`
- [ ] Optional: `VITE_SENTRY_DSN`
- [ ] Confirm SPA routes load after refresh: `/`, `/ingredients`, `/import`, `/recipes`, `/login`, `/account`.
- [ ] Confirm the deployed frontend sends API requests with credentials.

## Railway Backend

- [ ] `DATABASE_URL` points to the Supabase pooler/runtime URL.
- [ ] `DIRECT_URL` points to the Supabase direct/session URL for Prisma migrations.
- [ ] `JWT_SECRET` is at least 32 characters.
- [ ] `JWT_EXPIRES_IN=15m` or another intentional short access-token value.
- [ ] `REFRESH_TOKEN_EXPIRES_IN=30d` or another intentional refresh-window value.
- [ ] `ALLOWED_ORIGINS` includes the exact Vercel frontend origin.
- [ ] `CLIENT_ORIGIN` matches the primary Vercel frontend origin.
- [ ] `AUTH_COOKIE_SECURE=true`.
- [ ] `AUTH_COOKIE_SAME_SITE=None` when frontend and backend are on different domains.
- [ ] Optional: `REDIS_URL` for shared rate limit and logout revocation state.
- [ ] Optional v2/lab only: AI and embedding keys.

## Supabase

- [ ] Database exists and accepts connections from Railway.
- [ ] Prisma migrations run successfully with `npm run prisma:deploy`.
- [ ] `GET /health` returns `status: ok`.
- [ ] `GET /health` reports a healthy database check.

## Authentication

- [ ] Signup creates an account and lands on the authenticated app state.
- [ ] Login succeeds and redirects back to the originally requested protected route.
- [ ] Logout revokes the refresh session and clears the local user snapshot.
- [ ] Refresh session restores a user after page reload.
- [ ] 401/403 from refresh clears auth and returns to login.
- [ ] Network or 5xx refresh failure keeps the local session snapshot and surfaces a recoverable message.

## Guest To User

- [ ] Add an ingredient as guest.
- [ ] Login.
- [ ] Account page shows the guest import prompt.
- [ ] Importing guest ingredients copies them into the authenticated local scope.
- [ ] Importing guest ingredients does not upload to the server automatically.
- [ ] Dismissing the prompt keeps guest data separate.

## Manual Ingredient Sync

- [ ] Add ingredient while authenticated; confirm no immediate `POST /api/ingredients`.
- [ ] Edit ingredient while authenticated; confirm no immediate `PATCH /api/ingredients/:id`.
- [ ] Delete ingredient while authenticated; confirm no immediate `DELETE /api/ingredients/:id`.
- [ ] Account-page sync sends `POST /api/ingredients/sync`.
- [ ] Reload after sync and confirm data remains available.
- [ ] Delete locally, sync, reload, and confirm deleted item remains deleted.
- [ ] Record v2 follow-up for `updatedAt` merge plus `deletedAt`/tombstone conflict handling.

## Core Smoke Path

- [ ] Load home page.
- [ ] Add ingredient.
- [ ] Edit ingredient.
- [ ] Delete ingredient.
- [ ] Sign up.
- [ ] Log out.
- [ ] Log in.
- [ ] Import guest ingredients if prompted.
- [ ] Sync from account page.
- [ ] Reload and confirm data.
- [ ] Open OCR import and verify review-before-save still renders.
- [ ] Open recipes and verify rule-based recommendations render.

## Portfolio Docs

- [ ] README separates v1 shipped scope from v2 expansion.
- [ ] README lists current limitations.
- [ ] README names pgvector, richer recommendations, taxonomy/classifier hardening, and conflict-aware sync as v2 work.
