# AGENTS.md

## Project Overview
FridgeMate is a local-first fridge and pantry tracker with expiry alerts, recipe recommendations, OCR import, and an optional backend mode.

Current milestone: **v1.5**

## Current Scope
Do not treat this repository as strict "v1 only" anymore.

### v1.0 baseline (shipped)
- Ingredient CRUD
- Expiry date tracking with D-day display
- Filtering and sorting
- IndexedDB persistence
- Dashboard summary cards

### v1.5 current (implemented)
- Rule-based recipe recommendation groups
- Pantry staple ownership UI
- Pantry-aware recommendation scoring
- OCR import with review-and-confirm flow
- Import correction learning
- Shopping panel with auto-save
- Optional Express + Prisma backend
- API-first ingredient flow with IndexedDB fallback
- Connection status toast and offline/fallback feedback
- Vitest test suite
- GitHub Actions CI workflow

### Partial / incomplete
- Full deployment setup and production operations
- Authentication
- Full two-way sync and conflict resolution
- Timestamp-based merge using `updatedAt`
- AI recipe suggestions require `ANTHROPIC_API_KEY`
- CI exists, but lint cleanup is still in progress

## Tech Stack
- Frontend: React, Vite, JavaScript, Tailwind CSS
- State: React Context + custom hooks + local component state
- Local storage: IndexedDB
- Backend: Express, Prisma, PostgreSQL
- OCR: Tesseract.js
- Testing: Vitest, React Testing Library, fake-indexeddb

## Architecture Rules
- `VITE_API_URL` enables backend-connected mode.
- If `VITE_API_URL` is empty, the app reads and writes IndexedDB directly.
- If backend mode is enabled, `useIngredients` tries the API first.
- Successful API responses are mirrored into IndexedDB to keep the local cache warm.
- Network failures and 5xx responses fall back to IndexedDB.
- 4xx API errors must surface to the UI and roll back optimistic changes.
- Current sync strategy is `last-write-wins`.
- Planned sync upgrade: compare `updatedAt` timestamps before resolving conflicts.

## Completed Features
- Home dashboard with expiry summary and recommendation preview
- Ingredient list, filters, sorting, consume/restore flow
- Ingredient create/edit form
- OCR import page
- Recipes page with pantry staple controls
- Express health, ingredient CRUD, and recipe recommendation routes
- Optional AI suggestion route with rule-based fallback
- Connection and syncing status feedback
- Automated tests for date, recommendations, import parser, import learning, IndexedDB, and useIngredients

## Not Yet Done
- Deployment to a stable public frontend/backend environment
- Authentication and multi-user support
- Real sync conflict handling with timestamps
- End-to-end browser tests
- Fully green lint and CI quality gate

## Next Milestone
### v2.0
- Deploy frontend and backend
- Finish lint cleanup and make CI reliably green
- Implement timestamp-based sync conflict resolution
- Add authentication
- Expand integration and UI test coverage

## Working Rules
- Use JavaScript, not TypeScript.
- Keep the architecture readable and maintainable for one developer.
- Prefer simple functions and hooks over abstract patterns.
- Avoid unnecessary dependencies.
- Update README and CHANGELOG when behavior or structure changes.
- Run `npm run test:run` and `npm run build` before finishing code changes.

## Done Means
- CRUD works in local-only mode
- CRUD works in backend-connected mode
- IndexedDB fallback works on network and 5xx failures
- Expiry status is visible
- Recipe recommendations are grouped and scored correctly
- Pantry-owned staples affect recommendation scoring
- OCR import uses review-before-save
- Tests and build pass

## Final Response Expectations
At the end of each task, report:
- files created or changed
- what was implemented
- how to run or verify it
- test results
- known limitations
- recommended next steps
