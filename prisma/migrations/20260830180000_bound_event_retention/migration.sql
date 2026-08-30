-- Retention cleanup walks server-created timestamps and a stable id tie-breaker.
-- Row deletion remains an explicit, bounded operations task rather than a schema-migration side effect.
DROP INDEX IF EXISTS "RecommendationEvent_createdAt_idx";

CREATE INDEX "RecommendationEvent_createdAt_id_idx"
  ON "RecommendationEvent"("createdAt", "id");

CREATE INDEX "ProductEvent_createdAt_id_idx"
  ON "ProductEvent"("createdAt", "id");
