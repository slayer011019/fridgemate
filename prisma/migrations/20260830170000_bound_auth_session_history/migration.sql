-- Session rotation retains only a bounded, tenant-scoped history. Runtime cleanup
-- runs inside withUserDatabaseScope, so it needs delete permission and a matching
-- RLS policy without broadening access to any other account's sessions.
GRANT DELETE ON TABLE "AuthSession" TO fridgemate_app;

DROP POLICY IF EXISTS fridgemate_app_auth_session_delete ON "AuthSession";
CREATE POLICY fridgemate_app_auth_session_delete
  ON "AuthSession"
  FOR DELETE
  TO fridgemate_app
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );

-- Bring existing accounts under the same bounds before the runtime starts
-- maintaining them lazily. Active sessions are prioritized, newest first.
WITH classified_sessions AS (
  SELECT
    "id",
    "userId",
    ("revokedAt" IS NULL AND "expiresAt" > now()) AS is_active,
    row_number() OVER (
      PARTITION BY "userId", ("revokedAt" IS NULL AND "expiresAt" > now())
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS state_rank
  FROM "AuthSession"
),
eligible_sessions AS (
  SELECT *
  FROM classified_sessions
  WHERE NOT is_active OR state_rank <= 8
),
ranked_history AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "userId"
      ORDER BY is_active DESC, state_rank ASC, "id" DESC
    ) AS history_rank
  FROM eligible_sessions
),
sessions_to_delete AS (
  SELECT "id"
  FROM classified_sessions
  WHERE is_active AND state_rank > 8
  UNION
  SELECT "id"
  FROM ranked_history
  WHERE history_rank > 24
)
DELETE FROM "AuthSession"
WHERE "id" IN (SELECT "id" FROM sessions_to_delete);
