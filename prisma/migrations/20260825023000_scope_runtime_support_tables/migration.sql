REVOKE DELETE ON TABLE "User", "AuthSession" FROM fridgemate_app;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fridgemate_app_user_select ON "User";
DROP POLICY IF EXISTS fridgemate_app_user_insert ON "User";
DROP POLICY IF EXISTS fridgemate_app_user_update ON "User";
CREATE POLICY fridgemate_app_user_select
  ON "User"
  FOR SELECT
  TO fridgemate_app
  USING (
    "id" = NULLIF(current_setting('app.current_user_id', true), '')
    OR "emailNormalized" = NULLIF(current_setting('app.current_auth_email', true), '')
  );
CREATE POLICY fridgemate_app_user_insert
  ON "User"
  FOR INSERT
  TO fridgemate_app
  WITH CHECK (
    "emailNormalized" = NULLIF(current_setting('app.current_auth_email', true), '')
  );
CREATE POLICY fridgemate_app_user_update
  ON "User"
  FOR UPDATE
  TO fridgemate_app
  USING (
    "id" = NULLIF(current_setting('app.current_user_id', true), '')
    OR "emailNormalized" = NULLIF(current_setting('app.current_auth_email', true), '')
  )
  WITH CHECK (
    "id" = NULLIF(current_setting('app.current_user_id', true), '')
    OR "emailNormalized" = NULLIF(current_setting('app.current_auth_email', true), '')
  );

ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fridgemate_app_auth_session_select ON "AuthSession";
DROP POLICY IF EXISTS fridgemate_app_auth_session_insert ON "AuthSession";
DROP POLICY IF EXISTS fridgemate_app_auth_session_update ON "AuthSession";
CREATE POLICY fridgemate_app_auth_session_select
  ON "AuthSession"
  FOR SELECT
  TO fridgemate_app
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    OR "tokenHash" = NULLIF(current_setting('app.current_refresh_token_hash', true), '')
  );
CREATE POLICY fridgemate_app_auth_session_insert
  ON "AuthSession"
  FOR INSERT
  TO fridgemate_app
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );
CREATE POLICY fridgemate_app_auth_session_update
  ON "AuthSession"
  FOR UPDATE
  TO fridgemate_app
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    OR "tokenHash" = NULLIF(current_setting('app.current_refresh_token_hash', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );

ALTER TABLE "RecommendationEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecommendationEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fridgemate_app_recommendation_event_select ON "RecommendationEvent";
DROP POLICY IF EXISTS fridgemate_app_recommendation_event_insert ON "RecommendationEvent";
CREATE POLICY fridgemate_app_recommendation_event_select
  ON "RecommendationEvent"
  FOR SELECT
  TO fridgemate_app
  USING (
    "userId" IS NULL
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );
CREATE POLICY fridgemate_app_recommendation_event_insert
  ON "RecommendationEvent"
  FOR INSERT
  TO fridgemate_app
  WITH CHECK (
    "userId" IS NULL
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );

DROP POLICY IF EXISTS fridgemate_app_recipe_select ON recipes;
CREATE POLICY fridgemate_app_recipe_select
  ON recipes
  FOR SELECT
  TO fridgemate_app
  USING (true);

DROP POLICY IF EXISTS fridgemate_app_recipe_ingredient_select ON recipe_ingredients;
CREATE POLICY fridgemate_app_recipe_ingredient_select
  ON recipe_ingredients
  FOR SELECT
  TO fridgemate_app
  USING (true);
