# Deployment Checklist

FridgeMate deployment verification checklist for Vercel, Cloudflare Workers, Supabase, auth cookies, and manual sync.

## Scope Gate

- [ ] Do not add new OCR taxonomy/classifier work for this release.
- [x] Treat the completed 1,166-row recipe embedding backfill as finished; do not rerun it during application deployment.
- [ ] Keep existing OCR parser behavior and tests intact.
- [ ] Treat local IndexedDB as the working copy.
- [ ] Keep server writes limited to the account-page manual sync button.

## Quality Gate

- [ ] `npm run lint`
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] `npm run prisma:validate`

## Isolated Semantic Staging

- [ ] Create a separate Supabase project; do not clone production users or tenant data.
- [ ] Apply every repository migration to staging with staging owner credentials.
- [ ] Import only public catalog and embedding tables in FK order.
- [ ] Confirm staging has 1,166 current embeddings, zero missing/stale/duplicate/orphan rows, and `vector(1536)`.
- [ ] Create staging-only KV, Hyperdrive, Worker, Durable Object namespace, JWT secret, and OpenAI secret.
- [ ] Deploy from an ignored `wrangler.staging.jsonc` derived from `wrangler.staging.example.jsonc`.
- [ ] Keep AdSense and GA disabled on `staging.오늘뭐먹지.com`.
- [ ] Confirm fixed reranked Hit@5 >= 7/10 and home-meal reranked Hit@5 >= 14/20 with recall@100 >= 18/20.
- [ ] Confirm healthy requests report semantic/hybrid and controlled vector failure reports rule-fallback/rule.
- [ ] Confirm missing auth is 401, invalid input is 400, and rate-limit exhaustion is 429.
- [ ] Inspect logs and confirm no credentials, user IDs, ingredients, prompts, query text, or vectors are present.
- [ ] Follow [the staging runbook](STAGING_SEMANTIC_RUNBOOK.md) and record the rollback flag procedure before production activation.

## Vercel Frontend

- [ ] `VITE_API_URL=https://YOUR_API_DOMAIN/api`
- [ ] `VITE_ENABLE_OCR=true`
- [ ] Optional: `VITE_SENTRY_DSN`
- [ ] Optional: `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX`; confirm no Google Analytics request occurs before consent, then verify DebugView after approval.
- [ ] Keep `VITE_ADSENSE_SERVING_ENABLED=false` until the site is approved and publisher/slot IDs are configured.
- [ ] Keep AdSense Auto ads disabled so functional, empty, and error routes never receive Google-served ads.
- [ ] Confirm SPA routes load after refresh: `/`, `/ingredients`, `/import`, `/recipes`, `/login`, `/account`.
- [ ] Confirm the deployed frontend sends API requests with credentials.
- [ ] `curl` for `/`, `/recipes`, `/about`, `/contact`, and `/privacy` contains a visible `h1`, route-specific title, canonical URL, and JSON-LD without executing JavaScript.
- [ ] At least one `/recipes/{id}-{slug}` response contains the recipe name, ingredients, steps, an official source link, canonical URL, and `Recipe` JSON-LD without executing JavaScript.
- [ ] `/ingredients`, `/ingredients/*`, `/import`, `/login`, `/signup`, and `/account` return `X-Robots-Tag: noindex, nofollow, noarchive`.
- [ ] `/robots.txt`, `/sitemap.xml`, and `/llms.txt` return `200`; the sitemap contains the five static public routes plus the exported public recipe routes and no private routes.
- [ ] In Cloudflare AI Crawl Control, allow search/answer citation crawlers intentionally and keep training-only crawlers blocked; verify the effective `/robots.txt` because managed rules can be prepended to the repository response.
- [ ] Add `https://오늘뭐먹지.com` to Google Search Console. Prefer a domain property verified with the DNS TXT record; for URL-prefix verification, set `VITE_GOOGLE_SITE_VERIFICATION` to only the HTML meta tag's `content` value and redeploy.
- [ ] Submit `https://오늘뭐먹지.com/sitemap.xml`, inspect the home page and a representative recipe URL, then request indexing after the production deployment is stable.
- [ ] Add `https://오늘뭐먹지.com` to Naver Search Advisor, set `VITE_NAVER_SITE_VERIFICATION` to the HTML meta tag's `content` value, redeploy, verify ownership, and submit `/robots.txt` plus `/sitemap.xml`.
- [ ] Add the site to Bing Webmaster Tools by importing the verified Google Search Console property or by setting `VITE_BING_SITE_VERIFICATION`, then submit `/sitemap.xml` and inspect a representative recipe URL.
- [ ] Submit the production URL through Daum Search Registration. Record the request date and result because Daum registration is an external review flow and has no repository verification tag.
- [ ] Link the GA4 property to Search Console, mark `activation_completed` and `signup_completed` as key events, and record the first 28-day baseline in `docs/SEO_90_DAY_OPERATIONS.md`.
- [ ] Record Search Console and Naver Search Advisor baselines after deployment and compare impressions, clicks, indexed pages, and citations after 14 days.

