GRANT DELETE ON TABLE "User", "RecommendationEvent" TO fridgemate_app;

DROP POLICY IF EXISTS fridgemate_app_user_delete ON "User";
CREATE POLICY fridgemate_app_user_delete
  ON "User"
  FOR DELETE
  TO fridgemate_app
  USING (
    "id" = NULLIF(current_setting('app.current_user_id', true), '')
  );

DROP POLICY IF EXISTS fridgemate_app_recommendation_event_delete ON "RecommendationEvent";
CREATE POLICY fridgemate_app_recommendation_event_delete
  ON "RecommendationEvent"
  FOR DELETE
  TO fridgemate_app
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );
