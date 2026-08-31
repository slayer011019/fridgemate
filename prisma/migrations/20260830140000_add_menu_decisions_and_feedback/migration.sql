ALTER TABLE "RecommendationEvent"
  ADD COLUMN "clientEventId" TEXT,
  ADD COLUMN "catalogRecipeId" UUID;

-- Link only recipe keys that are both syntactically valid and present in the catalog.
WITH normalized_recipe_keys AS (
  SELECT
    "id",
    CASE
      WHEN "recipeId" ~* '^catalog:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN substring("recipeId" FROM 9)::UUID
      WHEN "recipeId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN "recipeId"::UUID
      ELSE NULL
    END AS catalog_recipe_id
  FROM "RecommendationEvent"
)
UPDATE "RecommendationEvent" AS event
SET "catalogRecipeId" = recipe."id"
FROM normalized_recipe_keys AS normalized
JOIN "recipes" AS recipe ON recipe."id" = normalized.catalog_recipe_id
WHERE event."id" = normalized."id";

CREATE UNIQUE INDEX "RecommendationEvent_clientEventId_key"
  ON "RecommendationEvent"("clientEventId");
CREATE INDEX "RecommendationEvent_catalogRecipeId_idx"
  ON "RecommendationEvent"("catalogRecipeId");

ALTER TABLE "RecommendationEvent"
  ADD CONSTRAINT "RecommendationEvent_catalogRecipeId_fkey"
  FOREIGN KEY ("catalogRecipeId") REFERENCES "recipes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MenuDecision" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "decisionDate" DATE NOT NULL,
  "recipeKey" TEXT NOT NULL,
  "catalogRecipeId" UUID,
  "recipeName" TEXT NOT NULL,
  "recommendationSource" TEXT,
  "status" TEXT NOT NULL DEFAULT 'selected',
  "selectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "MenuDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuDecision_userId_decisionDate_key"
  ON "MenuDecision"("userId", "decisionDate");
CREATE UNIQUE INDEX "MenuDecision_userId_clientId_key"
  ON "MenuDecision"("userId", "clientId");
CREATE INDEX "MenuDecision_userId_status_idx"
  ON "MenuDecision"("userId", "status");
CREATE INDEX "MenuDecision_catalogRecipeId_idx"
  ON "MenuDecision"("catalogRecipeId");

ALTER TABLE "MenuDecision"
  ADD CONSTRAINT "MenuDecision_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuDecision"
  ADD CONSTRAINT "MenuDecision_catalogRecipeId_fkey"
  FOREIGN KEY ("catalogRecipeId") REFERENCES "recipes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

REVOKE ALL ON TABLE "MenuDecision" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MenuDecision" TO fridgemate_app;
ALTER TABLE "MenuDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuDecision" FORCE ROW LEVEL SECURITY;
CREATE POLICY menu_decision_tenant_isolation
  ON "MenuDecision"
  FOR ALL
  TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
