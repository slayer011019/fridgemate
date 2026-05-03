# GEMINI.md

## Project Overview

FridgeMate is a guest-first pantry and refrigerator management web app.

The app helps users manage ingredients they already have at home, import ingredients from shopping screenshots or receipt-like images through OCR-assisted parsing, and later expand into recipe recommendations based on available ingredients.

The current priority is **v1 release stabilization**, not adding more AI features.

---

## Current v1 Goal

The v1 goal is to make FridgeMate behave like a deployable, stable MVP.

Core v1 scope:

- Guest-first ingredient management
- Account authentication
- Manual sync between local data and server data
- OCR-assisted ingredient import
- Stable deployment through Vercel, Railway, and Supabase
- Clear documentation for QA and deployment
- Recipe database seeding completed as a v2 foundation, not as an active v1 feature

v1 should prioritize reliability over new functionality.

---

## Important Product Decisions

### 1. Manual Sync Only

FridgeMate should **not automatically sync every ingredient add/edit/delete action**.

The intended behavior is:

- Users can add, edit, and delete ingredients locally.
- Server sync happens only when the user explicitly clicks the sync button in the account tab.
- Ingredient deletion should not immediately trigger server sync.
- Deleted items should not reappear after the next sync.
- Sync behavior should be easy to reason about and documented.

### 2. OCR Is Useful, But Not the Current Priority

OCR parsing exists and should not be broken.

However, the current v1 stabilization phase should not expand:

- OCR taxonomy
- large-scale canonical classifier
- pgvector-based ingredient matching
- recipe recommendation UI
- recipe ingredient vector search

Those are v2 features.

### 3. Recipe Data Is v2 Foundation

MFDS recipe seed data has been added to Supabase.

Source:

- Ministry of Food and Drug Safety
- Service ID: `COOKRCP01`
- Dataset: 조리식품의 레시피 DB

This data is currently only a foundation for future recipe recommendation.

Do not implement recipe recommendation UI in v1 unless explicitly requested.

v2 may include:

- `recipe_ingredients` parsing
- ingredient normalization
- pgvector embeddings
- fridge ingredient to recipe matching
- personalized recipe recommendations

---

## Architecture Summary

### Frontend

The frontend is a Vite + React application.

Expected frontend responsibilities:

- Manage guest/local ingredient state
- Provide ingredient add/edit/delete UI
- Provide account/auth UI
- Provide manual sync trigger
- Provide OCR import UI
- Display clear error states
- Avoid exposing secret keys

Frontend environment variables should only use safe public variables such as:

```env
VITE_API_BASE_URL=
```

Do not expose:

```env
SUPABASE_SERVICE_ROLE_KEY=
FOODSAFETY_API_KEY=
DATABASE_URL=
```

Never add service role keys to Vite environment variables.

### Backend

The backend is responsible for:

- Authentication API
- Session refresh
- Ingredient API
- Manual sync handling
- User-scoped server persistence
- Production CORS/cookie behavior

Auth-related requests should support:

- `credentials: 'include'`
- Session refresh when needed
- 401/403 handling
- Retry once after refresh where appropriate

### Supabase

Supabase is used for data persistence.

Current known tables include project-specific user/ingredient/auth-related tables and the newly added `recipes` table.

The `recipes` table stores MFDS recipe seed data.

The `recipes` table is public-readable, but insert/update/delete should not be available from the frontend.

Recipe seeding should only be done through a Node/local/server script using a service role key.

---

## Security Rules

Do not commit `.env`.

Ensure `.gitignore` includes:

```gitignore
.env
.env.local
.env.*.local
```

Do not expose these values in frontend code:

```env
SUPABASE_SERVICE_ROLE_KEY=
FOODSAFETY_API_KEY=
DATABASE_URL=
```

Do not create variables like:

```env
VITE_SUPABASE_SERVICE_ROLE_KEY=
VITE_FOODSAFETY_API_KEY=
```

Service role keys must only be used in Node scripts or trusted server environments.

---

## Current Stabilization Checklist

When making changes, prioritize this order:

1. CI / lint / test / build health
2. Authentication flow
3. Session refresh and 401/403 handling
4. Guest to logged-in transition
5. Manual sync behavior
6. Delete sync conflict prevention
7. Deployment environment validation
8. E2E or QA scenario coverage
9. README / docs consistency

Do not add new major product features until this stabilization work is complete.

---

## Testing Expectations

Before considering a task complete, run the available checks:

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

