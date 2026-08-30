-- Read-only verification for the Supabase function hardening migration.
-- Run after `prisma migrate deploy`, then rerun Supabase Security Advisor.

select
  target_namespace.nspname as function_schema,
  target_proc.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(target_proc.oid) as identity_arguments,
  pg_catalog.pg_get_userbyid(target_proc.proowner) as function_owner,
  target_proc.prosecdef as security_definer,
  target_proc.proconfig as function_settings,
  target_proc.proacl as explicit_acl
from pg_catalog.pg_proc as target_proc
inner join pg_catalog.pg_namespace as target_namespace
  on target_namespace.oid = target_proc.pronamespace
where target_namespace.nspname = 'public'
  and target_proc.proname in ('set_recipes_updated_at', 'rls_auto_enable')
order by target_proc.proname;

select
  target_proc.oid::pg_catalog.regprocedure as function_name,
  coalesce(grantee_role.rolname, 'PUBLIC') as grantee,
  function_acl.privilege_type,
  function_acl.is_grantable
from pg_catalog.pg_proc as target_proc
inner join pg_catalog.pg_namespace as target_namespace
  on target_namespace.oid = target_proc.pronamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(
    target_proc.proacl,
    pg_catalog.acldefault('f', target_proc.proowner)
  )
) as function_acl
left join pg_catalog.pg_roles as grantee_role
  on grantee_role.oid = function_acl.grantee
where target_namespace.nspname = 'public'
  and target_proc.proname in ('set_recipes_updated_at', 'rls_auto_enable')
  and target_proc.pronargs = 0
order by target_proc.proname, grantee;

select
  database_role.rolname as database_role,
  target_proc.oid::pg_catalog.regprocedure as function_name,
  pg_catalog.has_function_privilege(
    database_role.oid,
    target_proc.oid,
    'EXECUTE'
  ) as can_execute
from pg_catalog.pg_proc as target_proc
inner join pg_catalog.pg_namespace as target_namespace
  on target_namespace.oid = target_proc.pronamespace
cross join pg_catalog.pg_roles as database_role
where target_namespace.nspname = 'public'
  and target_proc.proname in ('set_recipes_updated_at', 'rls_auto_enable')
  and target_proc.pronargs = 0
  and database_role.rolname in ('anon', 'authenticated')
order by target_proc.proname, database_role.rolname;

-- If either role still has EXECUTE, inspect ownership above. Run the matching
-- REVOKE as that function's owner (normally postgres for rls_auto_enable), rather
-- than changing a platform-managed function's owner or definition.
--
-- revoke execute on function public.set_recipes_updated_at() from public, anon, authenticated;
-- revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

select
  target_extension.extname as extension_name,
  extension_namespace.nspname as extension_schema,
  target_extension.extversion as extension_version,
  pg_catalog.pg_get_userbyid(target_extension.extowner) as extension_owner,
  pg_catalog.current_setting('search_path') as session_search_path
from pg_catalog.pg_extension as target_extension
inner join pg_catalog.pg_namespace as extension_namespace
  on extension_namespace.oid = target_extension.extnamespace
where target_extension.extname = 'vector';

select
  table_namespace.nspname as table_schema,
  table_class.relname as table_name,
  table_attribute.attname as column_name,
  type_namespace.nspname as type_schema,
  pg_catalog.format_type(table_attribute.atttypid, table_attribute.atttypmod) as formatted_type
from pg_catalog.pg_attribute as table_attribute
inner join pg_catalog.pg_class as table_class
  on table_class.oid = table_attribute.attrelid
inner join pg_catalog.pg_namespace as table_namespace
  on table_namespace.oid = table_class.relnamespace
inner join pg_catalog.pg_type as column_type
  on column_type.oid = table_attribute.atttypid
inner join pg_catalog.pg_namespace as type_namespace
  on type_namespace.oid = column_type.typnamespace
where column_type.typname = 'vector'
  and table_attribute.attnum > 0
  and not table_attribute.attisdropped
order by table_namespace.nspname, table_class.relname, table_attribute.attnum;

select
  index_catalog.schemaname as table_schema,
  index_catalog.tablename as table_name,
  index_catalog.indexname as index_name,
  index_catalog.indexdef as index_definition
from pg_catalog.pg_indexes as index_catalog
where index_catalog.indexdef ilike '% using hnsw %'
   or index_catalog.indexdef ilike '% vector_cosine_ops%'
   or index_catalog.indexdef ilike '% vector_ip_ops%'
   or index_catalog.indexdef ilike '% vector_l2_ops%'
order by index_catalog.schemaname, index_catalog.tablename, index_catalog.indexname;

-- Do not move vector from public until every application cast/type/operator-class
-- reference is schema-qualified (or a deliberately tested connection search_path
-- includes the destination schema), and both vector queries and HNSW indexes have
-- been validated in staging.