## Cloudflare Workers API

- [ ] The `HYPERDRIVE` binding points to the Supabase PostgreSQL database.
- [ ] The `AUTH_RATE_LIMITER` Durable Object binding exists for strongly consistent logout revocation and rate-limit state.
- [ ] The `AUTH_RATE_LIMITER` Durable Object binding and `AuthRateLimiter` SQLite export are present.
- [ ] A deployment with the `AUTH_RATE_LIMITER` binding intentionally removed fails closed instead of falling back to isolate memory.
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
- [ ] Login and signup IP throttles distinguish test clients by `CF-Connecting-IP` instead of the Worker adapter's internal peer address.
- [ ] Expired auth rate-limit Durable Object rows are removed by alarms and do not accumulate indefinitely.
- [ ] If a legacy Node/Redis deployment ever stored raw auth keys, remove them with a one-time access-controlled cleanup that logs counts only; runtime requests must use opaque SHA-256 Redis keys exclusively and must never probe raw email, IP, or JTI keys.
- [ ] `/api/recipes/ai-suggest` returns `429` after 20 requests per user or 60 requests per client address in one hour.
- [ ] Both import-correction embedding endpoints share item-weighted user and client budgets and return `429` with `Retry-After` when a budget is exhausted.
- [ ] Keep `SEMANTIC_RECIPE_API_ENABLED=false` through deployment, verify all 1,166 embeddings are current, then enable it in staging and confirm `/api/recipes/recommendations/semantic` returns semantic results, bounded rule fallback, and `429` at its user/client limits.
- [ ] During the first 24 production hours, count `semantic_recommendation` modes, latency, API errors, and aggregate `ai_usage`; turn the flag off for elevated failures or unexpected fallback growth.
- [ ] `/api/recommendation-events` rejects unknown/oversized fields and returns `429` after 120 requests per user/client address in one minute.
- [ ] `npm run worker:dry-run` completes before deployment.
- [x] The primary domain enforces CSP, frame denial, MIME sniffing protection, a strict referrer policy, and camera/geolocation/microphone denial without breaking home, login, import, or recipe routes.
- [x] Cloudflare browser RUM is disabled so analytics requests do not run before the app's explicit consent choice.
- [x] AI crawler policy allows OAI-SearchBot, PerplexityBot, and Claude-SearchBot while blocking GPTBot, CCBot, and Google-Extended case-insensitively; exact, lowercase, and mixed-case production `curl` probes were reverified on 2026-08-30.
- [ ] `API_SLOW_REQUEST_MS` is intentional, error responses include `x-request-id`, and platform logs contain no query strings, request bodies, user IDs, prompts, or vectors.
- [ ] If `AI_USAGE_LOGGING_ENABLED=true`, configure the current `RECIPE_EMBEDDING_PRICE_PER_MILLION_TOKENS` only when cost estimates are desired and verify token/count metrics in private platform telemetry.
- [ ] Optional v2/lab only: AI and embedding keys.

## Supabase

- [ ] Database exists and accepts connections through Cloudflare Hyperdrive.
- [ ] Prisma migrations run successfully with `npm run prisma:deploy`.
- [ ] Hyperdrive connects as a dedicated login role that is a member of `fridgemate_app`, is not a table owner, and has `NOBYPASSRLS`.
- [ ] The deployed API does not use `postgres`, `service_role`, or `DIRECT_URL` credentials.
- [ ] With `app.current_user_id` unset, direct runtime-role reads of `Ingredient` and `ImportCorrection` return no rows; with user A set locally in a transaction, user B rows remain inaccessible.
- [ ] `GET /api/health` returns only `{ "status": "ok" }` and does not expose database state.
- [ ] Verify database connectivity through authenticated functional smoke tests and private platform telemetry.
- [x] The scheduled GitHub Actions uptime check validates the public `{status: "ok"}` contract every 15 minutes without parsing removed `db` or `timestamp` fields.
- [ ] Enable GitHub Actions failure notifications for the repository owner, and add a separate paging channel or Cloudflare Health Check if near-real-time alerts are required.