If one of these commands does not exist, inspect `package.json` and use the closest available equivalent.

Do not claim verification succeeded unless the command was actually run.

---

## Manual QA Scenario

Use this as the core v1 release smoke test:

1. Open the deployed app through the custom domain.
2. Add ingredients as a guest.
3. Sign up or log in.
4. Go to the account tab.
5. Click the manual sync button.
6. Refresh the page.
7. Confirm ingredients remain.
8. Delete an ingredient.
9. Click manual sync again.
10. Refresh the page.
11. Confirm the deleted ingredient does not reappear.
12. Log out.
13. Log in again.
14. Confirm server data is restored correctly.

Key things to verify:

- Auth cookie persists after refresh.
- API requests include credentials.
- 401 triggers refresh/retry where intended.
- CORS allows the production frontend domain.
- Cookie settings work on the custom domain.
- Deleted ingredients do not come back after sync.

---

## Deployment Notes

### Frontend

- Hosted on Vercel
- Custom domain connected to frontend
- `VITE_API_BASE_URL` should point to the production backend API

### Backend

- Hosted on Railway
- Should use correct production environment variables
- Should allow only the correct frontend origin through CORS
- Should use secure cookies in production

### Supabase

- Stores persistent data
- Service role key must only exist in secure environments
- Recipe seed data exists as a future recommendation foundation

---

## MFDS Recipe Seed Notes

MFDS recipe data comes from:

```txt
식품의약품안전처_조리식품의 레시피 DB
Service ID: COOKRCP01
```

Request format:

```txt
http://openapi.foodsafetykorea.go.kr/api/{FOODSAFETY_API_KEY}/COOKRCP01/json/{startIdx}/{endIdx}
```

Important fields:

- `RCP_SEQ`: external recipe ID
- `RCP_NM`: recipe name
- `RCP_WAY2`: cooking method
- `RCP_PAT2`: dish type
- `INFO_WGT`: serving weight
- `INFO_ENG`: calories
- `INFO_CAR`: carbohydrate
- `INFO_PRO`: protein
- `INFO_FAT`: fat
- `INFO_NA`: sodium
- `HASH_TAG`: hash tag
- `ATT_FILE_NO_MAIN`: small image
- `ATT_FILE_NO_MK`: large image
- `RCP_PARTS_DTLS`: ingredient text
- `MANUAL01` ~ `MANUAL20`: cooking steps
- `MANUAL_IMG01` ~ `MANUAL_IMG20`: step images
- `RCP_NA_TIP`: sodium reduction tip

Current status:

- Recipe seed foundation exists.
- Do not build recommendation UI during v1 stabilization.
- Do not add pgvector embeddings unless explicitly requested.
- Do not split `recipe_ingredients` unless explicitly requested.

---

## Coding Guidelines

Prefer small, low-risk patches.

Avoid large rewrites.

Preserve existing app behavior unless the task explicitly asks to change it.

When touching sync/auth code:

- Keep behavior easy to reason about.
- Avoid hidden automatic sync.
- Handle errors clearly.
- Avoid swallowing failed requests silently.
- Keep local/server state transitions explicit.

When touching OCR code:

- Preserve existing parser behavior.
- Do not introduce large taxonomy/classifier changes during v1 stabilization.
- Keep OCR improvements isolated and testable.

When touching docs:

- Keep v1 and v2 scope clearly separated.
- Be honest about current limitations.
- Do not claim recipe recommendation exists if only recipe data seeding exists.

---

## Known v1 Limitations

It is acceptable for v1 to have these limitations documented:

- OCR accuracy depends on screenshot quality and source layout.
- Recipe recommendation UI is not part of v1.
- Recipe data is seeded as a future foundation only.
- Actual production cookie/CORS behavior must be verified after deployment.
- Sync is manual by design.
- Conflict resolution is intentionally simple for v1.

---

## Suggested Commit Style

Use clear, practical commit messages:

```txt
Stabilize v1 release flow
Document MFDS recipe seeding
Fix manual sync auth retry
Update deployment checklist
Add v1 release QA checklist
```

Avoid mixing unrelated changes in one commit.

---

## What Not To Do Unless Explicitly Asked

Do not:

- Add pgvector recommendation logic
- Add recipe recommendation UI
- Expand OCR taxonomy heavily
- Move service role keys into frontend code
- Add automatic sync after every ingredient change
- Commit `.env`
- Rewrite the app architecture
- Replace the existing parser without preserving behavior
- Claim production QA passed without testing the deployed app
