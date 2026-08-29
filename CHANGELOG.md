# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Completed the sixth separately approved 25-row missing embedding batch with zero failures, then verified 1,153 embeddings, `current=170`, `missing=13`, `stale=983`, duplicate/orphan counts of zero, and `vector(1536)`.
- Completed the fifth separately approved 25-row missing embedding batch with zero failures, then verified 1,128 embeddings, `current=145`, `missing=38`, `stale=983`, duplicate/orphan counts of zero, and `vector(1536)`.
- Completed the fourth separately approved 25-row missing embedding batch with zero failures, then verified 1,103 embeddings, `current=120`, `missing=63`, `stale=983`, duplicate/orphan counts of zero, and `vector(1536)`.
- Completed the third separately approved 25-row missing embedding batch with zero failures, then verified 1,078 embeddings, `current=95`, `missing=88`, `stale=983`, duplicate/orphan counts of zero, and `vector(1536)`.
- Completed the second separately approved 25-row missing embedding batch with zero failures, then verified 1,053 embeddings, `current=70`, `missing=113`, `stale=983`, duplicate/orphan counts of zero, and `vector(1536)`.
- Completed the first approved 25-row full-catalog missing embedding batch with zero failures, then verified 1,028 embeddings, `current=45`, `missing=138`, `stale=983`, duplicate/orphan counts of zero, and `vector(1536)`.
- Added a guarded `--all` backfill mode that reads the live catalog count and refuses production execution without an explicit finite `--max-writes` cap.
- Detected that production had grown from 1,146 to 1,166 recipes, removed the verifier's hardcoded catalog limit, and corrected staged backfill expectations so 20 new catalog rows cannot be silently omitted.
- Confirmed through aggregate-only checks that the 20-row increase is the intentional ingredient-complete `curated_home_v1` catalog source, not duplicate or orphaned recipe data.
- Made recipe embedding summaries print the effective `maxWrites` cap so full-catalog dry-runs cannot obscure the separately approved production write boundary.
- Created and checksum-verified a fresh protected checkpoint of all 1,003 stored production recipe embeddings after the limited stale replacement, with zero production writes and zero embedding API calls.
- Hardened recipe embedding operations with multi-input API batches, bounded retry/backoff, UUID keyset resume state, token/cost/throughput summaries, and a verified gzip checkpoint manifest with SHA-256.
- Restored the three production-only recipe catalog migration files from verified schema statements, realigned Prisma migration-name history without running a deployment, and documented the two unrecoverable original-format checksum differences.
- Completed a checkpointed ten-row missing recipe embedding backfill and verified the write cap, `vector(1536)` integrity, duplicate/orphan counts, stored-vector ordering, ingredient joins, and canonicalized semantic reranking.
- Completed a separately checkpointed ten-row stale embedding replacement with no failures, exact write-bound verification, and 10/10 stored-vector self retrieval without spending additional query-embedding API calls.
- Added a read-only stored-vector evaluation mode that embeds only the fixed ten fixture queries, and verified production retrieval at Hit@1 9/10 and Hit@5 10/10 with one API request and zero database writes.
- Prerendered public pages with route-specific crawler-visible HTML and forced functional, account, ingredient, and import routes out of search indexes at the response-header level.
- Added an explicit `--max-writes` cap to recipe embedding backfills so a full catalog scan can still guarantee a limited number of production upserts.
- Raised the fixed semantic recipe retrieval fixture from 6/10 to 9/10 Hit@5 by placing normalized ingredient sections before menu metadata in candidate embedding text, without changing the embedding model, vector dimensions, candidate pool, or fixture ground truth.
- Added target similarity and query-versus-candidate ingredient classification evidence to the read-only recipe search quality report.
- Added deterministic runtime ingredient classification so empty production categories no longer make every seasoning, liquid, garnish, optional item, or uncertain item a core requirement.
- Replaced noisy recipe embedding bodies with bounded classification-aware text and aligned semantic query text with the same normalized search-ingredient sections.
- Made the recipe embedding command write-free by default and separated missing/stale backfill modes from in-memory quality evaluation.
- Aligned the Prisma recipe catalog models with the production UUID/Supabase table shape and changed pgvector retrieval to join `recipe_embeddings` with `recipes` instead of querying the nonexistent `recipes.embedding` column.
- Made DB-backed hybrid recommendations load only retrieved production recipe UUIDs and their canonical ingredient rows, with a recent-catalog fallback when vector retrieval is unavailable.
- Made equal sync timestamps keep the existing server value and reject timestamps more than five minutes in the future before any batch write.
- Replaced Playwright's Windows-leaking `webServer` child-process path with explicit in-process Vite startup and teardown.
- Hardened production auth cookies with `SameSite=Lax` and `__Host-` names, and reject cookie-authenticated state changes whose `Origin` or fallback `Referer` is missing or untrusted.
- Rate-limited recommendation event ingestion by authenticated user/client address and replaced arbitrary analytics metadata with a bounded allowlisted schema.
- Reduced public health responses to a static liveness signal so database connectivity and runtime timestamps are not exposed to unauthenticated callers.
- Expire legacy auth-cookie names during the `__Host-` cookie cutover, and key recommendation-event limits by user ID for authenticated traffic or client address for anonymous traffic.
- Added forced PostgreSQL RLS policies for ingredient and OCR correction data, a non-bypass application role, and transaction-local user scoping for every runtime access to those tables.
- Scoped account lookup, refresh sessions, recommendation events, and recipe reads for the non-bypass runtime role instead of granting blanket access to RLS-enabled support tables.

