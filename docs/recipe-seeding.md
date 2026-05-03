# MFDS Recipe Seeding

FridgeMate can seed public recipe source data from the Food Safety Korea data service into a Supabase `recipes` table. This is only a raw recipe data import path. It does not implement recommendation UI, pgvector embeddings, recipe ingredient normalization, or recipe ranking.

## Source API

- Provider: 식품의약품안전처 데이터활용서비스
- Service name: `COOKRCP01`
- Data type: `json`
- URL format: `http://openapi.foodsafetykorea.go.kr/api/{FOODSAFETY_API_KEY}/COOKRCP01/json/{startIdx}/{endIdx}`
- Example: `http://openapi.foodsafetykorea.go.kr/api/{FOODSAFETY_API_KEY}/COOKRCP01/json/1/100`

Apply for an API key through the Food Safety Korea data service before running the seed.

## Environment Variables

Set these in your local `.env` before running the script:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FOODSAFETY_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` must only be used from local or server-side scripts. Do not prefix it with `VITE_`, do not expose it to browser code, and do not commit real key values.

Optional controls:

```bash
MFDS_RECIPE_PAGE_SIZE=100
MFDS_RECIPE_MAX_ROWS=
```

`MFDS_RECIPE_PAGE_SIZE` defaults to `100` and is capped at `1000`. `MFDS_RECIPE_MAX_ROWS` can be used for a small smoke seed.

## Create the Table

Run [docs/sql/create_recipes_table.sql](sql/create_recipes_table.sql) in the Supabase SQL editor or through your preferred database migration workflow.

The table stores:

- `external_id` from `RCP_SEQ`
- recipe name, cooking method, dish type, nutrition fields, image URLs, raw ingredients text, sodium tip
- `steps` as JSON from `MANUAL01` through `MANUAL20` and `MANUAL_IMG01` through `MANUAL_IMG20`
- `raw` as the original OpenAPI row

RLS is enabled. Anonymous and authenticated users can select public recipe rows. Insert, update, and delete policies are not created for client roles, so seeding should use the Supabase service role key from the Node script.

## Run the Seed

```bash
npm run seed:recipes
```

The script fetches `COOKRCP01` pages sequentially using `startIdx` and `endIdx`, maps rows into the `recipes` table shape, and upserts by `external_id` so repeated runs do not duplicate recipes.

Progress is logged per batch. Missing required environment variables, Food Safety Korea API errors, invalid JSON, HTTP failures, and Supabase upsert failures stop the script with a clear message.

After completion, open Supabase Table Editor and inspect the `recipes` table. A successful row should have `source = 'MFDS_COOKRCP01'`, a non-empty `external_id`, `name`, `ingredients_text`, and `steps` JSON when manual instructions are available.

## Out of Scope

This seed does not add:

- pgvector columns or embeddings
- `recipe_ingredients` splitting
- recommendation UI changes
- OCR taxonomy or classifier work

Those belong in a later v2 recipe recommendation and search milestone.
