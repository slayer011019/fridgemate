ALTER TABLE "recipes"
  ADD COLUMN IF NOT EXISTS "home_priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_curated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "meal_role" TEXT,
  ADD COLUMN IF NOT EXISTS "variant_group" TEXT,
  ADD COLUMN IF NOT EXISTS "time_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "difficulty" TEXT;

CREATE INDEX IF NOT EXISTS "recipes_home_priority_idx"
  ON "recipes"("home_priority");