### Added

- Added optional Search Console HTML-tag verification and strengthened the WebSite entity with natural `오늘 뭐 먹지` and `FridgeMate` alternate names without adding typo keywords to visible copy.
- Added a read-only recipe embedding verifier that checks staged expected counts, current/missing/stale coverage, model/dimensions, vector type, duplicate keys, and orphan rows without API calls or row-level output.
- Added metadata-only API request IDs, failure/latency telemetry, client-side error correlation, and optional embedding token/cost metrics without logging prompts, request bodies, user IDs, or vectors.
- Added a separate 20-recipe Korean home-meal search fixture with realistic three-to-five-ingredient queries, expiring ingredients, alias coverage, category balance, Hit@5 rate, owned-ingredient ratio, and missing-ingredient metrics.
- Added 100 source-backed Food Safety Korea recipe detail pages with stable slugs, ingredients, cooking steps, nutrition, images, canonical URLs, sitemap entries, and truthful `Recipe` JSON-LD.
- Added a safe public-recipe export command that is read-only by default, strips raw source payloads, upgrades image URLs to HTTPS, and writes only with an explicit `--write` flag.
- Added truthful page-level JSON-LD, `llms.txt`, private-route crawler exclusions, and a post-build SEO output verification gate.
- Added a fixed ten-recipe semantic retrieval fixture, an all-catalog read-only evaluation command, Hit@1/Hit@5/MRR metrics, and a vector-free JSON quality report.
- Added first-pass conflict-aware manual ingredient sync with stable `clientId` matching, persisted pending create/update/delete states, and server deletion tombstones.
- Added a record-level ingredient sync API and complete sync-state pull endpoint while preserving authenticated user scoping and PostgreSQL RLS boundaries.
- Added backward-compatible IndexedDB sync metadata migration and conflict, deletion, failure, idempotency, tenant-isolation, and local-only regression coverage.
- Added separate-browser-context sync E2E coverage for propagation, conflicts, offline recovery, deletion, idempotency, and account isolation.
- Added a mobile category select to the ingredient filters while keeping wrapped category buttons on larger screens.
- Added route-specific titles, descriptions, canonical URLs, search-index controls, and a Not Found page with production 404 routing.
- Added a Cloudflare Workers Express entry point, Prisma PostgreSQL driver adapter support for Hyperdrive, and optional Workers KV auth security storage.
- Added disabled-by-default AdSense head injection, responsive ad units, generated `ads.txt`, and a public privacy information page.
- Added public service and contact pages, finalized the privacy contact, and published `robots.txt` and `sitemap.xml` for search crawlers.
- Added recommendation event persistence for impression and click feature snapshots, plus a training-data export script for future ML ranking experiments.
- Added an account-page server pull action so authenticated users can replace the local device cache with their server ingredient list.
- Added a shared horizontal recommendation row component and a lazy DB recommendation hook that waits for viewport entry before calling the recommendation API.
- Added a v1 release QA checklist covering environment security, MFDS recipe seed boundaries, auth, guest import, manual sync, deployment, and smoke scenarios.
- User-scoped OCR import correction storage with optional pgvector embeddings for similarity-based review suggestions.
- Backend import correction APIs and OpenAI embedding configuration while preserving local import correction fallback.
- Script for backfilling missing import correction embeddings after enabling OpenAI embeddings.
- OCR import now detects source type before parsing and routes Coupang, Kurly, receipt, and generic shopping text separately.
- Receipt OCR parsing now extracts grocery item rows from mobile and mart receipts before falling back to generic OCR parsing.
- OCR import candidates now include confidence and review metadata, with receipt garbage filtering for obvious non-product lines.
- Added a dedicated receipt text parser that reconstructs product name, unit price, quantity, total price, and discounts from pasted or OCR-extracted receipt text.
- OCR import now supports directly pasting receipt OCR text into the review flow without re-running image OCR.
- Added a Food Safety Korea recipe XML parser that keeps recipe names, raw ingredient text, tags, optional nutrition, and generated external search links without storing manual steps.
- Added Supabase SQL and a Node seed script for importing MFDS `COOKRCP01` public recipe source rows into a `recipes` table.
- Added a Supabase `recipe_ingredients` SQL script and MFDS ingredient parsing CLI for splitting seeded recipe ingredient text into normalized chunks.
- Added a recipe parser training export script that writes JSONL baseline labels for future ML-assisted parsing.
- Added recipe ingredient parsing and fridge-to-menu match scoring utilities for ingredient-based recipe recommendations.
- Added recipe raw import storage, batch LLM ingredient normalization fallback, embedding text generation, OpenAI embedding service scaffolding, pgvector search, and hybrid recipe ranking.
- Added manual ingredient sync from the account page, including dirty/syncing/synced/error UI state and persisted last sync time.
- Added a replace-style ingredient sync endpoint for saving the current local IndexedDB snapshot to the server on demand.
- Added duplicate ingredient cleanup on the ingredients page, keeping the newest purchase-date item in each duplicate group.
- Added ingredient `clientId` sync identity so repeated manual syncs upsert existing server rows instead of creating duplicates.
- Frontend Sentry initialization behind `VITE_SENTRY_DSN` for optional production error monitoring.
- GitHub Actions CI workflow for lint, test, and build jobs with artifact upload.
- Vitest coverage across recommendation logic, OCR parsing, IndexedDB, import learning, and `useIngredients`.
- Global connection status feedback with online/offline and fallback notices.
- Sync strategy scaffold documenting the current `last-write-wins` approach.
- Playwright E2E scaffolding for local-only CRUD, auth, API fallback, and OCR review flows.
- Added a v1 stabilization plan that pauses new taxonomy, pgvector, and recipe-ranking expansion until deployment basics are solid.
- Added E2E coverage for guest-to-user import, manual sync, deletion sync, and expired-session handling.
- Added `docs/BUSINESS_ROADMAP.md` to document product positioning, monetization, KPI focus, and exit options.
- Added `docs/ANALYTICS_EVENTS.md` to define activation, OCR, retention, recommendation, and monetization event tracking.
- Added a lightweight analytics layer with session, auth, ingredient, OCR, and recommendation instrumentation hooks.