## Migration History Integrity

- [ ] Run `npx prisma migrate status` before every production migration and stop if production contains migration names that are absent from the repository.
- [x] Restore the verified executed SQL for `20260828090000_add_home_priority_fields`, `20260828100000_align_recipe_catalog_pipeline`, and `20260828110000_secure_recipe_import_tables` under their production names.
- [x] Before the 2026-08-30 deployment, confirm `npx prisma migrate status` reported only `20260826000000_add_ingredient_sync_tombstones` as pending.
- [x] Review and explicitly accept the catalog-alignment and import-security checksum caveat in `docs/RECIPE_EMBEDDING_OPERATIONS.md`; their executed SQL is recovered but lost original comments/formatting prevent an exact historical checksum match.
- [x] Apply `20260826000000_add_ingredient_sync_tombstones` after reconciling the repository and production migration histories.
- [x] Apply `20260830170000_bound_auth_session_history`, confirm only excess inactive history is pruned, and verify no account exceeds 8 active or 24 total sessions.
- [x] Before the next deployment, confirm the repository SQL for `20260830140000` through `20260830170000` exactly matches the production `_prisma_migrations.checksum` values and that all four entries are finished without rollback.
- [x] Re-run `npx prisma migrate status` after deployment and confirm the production schema is up to date.

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
- [ ] Selecting a guest menu and importing it after login creates at most one menu for the Korean date and removes the guest copy after successful server storage.

## Daily Menu And Personalization

- [ ] Review and apply `20260830140000_add_menu_decisions_and_feedback` to staging only.
- [ ] Confirm the safe historical recipe-key backfill links only real catalog UUIDs and leaves local/unmatched keys nullable.
- [ ] Confirm `MenuDecision` unique user/date and user/client indexes, both FKs, RLS, and account-delete cascade.
- [ ] Review and apply `20260830150000_add_personalization_and_product_events` to staging only.
- [ ] Confirm pantry, preference, and product-event RLS prevents user A from reading or changing user B data.
- [ ] Confirm a repeated menu PUT is idempotent and replacing a completed menu returns it to selected.
- [ ] Confirm network/5xx keeps menu state pending and a 4xx response never appears clean.
- [ ] Confirm repeated recommendation/product `clientEventId` values do not create duplicate events.
- [ ] Confirm account export includes the new data and account deletion removes server rows plus account-scoped local caches.
- [ ] Review and apply `20260830180000_bound_event_retention`; confirm both event tables have `(createdAt, id)` indexes and that the migration itself deletes no rows.
- [ ] Run `npm run events:prune-retention` with the trusted maintenance URL and review only aggregate counts. Until a separately reviewed least-privilege scheduler exists, record each explicitly host-confirmed manual `--apply` run; do not treat the script itself as recurring enforcement.
- [ ] Confirm each retention run stays within its configured batch, maximum-delete, and runtime limits, and that no IDs, routes, properties, recipe names, or session values appear in its logs.
- [ ] Review and apply only `20260830190000_prepare_ingredient_tombstone_scrubbing`; confirm it makes payload columns nullable, validates the active-row CHECK, and performs no tombstone update or delete.
- [ ] Deploy the scrub-aware server after the prepare migration, wait until all old server/Worker instances have drained, and only then deploy the frontend that sends minimal tombstones.
- [ ] After the new server is stable, run `npm run ingredients:scrub-tombstones` with `DIRECT_URL` or `INGREDIENT_TOMBSTONE_SCRUB_DATABASE_URL` and review the aggregate-only dry-run.
- [ ] Apply the scrub with the exact `--confirm-database-host`, confirm every batch/max-update/runtime bound, and rerun while `mayHaveMore` is true or `remainingEligibleCount` is nonzero. This is a manual backfill, not recurring enforcement.
- [ ] Verify the scrub changes no `id`, `clientId`, `userId`, `updatedAt`, or `deletedAt`, hard-deletes no row, and exposes no ingredient payload or identifiers in logs.

## Manual Ingredient Sync

