# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- GitHub Actions CI workflow for lint, test, and build jobs with artifact upload.
- Vitest coverage across recommendation logic, OCR parsing, IndexedDB, import learning, and `useIngredients`.
- Global connection status feedback with online/offline and fallback notices.
- Sync strategy scaffold documenting the current `last-write-wins` approach.
- Playwright E2E scaffolding for local-only CRUD, auth, API fallback, and OCR review flows.
- Added `docs/BUSINESS_ROADMAP.md` to document product positioning, monetization, KPI focus, and exit options.
- Added `docs/ANALYTICS_EVENTS.md` to define activation, OCR, retention, recommendation, and monetization event tracking.
- Added a lightweight analytics layer with session, auth, ingredient, OCR, and recommendation instrumentation hooks.

### Changed
- Updated README and AGENTS documentation to match the current local-first + optional backend architecture.
- Mirrored successful ingredient API reads and writes back into IndexedDB for fresher fallback data.
- Routed pantry-owned staples into recommendation scoring instead of keeping them UI-only.
- Tightened deployment guidance around environment variables, smoke checks, and core journey verification.
- Linked the business roadmap from the README so product and go-to-market direction are easier to find.
- Linked the analytics event spec from the README so KPI instrumentation has a documented source of truth.
- Hardened auth handling with normalized email uniqueness, shorter JWT defaults, logout token revocation, and rate-limited signup/login.
- Added Redis-backed auth throttling and token revocation with in-memory fallback for single-instance development.
- Auth security storage now falls back to memory if Redis becomes unavailable during runtime.
- Switched auth to `httpOnly` access/refresh cookies with refresh-token rotation and frontend user-only session persistence.
- Polished the app UI with a denser header, shorter page heroes, dashboard hierarchy cleanup, ingredient search, and more action-focused ingredient cards.
- Simplified recipe, OCR import, and auth screen copy so the next step is clearer on mobile and desktop.

### Fixed
- Recommendation scoring now treats owned pantry staples as available ingredients.
- Fallback and syncing state now surface clearer user feedback in the UI.
- Session restore now keeps authenticated local fallback available during transient server failures.
- Sync reconciliation now drops stale clean cache entries and preserves newer local cache entries as pending updates.

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
