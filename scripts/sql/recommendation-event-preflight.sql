-- Aggregate-only preflight. This query returns counts and never returns event or user rows.
WITH classified AS (
  SELECT
    CASE
      WHEN "recipeId" ~* '^catalog:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 'catalog_namespaced'
      WHEN "recipeId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN 'bare_uuid'
      WHEN "recipeId" LIKE 'local:%' THEN 'local'
      ELSE 'unmatched'
    END AS key_type,
    CASE
      WHEN "recipeId" ~* '^catalog:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN substring("recipeId" FROM 9)::UUID
      WHEN "recipeId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN "recipeId"::UUID
      ELSE NULL
    END AS candidate_catalog_id
  FROM "RecommendationEvent"
)
SELECT
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE key_type = 'catalog_namespaced') AS catalog_namespaced,
  COUNT(*) FILTER (WHERE key_type = 'bare_uuid') AS bare_uuid,
  COUNT(*) FILTER (WHERE key_type = 'local') AS local_key,
  COUNT(*) FILTER (WHERE key_type = 'unmatched') AS unmatched,
  COUNT(recipe."id") AS safely_linkable_catalog
FROM classified
LEFT JOIN "recipes" AS recipe ON recipe."id" = classified.candidate_catalog_id;
