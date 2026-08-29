ALTER TABLE "recipe_ingredients"
  ADD COLUMN IF NOT EXISTS "ingredient_id" TEXT,
  ADD COLUMN IF NOT EXISTS "section" TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS "amount_text" TEXT,
  ADD COLUMN IF NOT EXISTS "display_amount" TEXT,
  ADD COLUMN IF NOT EXISTS "ingredient_type" TEXT NOT NULL DEFAULT 'main';

ALTER TABLE "recipes"
  ADD COLUMN IF NOT EXISTS "embedding_text" TEXT,
  ADD COLUMN IF NOT EXISTS "embedding_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "raw_recipes" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "source_recipe_id" TEXT NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "raw_ingredients_text" TEXT NOT NULL,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "raw_recipes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "raw_recipes_source_source_recipe_id_key"
  ON "raw_recipes"("source", "source_recipe_id");

CREATE INDEX IF NOT EXISTS "raw_recipes_source_idx"
  ON "raw_recipes"("source");

CREATE UNIQUE INDEX IF NOT EXISTS "recipes_source_external_id_key"
  ON "recipes"("source", "external_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recipe_ingredients_ingredient_id_fkey'
  ) THEN
    ALTER TABLE "recipe_ingredients"
      ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey"
      FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