### Changed

- Split browser routes into lazy chunks while keeping a synchronous SEO render entry, reducing the initial minified JavaScript chunk from about 623 KB to 160 KB and removing the Vite 500 KB warning.
- Moved GitHub Actions CI and its official checkout, Node setup, and artifact upload actions to the Node.js 24 generation.
- Replaced destructive whole-snapshot ingredient backup with newest-`updatedAt` record changes; manual backup and pull now merge without overwriting newer pending local work.
- Simplified recommendation cards so matching, owned ingredients, and missing items are easier to scan.
- Strengthened typography hierarchy, text contrast, card borders, and restrained accent colors across core app screens.
- Reduced oversized corner radii and removed decorative gradients from operational screens.
- Separated AdSense ownership verification from ad serving, disabled Google-served ads during policy review, and removed the global Auto ads loader from non-content routes.
- Added the production AdSense publisher verification script to the document head while keeping ad units disabled by default.
- Split account-page manual sync into explicit server backup and server pull actions with confirmation prompts.
- Refactored the recipes page into a two-row layout: instant local seed recommendations first, lazy DB-backed AI recommendations second.
- Home and recipe-page recommendation previews now use the DB-backed recommendation API first in authenticated backend mode, then fall back to local seed recipes for network or server failures.
- DB-backed hybrid recipe scoring now counts owned pantry staples the same way the local recommendation engine does.
- Refreshed the README around the current v1 deployment gate, MFDS seed completion, auth/manual-sync behavior, and v2 recipe boundaries.
- Grouped the pantry staple checklist into Korean home-cooking basics and a collapsed extra seasonings section.
- Moved header account actions to the top-right area, restyled ingredient filters as a category toolbar, and made the manual memo field auto-grow.
- Removed the internal storage scope display from the account page.
- Simplified recipe recommendation cards around ingredient match rate, owned ingredients, missing ingredients, missing seasonings, and external search buttons.
- Simplified the public recipe catalog shape so `MANUAL01~20`, `MANUAL_IMG01~20`, and recipe body content are not imported or stored.
- Recipe recommendation API now tries DB-backed hybrid recommendations first and falls back to seed recipes when the recipe catalog or vector search is unavailable.
- Expanded import category and storage options so receipt parsing can suggest more specific classes such as `라면/면류`, `간식`, `양념/소스`, and `상온`.
- Added Prisma `directUrl` configuration and Supabase pooler examples for hosted PostgreSQL connections.
- Updated README and AGENTS documentation to match the current local-first + optional backend architecture.
- Changed ingredient CRUD to local-first IndexedDB writes; server writes now happen only when the user manually syncs from the account page.
- Manual ingredient sync now upserts by `clientId` and removes server rows that are no longer present in the local snapshot.
- Guest ingredient import now copies guest items into the authenticated local scope without automatically uploading them to the server.
- Routed pantry-owned staples into recommendation scoring instead of keeping them UI-only.
- Tightened deployment guidance around environment variables, smoke checks, and core journey verification.
- Reworked the deployment checklist around v1 manual sync, auth cookies, Vercel, Railway, and Supabase verification.
- Linked the business roadmap from the README so product and go-to-market direction are easier to find.
- Linked the analytics event spec from the README so KPI instrumentation has a documented source of truth.
- Hardened auth handling with normalized email uniqueness, shorter JWT defaults, logout token revocation, and rate-limited signup/login.
- Added Redis-backed auth throttling and token revocation with in-memory fallback for single-instance development.
- Auth security storage now falls back to memory if Redis becomes unavailable during runtime.
- Switched auth to `httpOnly` access/refresh cookies with refresh-token rotation and frontend user-only session persistence.
- Polished the app UI with a denser header, shorter page heroes, dashboard hierarchy cleanup, ingredient search, and more action-focused ingredient cards.
- Simplified recipe, OCR import, and auth screen copy so the next step is clearer on mobile and desktop.