- [ ] Add ingredient while authenticated; confirm no immediate `POST /api/ingredients`.
- [ ] Edit ingredient while authenticated; confirm no immediate `PATCH /api/ingredients/:id`.
- [ ] Delete ingredient while authenticated; confirm no immediate `DELETE /api/ingredients/:id`.
- [ ] Account-page sync sends `POST /api/ingredients/sync`.
- [x] Apply `20260826000000_add_ingredient_sync_tombstones` before deploying the API that reads `deletedAt`.
- [ ] Confirm `GET /api/ingredients/sync` returns only the authenticated user's active records and minimal tombstones (`id`, `clientId`, `userId`, `updatedAt`, `deletedAt`) with no ingredient business payload.
- [ ] Confirm backup sends only pending changes and preserves a newer change made on another device.
- [ ] Reload after sync and confirm data remains available.
- [ ] Delete locally, sync, reload, and confirm deleted item remains deleted.
- [ ] Reconnect an older device after deletion and confirm its stale active copy does not restore the item.
- [ ] Repeat with the stale active copy carrying a later device timestamp and confirm the tombstone still wins because restore is not yet supported.
- [ ] Confirm an equal-`updatedAt` retry keeps the existing server value.
- [ ] Confirm a timestamp more than five minutes ahead of server time returns `400` without partially applying the batch.
- [ ] Direct API update/delete requests return the same `404` for missing ingredient IDs and IDs owned by another user.

## Disposable PostgreSQL Sync Verification

- [ ] Use only a disposable local PostgreSQL database exposed through `TEST_DATABASE_URL`; never point this check at Supabase or Hyperdrive production.
- [ ] Temporarily set both Prisma URLs to the disposable URL, apply all migrations, and verify existing `Ingredient` rows retain `deletedAt IS NULL`.
- [ ] Verify `Ingredient_userId_deletedAt_idx` exists and `Ingredient_userId_clientId_key` remains unique.
- [ ] Run the API as a non-owner member of `fridgemate_app`, set `app.current_user_id` transaction-locally, and verify user A cannot read or mutate user B rows.
- [ ] Repeat newer update, stale update, tombstone, stale resurrection, and identical payload cases, then remove the disposable database.
- [x] Deploy `20260826000000_add_ingredient_sync_tombstones` before server code that reads `deletedAt`; this ordering was completed on 2026-08-30.

## Production Real-Device Sync Drill

Use one disposable account on the production custom domain. Do not use personal fridge contents, screenshots containing personal data, or a production administrator account.

Record before starting:

- [ ] Drill date, operator, production frontend URL, and API URL.
- [ ] PC operating system and browser/version.
- [ ] Mobile operating system and browser/version.
- [ ] Both devices use automatic network time and differ by less than one minute.
- [ ] A unique marker such as `sync-drill-YYYYMMDD-HHMM` identifies every test record.

Propagation and idempotency:

- [ ] Login to the same disposable account on PC (device A) and mobile (device B).
- [ ] On A, create the marker ingredient and press **서버에 백업하기**.
- [ ] On B, press **서버에서 가져오기** and confirm exactly one matching record appears.
- [ ] Repeat backup on A and pull on B; confirm the record is not duplicated.
- [ ] Reload both devices and confirm the record remains scoped to the test account.

Newest-edit conflict:

- [ ] Pull the same baseline record onto both devices.
- [ ] Edit it on A and keep the change unsynced.
- [ ] At least five seconds later, edit and back up a different value on B.
- [ ] Back up A's older pending edit, then pull on both devices.
- [ ] Confirm B's newer value wins and A's stale retry does not overwrite it.

Deletion and stale reconnect:

- [ ] Pull the same baseline record onto both devices.
- [ ] Take B offline, edit the record once, and leave that older change pending.
- [ ] At least five seconds later, delete the record on online device A and back up the deletion.
- [ ] Reconnect B, back up its older pending active copy, and then pull.
- [ ] Confirm the deleted record remains absent on both devices after reload.
- [ ] Repeat backup and pull once more; confirm the tombstone remains idempotent.

Failure and cleanup:

- [ ] If an operation fails, record the visible message, time, request ID, device, and action without recording cookies or tokens.
- [ ] Do not change a physical device clock by more than five minutes; the future-timestamp rejection is covered by the production API smoke test and automated sync tests because changing the OS clock can also invalidate TLS and unrelated sessions.
- [ ] Export the disposable account only if drill evidence is needed, then delete the account from the account page.
- [ ] Verify both devices return to logged-out state and the deleted credentials can no longer log in.

The drill passes only when propagation, conflict resolution, deletion, reload persistence, account isolation, and cleanup all pass on both physical devices. Browser-context E2E is supporting evidence, not a substitute for this section.

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
