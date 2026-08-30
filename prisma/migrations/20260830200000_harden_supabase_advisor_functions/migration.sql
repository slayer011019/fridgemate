-- Harden the repository-owned recipe trigger function when it is present.
-- Clean Prisma databases do not create this function; Supabase recipe imports may
-- have created it from docs/sql/create_recipes_table.sql.
DO $migration$
DECLARE
  function_owner pg_catalog.oid;
  database_role pg_catalog.text;
BEGIN
  SELECT target_proc.proowner
  INTO function_owner
  FROM pg_catalog.pg_proc AS target_proc
  INNER JOIN pg_catalog.pg_namespace AS target_namespace
    ON target_namespace.oid = target_proc.pronamespace
  WHERE target_namespace.nspname = 'public'
    AND target_proc.proname = 'set_recipes_updated_at'
    AND target_proc.prokind = 'f'
    AND target_proc.pronargs = 0
    AND target_proc.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype;

  IF function_owner IS NULL THEN
    RAISE NOTICE 'public.set_recipes_updated_at() is absent; skipping repository trigger hardening';
  ELSIF NOT pg_catalog.pg_has_role(current_user, function_owner, 'USAGE') THEN
    RAISE NOTICE 'public.set_recipes_updated_at() is owned by %, not the migration role; skipping repository trigger hardening',
      pg_catalog.pg_get_userbyid(function_owner);
  ELSE
    EXECUTE $function_sql$
      CREATE OR REPLACE FUNCTION public.set_recipes_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY INVOKER
      SET search_path = pg_catalog
      AS $function_body$
      BEGIN
        NEW.updated_at = pg_catalog.now();
        RETURN NEW;
      END;
      $function_body$;
    $function_sql$;

    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_recipes_updated_at() FROM PUBLIC';

    FOREACH database_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_roles
        WHERE rolname = database_role
      ) THEN
        EXECUTE pg_catalog.format(
          'REVOKE EXECUTE ON FUNCTION public.set_recipes_updated_at() FROM %I',
          database_role
        );
      END IF;
    END LOOP;
  END IF;
END
$migration$;

-- public.rls_auto_enable() is a Supabase-managed SECURITY DEFINER event-trigger
-- function. Preserve its owner, body, and existing fixed search_path. Only remove
-- direct call access when the migration role already inherits the owner's rights.
DO $migration$
DECLARE
  function_owner pg_catalog.oid;
  database_role pg_catalog.text;
BEGIN
  SELECT target_proc.proowner
  INTO function_owner
  FROM pg_catalog.pg_proc AS target_proc
  INNER JOIN pg_catalog.pg_namespace AS target_namespace
    ON target_namespace.oid = target_proc.pronamespace
  WHERE target_namespace.nspname = 'public'
    AND target_proc.proname = 'rls_auto_enable'
    AND target_proc.prokind = 'f'
    AND target_proc.pronargs = 0
    AND target_proc.prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype
    AND target_proc.prosecdef;

  IF function_owner IS NULL THEN
    RAISE NOTICE 'Expected SECURITY DEFINER event-trigger function public.rls_auto_enable() is absent; skipping managed-function grants';
  ELSIF NOT pg_catalog.pg_has_role(current_user, function_owner, 'USAGE') THEN
    RAISE NOTICE 'public.rls_auto_enable() is owned by %, not the migration role; verify its EXECUTE grants manually',
      pg_catalog.pg_get_userbyid(function_owner);
  ELSE
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';

    FOREACH database_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_roles
        WHERE rolname = database_role
      ) THEN
        EXECUTE pg_catalog.format(
          'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM %I',
          database_role
        );
      END IF;
    END LOOP;
  END IF;
END
$migration$;

-- Deliberately do not run ALTER EXTENSION vector SET SCHEMA here. Existing
-- application SQL uses unqualified vector casts and operator classes, so moving
-- pgvector requires an application-wide qualification/search_path migration and
-- staged query/index validation first.
