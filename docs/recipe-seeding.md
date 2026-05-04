# MFDS Recipe Seeding

FridgeMate can seed public recipe source data from the Food Safety Korea data service into a Supabase `recipes` table, then split the seeded `ingredients_text` into a Supabase `recipe_ingredients` table. This is a direct Supabase lab/import path. It does not use the Express + Prisma recipe models and does not change the current recommendation UI.

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

The scripts read `.env` automatically through Node's `--env-file=.env` flag.

## Create the Table

Run [docs/sql/create_recipes_table.sql](sql/create_recipes_table.sql) in the Supabase SQL editor or through your preferred database migration workflow.

The table stores:

- `external_id` from `RCP_SEQ`
- recipe name, cooking method, dish type, nutrition fields, image URLs, raw ingredients text, sodium tip
- `steps` as JSON from `MANUAL01` through `MANUAL20` and `MANUAL_IMG01` through `MANUAL_IMG20`
- `raw` as the original OpenAPI row

RLS is enabled. Anonymous and authenticated users can select public recipe rows. Insert, update, and delete policies are not created for client roles, so seeding should use the Supabase service role key from the Node script.

To split recipe ingredients, also run [../supabase/sql/create_recipe_ingredients.sql](../supabase/sql/create_recipe_ingredients.sql). That table is keyed by `(recipe_id, raw_text)` so repeated parser runs can upsert the same raw ingredient chunks without duplicating rows.

## Run the Seed

```bash
npm run seed:recipes
npm run seed:recipes -- --dry-run --limit=10
npm run seed:recipes -- --all
```

The script fetches `COOKRCP01` pages sequentially using `startIdx` and `endIdx`, maps rows into the `recipes` table shape, and upserts by `external_id` so repeated runs do not duplicate recipes. By default it imports 10 rows. Use `--limit=N` for a bounded import, `--all` for the full source, and `--dry-run` to fetch and map without writing to Supabase.

Progress is logged per batch. Missing required environment variables, Food Safety Korea API errors, invalid JSON, HTTP failures, and Supabase upsert failures stop the script with a clear message.

After completion, open Supabase Table Editor and inspect the `recipes` table. A successful row should have `source = 'MFDS_COOKRCP01'`, a non-empty `external_id`, `name`, `ingredients_text`, and `steps` JSON when manual instructions are available.

## Split Ingredients

After seeding recipes and creating `recipe_ingredients`, run:

```bash
npm run parse:recipe-ingredients
npm run parse:recipe-ingredients -- --dry-run --limit=10
npm run parse:recipe-ingredients -- --all
```

The parser reads `recipes.id`, `recipes.name`, and `recipes.ingredients_text`, then upserts normalized chunks into `recipe_ingredients`. It stores the raw chunk, raw name, normalized name, canonical name, amount, unit, confidence, and source. Low-confidence rows are logged for manual review.

This path intentionally targets the direct Supabase table shape documented here. The Prisma server models use different column names such as `source_recipe_id`, `raw_ingredients_text`, `section`, and `amount_value`; keep those paths separate until the v2 recommendation integration work explicitly joins them.

## Export Parser Training Data

To prepare for a future ML-assisted parser, export JSONL training examples from the seeded recipe text and current rule parser output:

```bash
npm run export:recipe-parser-training
npm run export:recipe-parser-training -- --limit=1000
npm run export:recipe-parser-training -- --all
npm run export:recipe-parser-training -- --low-confidence-only --output=data/training/review-needed.jsonl
```

The default output is `data/training/recipe-parser-examples.jsonl`, which is ignored by Git. Each JSONL row includes the raw ingredient chunk, full recipe ingredient context, parser label, confidence metadata, and `needsReview`. Treat these rows as baseline labels for review and future model training, not as hand-verified ground truth.

## Out of Scope

This seed does not add:

- pgvector columns or embeddings
- recommendation UI changes
- OCR taxonomy or classifier work

Those belong in a later v2 recipe recommendation and search milestone.
