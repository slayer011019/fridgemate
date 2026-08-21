# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Added a Cloudflare Workers Express entry point, Prisma PostgreSQL driver adapter support for Hyperdrive, and optional Workers KV auth security storage.
- Added disabled-by-default AdSense head injection, responsive ad units, generated `ads.txt`, and a public privacy information page.
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
