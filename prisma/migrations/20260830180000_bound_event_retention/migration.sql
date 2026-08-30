-- Keep this migration to one statement. Prisma sends a multi-statement PostgreSQL
-- migration as one implicit transaction, while CREATE INDEX CONCURRENTLY must run
-- outside a transaction block. Retention cleanup itself remains a separate,
-- explicitly bounded operations task.
CREATE INDEX CONCURRENTLY "RecommendationEvent_createdAt_id_idx"
  ON "RecommendationEvent"("createdAt", "id");
