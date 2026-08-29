# Deployment Checklist

FridgeMate deployment verification checklist for Vercel, Cloudflare Workers, Supabase, auth cookies, and manual sync.

## Scope Gate

- [ ] Do not add new OCR taxonomy/classifier work for this release.
- [ ] Treat completed MFDS recipe seeding as data preparation only; do not add pgvector or recommendation UI work for this release.
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
- [ ] Keep `VITE_ADSENSE_SERVING_ENABLED=false` until the site is approved and publisher/slot IDs are configured.
- [ ] Keep AdSense Auto ads disabled so functional, empty, and error routes never receive Google-served ads.
- [ ] Confirm SPA routes load after refresh: `/`, `/ingredients`, `/import`, `/recipes`, `/login`, `/account`.
- [ ] Confirm the deployed frontend sends API requests with credentials.
- [ ] `curl` for `/`, `/recipes`, `/about`, `/contact`, and `/privacy` contains a visible `h1`, route-specific title, canonical URL, and JSON-LD without executing JavaScript.
- [ ] At least one `/recipes/{id}-{slug}` response contains the recipe name, ingredients, steps, an official source link, canonical URL, and `Recipe` JSON-LD without executing JavaScript.
- [ ] `/ingredients`, `/ingredients/*`, `/import`, `/login`, `/signup`, and `/account` return `X-Robots-Tag: noindex, nofollow, noarchive`.
- [ ] `/robots.txt`, `/sitemap.xml`, and `/llms.txt` return `200`; the sitemap contains the five static public routes plus the exported public recipe routes and no private routes.
- [ ] In Cloudflare AI Crawl Control, allow search/answer citation crawlers intentionally and keep training-only crawlers blocked; verify the effective `/robots.txt` because managed rules can be prepended to the repository response.
- [ ] Record Search Console and Naver Search Advisor baselines after deployment and compare impressions, clicks, indexed pages, and citations after 14 days.

## Cloudflare Workers API

- [ ] The `HYPERDRIVE` binding points to the Supabase PostgreSQL database.
- [ ] The `AUTH_KV` binding exists for logout revocation state.
- [ ] The `AUTH_RATE_LIMITER` Durable Object binding and `AuthRateLimiter` SQLite export are present.
- [ ] `DIRECT_URL` is available only in the trusted environment that applies Prisma migrations.
- [ ] `JWT_SECRET` is at least 32 characters.
- [ ] `JWT_EXPIRES_IN=15m` or another intentional short access-token value.
- [ ] `REFRESH_TOKEN_EXPIRES_IN=30d` or another intentional refresh-window value.
- [ ] `/api/recipes/import/food-safety` returns `404`; recipe imports run only through the trusted seeding workflow.
- [ ] `ALLOWED_ORIGINS` includes the exact Vercel frontend origin.
- [ ] `CLIENT_ORIGIN` matches the primary Vercel frontend origin.
- [ ] `AUTH_COOKIE_SECURE=true`.
- [ ] `AUTH_COOKIE_SAME_SITE=Lax` for the same-site production frontend and API.
- [ ] Production cookie names use `__Host-` prefixes and users are notified that the cutover requires one sign-in.
- [ ] Cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests with a missing or untrusted `Origin`/`Referer` return `403`.
- [ ] `/api/recommendation-events` rejects unknown/oversized fields and returns `429` after 120 requests per user/client address in one minute.
- [ ] `npm run worker:dry-run` completes before deployment.
- [ ] Optional v2/lab only: AI and embedding keys.

## Supabase

- [ ] Database exists and accepts connections through Cloudflare Hyperdrive.
- [ ] Prisma migrations run successfully with `npm run prisma:deploy`.
- [ ] Hyperdrive connects as a dedicated login role that is a member of `fridgemate_app`, is not a table owner, and has `NOBYPASSRLS`.
- [ ] The deployed API does not use `postgres`, `service_role`, or `DIRECT_URL` credentials.
- [ ] With `app.current_user_id` unset, direct runtime-role reads of `Ingredient` and `ImportCorrection` return no rows; with user A set locally in a transaction, user B rows remain inaccessible.
- [ ] `GET /api/health` returns only `{ "status": "ok" }` and does not expose database state.
- [ ] Verify database connectivity through authenticated functional smoke tests and private platform telemetry.
- [ ] Update any external uptime or Cloudflare Health Check assertion that previously parsed `db` or `timestamp`; the public contract is now only `status: ok`.

## Migration History Integrity

- [ ] Run `npx prisma migrate status` before every production migration and stop if production contains migration names that are absent from the repository.
- [ ] Recover the exact reviewed SQL and matching checksums for production-only migrations; do not create empty placeholders or mark guessed migrations as applied.
- [ ] Reconcile the currently observed production-only migrations `20260828090000_add_home_priority_fields`, `20260828100000_align_recipe_catalog_pipeline`, and `20260828110000_secure_recipe_import_tables` before applying another Prisma migration.
- [ ] Keep `20260826000000_add_ingredient_sync_tombstones` unapplied until the repository and production migration histories are reconciled.
- [ ] Do not use `npx prisma migrate deploy` while migration history is divergent; review and apply only an explicitly approved recovery plan.

## Authentication

- [ ] Signup creates an account and lands on the authenticated app state.
- [ ] Login succeeds and redirects back to the originally requested protected route.
- [ ] Logout revokes the refresh session and clears the local user snapshot.
- [ ] Refresh session restores a user after page reload.
- [ ] Reusing the same refresh cookie concurrently yields at most one replacement session; detected reuse revokes remaining refresh sessions.
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
- [ ] Apply `20260826000000_add_ingredient_sync_tombstones` before deploying the new API.
- [ ] Confirm `GET /api/ingredients/sync` returns only the authenticated user's active records and tombstones.
- [ ] Confirm backup sends only pending changes and preserves a newer change made on another device.
- [ ] Reload after sync and confirm data remains available.
- [ ] Delete locally, sync, reload, and confirm deleted item remains deleted.
- [ ] Reconnect an older device after deletion and confirm its stale active copy does not restore the item.
- [ ] Confirm an equal-`updatedAt` retry keeps the existing server value.
- [ ] Confirm a timestamp more than five minutes ahead of server time returns `400` without partially applying the batch.
- [ ] Direct API update/delete requests return the same `404` for missing ingredient IDs and IDs owned by another user.

## Disposable PostgreSQL Sync Verification

- [ ] Use only a disposable local PostgreSQL database exposed through `TEST_DATABASE_URL`; never point this check at Supabase or Hyperdrive production.
- [ ] Temporarily set both Prisma URLs to the disposable URL, apply all migrations, and verify existing `Ingredient` rows retain `deletedAt IS NULL`.
- [ ] Verify `Ingredient_userId_deletedAt_idx` exists and `Ingredient_userId_clientId_key` remains unique.
- [ ] Run the API as a non-owner member of `fridgemate_app`, set `app.current_user_id` transaction-locally, and verify user A cannot read or mutate user B rows.
- [ ] Repeat newer update, stale update, tombstone, stale resurrection, and identical payload cases, then remove the disposable database.
- [ ] Deploy `20260826000000_add_ingredient_sync_tombstones` before deploying server code that reads `deletedAt`; otherwise the API must be expected to fail safely with a generic `500` before writes.

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
- [ ] `docs/V1_RELEASE_QA.md` reflects the current auth, guest import, manual sync, deployment, and recipe-seeding boundaries.