### Fixed
- Ingredient updates and deletes now apply `id` and authenticated `userId` together in the database mutation, preventing unscoped writes and returning the same `404` for missing or foreign records.
- Removed the authenticated-but-unprivileged recipe catalog import HTTP route; global recipe imports now remain restricted to trusted local or CI seeding workflows.
- Refresh-token rotation now atomically consumes the previous database session before issuing a replacement, rejects concurrent reuse, and revokes the user's remaining refresh sessions when reuse is detected.
- Login and signup throttling now uses per-key SQLite Durable Objects on Cloudflare, keeps Redis atomic counters on production Node, and fails closed instead of falling back to per-instance memory when persistent auth storage fails.
- Cloudflare database requests now use a single connection per request, and recommendation events are queued in the browser to avoid exhausting the Supabase session pool.
- Hybrid recipe recommendations now continue without alias expansion when the optional ingredient alias catalog is unavailable.
- Server-side failures now record sanitized request and error metadata in private runtime logs while keeping generic 500 responses for clients.
- Refresh requests without a session cookie now return `401` before opening a database query.
- Manual ingredient sync now uses the authenticated API request path so a 401 can refresh the session and retry once.
- Recipe recommendations no longer count recipes as "buy one more" when no core ingredients are currently owned.
- Recommendation scoring now treats owned pantry staples as available ingredients.
- Fallback and syncing state now surface clearer user feedback in the UI.
- Session restore now keeps authenticated local fallback available during transient server failures.
- Sync reconciliation now drops stale clean cache entries and preserves newer local cache entries as pending updates.
- Ingredient deletion no longer triggers an automatic server delete; deleted items are removed from the server only on the next manual replace sync.

## [1.5.0] - 2026-04-03
### Added
- Express + Prisma backend scaffold with ingredient CRUD and recipe recommendation routes.
- Pantry staple ownership UI and shopping list panel.
- Import correction learning for repeated OCR imports.
- Stronger local-first ingredient workflows and backend persistence fallback.

### Changed
- Enhanced recipe recommendation flows and grouping behavior.
- Simplified shopping list behavior and pantry state handling.
- Simplified OCR retry behavior and expanded import normalization knowledge.

### Documentation
- Improved README presentation and added live demo-oriented polish.

## [1.0.0] - 2026-03-31
### Added
- Initial FridgeMate MVP.
- Ingredient CRUD, expiry tracking, filtering, sorting, and IndexedDB persistence.
- First-pass local recipe recommendation flow.
