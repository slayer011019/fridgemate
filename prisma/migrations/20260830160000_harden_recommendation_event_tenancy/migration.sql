-- Recommendation feedback is authenticated-only. Existing ownerless rows are retained
-- for an explicit retention decision, but strict RLS below quarantines them from the app role.
ALTER TABLE "RecommendationEvent"
  DROP CONSTRAINT IF EXISTS "RecommendationEvent_userId_fkey";
ALTER TABLE "RecommendationEvent"
  ADD CONSTRAINT "RecommendationEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "RecommendationEvent_clientEventId_key";
CREATE UNIQUE INDEX "RecommendationEvent_userId_clientEventId_key"
  ON "RecommendationEvent"("userId", "clientEventId");

REVOKE ALL ON TABLE "RecommendationEvent" FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE "RecommendationEvent" TO fridgemate_app;

ALTER TABLE "RecommendationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecommendationEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fridgemate_app_recommendation_event_select ON "RecommendationEvent";
DROP POLICY IF EXISTS fridgemate_app_recommendation_event_insert ON "RecommendationEvent";
DROP POLICY IF EXISTS fridgemate_app_recommendation_event_delete ON "RecommendationEvent";

CREATE POLICY fridgemate_app_recommendation_event_select
  ON "RecommendationEvent"
  FOR SELECT
  TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

CREATE POLICY fridgemate_app_recommendation_event_insert
  ON "RecommendationEvent"
  FOR INSERT
  TO fridgemate_app
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

CREATE POLICY fridgemate_app_recommendation_event_delete
  ON "RecommendationEvent"
  FOR DELETE
  TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
