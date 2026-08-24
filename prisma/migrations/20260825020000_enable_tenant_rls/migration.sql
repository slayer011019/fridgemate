DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fridgemate_app') THEN
    CREATE ROLE fridgemate_app
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'fridgemate_app'
      AND (
        rolcanlogin
        OR rolsuper
        OR rolcreatedb
        OR rolcreaterole
        OR rolreplication
        OR rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION
      'fridgemate_app must be a NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS role';
  END IF;
END
$$;

REVOKE ALL ON TABLE "Ingredient", "ImportCorrection" FROM PUBLIC;

DO $$
DECLARE
  database_role TEXT;
BEGIN
  FOREACH database_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = database_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE "Ingredient", "ImportCorrection" FROM %I',
        database_role
      );
    END IF;
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA public TO fridgemate_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "User",
  "AuthSession",
  "Ingredient",
  "ImportCorrection"
TO fridgemate_app;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['recipes', 'recipe_ingredients', 'ingredients', 'ingredient_aliases']
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO fridgemate_app', table_name);
    END IF;
  END LOOP;
END
$$;

GRANT SELECT, INSERT ON TABLE "RecommendationEvent" TO fridgemate_app;

ALTER TABLE "Ingredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ingredient" FORCE ROW LEVEL SECURITY;
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('Ingredient', 'ImportCorrection')
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.%I',
      policy_record.policyname,
      policy_record.tablename
    );
  END LOOP;
END
$$;

CREATE POLICY ingredient_tenant_isolation
  ON "Ingredient"
  FOR ALL
  TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

ALTER TABLE "ImportCorrection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportCorrection" FORCE ROW LEVEL SECURITY;
CREATE POLICY import_correction_tenant_isolation
  ON "ImportCorrection"
  FOR ALL
  TO fridgemate_app
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
