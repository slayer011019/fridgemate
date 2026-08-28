# FridgeMate v1 Stabilization Plan

This plan resets current work around deployable v1 stability. It deliberately pauses new OCR taxonomy, large classifier, pgvector, and recipe recommendation expansion work.

## Current Focus

FridgeMate v1 should be stable enough to deploy and demonstrate as an MVP:

- local-first ingredient CRUD
- expiry tracking
- OCR import with the existing parser and review flow
- auth signup, login, logout, session restore, and session expiry handling
- guest-to-authenticated local import
- account-page manual server sync
- production-ready environment configuration

## Explicitly Paused

Do not start new work in these areas until v1 deploy stability is done:

- large OCR classifier or taxonomy redesign
- broad `CANONICAL_RULES` replacement
- new pgvector tables or embedding workflows
- recipe catalog recommendation expansion beyond the completed MFDS source-data seed
- recipe recommendation ranking overhaul

Keep the existing OCR parser behavior intact:

- `CANONICAL_RULES`
- ingredient aliases
- confidence metadata
- unit and quantity extraction
- duplicate review handling
- receipt and shopping text parsing tests

## Priority Order

1. CI and quality gate
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`
   - `npm run test:e2e` for the core browser path before release

2. Authentication closeout
   - signup
   - login
   - logout
   - session restore through refresh cookies
   - session expiry behavior
   - 401 and 403 handling
   - refresh-session failure UX

3. Guest-to-user transition
   - guest ingredients remain local until the user chooses to import them
   - imported guest ingredients move into the authenticated local scope
   - login must not upload guest ingredients automatically
   - server persistence happens only after the account-page sync button is pressed

4. Manual sync strategy
   - local IndexedDB remains the working copy
   - add, edit, consume, restore, and delete do not write to the server immediately
   - account-page sync sends pending record changes to `POST /api/ingredients/sync`
   - manual pull reads tombstones from `GET /api/ingredients/sync`
   - stable `clientId`, newest-`updatedAt` merge, and persisted pending states provide first-pass conflict handling

5. Deployment readiness
   - Vercel frontend env vars
   - Railway backend env vars
   - Supabase `DATABASE_URL` and `DIRECT_URL`
   - CORS `ALLOWED_ORIGINS`
   - auth cookie `Secure` and `SameSite`
   - production `VITE_API_URL`
   - `GET /health`

6. Minimal E2E coverage
   - add an ingredient before login
   - login
   - import guest ingredient into the authenticated local scope
   - manually sync from the account page
   - reload and confirm data persists
   - delete ingredient locally
   - manually sync deletion
   - expired session or 401 clears auth and returns to login

7. Portfolio docs
   - v1 implemented scope
   - v1 limitations
- v2 expansion plan: pgvector, richer recipe recommendation, taxonomy/classifier hardening, conflict-aware sync
- MFDS `COOKRCP01` seed is documented as v2 foundation data, not as a v1 recommendation UI feature

## Done Criteria

- `npm run lint` passes
- `npm run test:run` passes
- `npm run build` passes
- core E2E auth/manual-sync path passes
- local login, logout, add, edit, delete, and manual sync work
- deployed frontend can call the deployed API with auth cookies
- README separates v1 scope from v2 expansion work
