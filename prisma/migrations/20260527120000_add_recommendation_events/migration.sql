CREATE TABLE "RecommendationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "recipeId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sessionId" TEXT,
  "rank" INTEGER,
  "score" DOUBLE PRECISION,
  "matchRate" DOUBLE PRECISION,
  "missingIngredientCount" INTEGER,
  "urgentMatchCount" INTEGER,
  "canMakeNow" BOOLEAN,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecommendationEvent_userId_idx" ON "RecommendationEvent"("userId");
CREATE INDEX "RecommendationEvent_recipeId_idx" ON "RecommendationEvent"("recipeId");
CREATE INDEX "RecommendationEvent_eventType_idx" ON "RecommendationEvent"("eventType");
CREATE INDEX "RecommendationEvent_createdAt_idx" ON "RecommendationEvent"("createdAt");

ALTER TABLE "RecommendationEvent"
  ADD CONSTRAINT "RecommendationEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
