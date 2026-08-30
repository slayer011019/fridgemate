-- Remove the old prefix-only index only after both replacement indexes exist.
-- Keep this as one statement because DROP INDEX CONCURRENTLY cannot run inside a
-- transaction block.
DROP INDEX CONCURRENTLY IF EXISTS "RecommendationEvent_createdAt_idx";
