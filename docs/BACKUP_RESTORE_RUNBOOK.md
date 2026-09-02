# Production Database Backup and Restore Runbook

This runbook covers FridgeMate's Supabase PostgreSQL database. It deliberately separates read-only backup verification from a restore drill because restoring production in place causes downtime and can destroy newer data.

## Current verification status

As of 2026-08-31:

- Production database connectivity and all Prisma migrations are healthy.
- The runtime Worker uses the non-owner `fridgemate_runtime` role through the RLS Hyperdrive configuration.
- Supabase Dashboard was verified directly for project `zninmnfyanyqjaipbyzx` (`FridgeMate`) in AWS `ap-northeast-1` (Tokyo) on the Free plan.
- The project has **no scheduled backups**. The Dashboard explicitly reports that Free Plan projects do not include project backups; therefore there is no current backup retention window or recovery point.
- PITR is **not enabled**. The Dashboard describes it as a Pro Plan add-on starting at USD 100/month.
- **Restore to a New Project** is unavailable on the current plan. The Dashboard requires Pro Plan and physical backups for this operation.
- A cost-controlled fallback is defined in `.github/workflows/database-backup.yml`: a daily full logical dump is encrypted with a recovery-only public key before it is uploaded as a GitHub Actions artifact with 14-day retention. It is not operational until the workflow is merged to the default branch, `BACKUP_DATABASE_URL` is configured, and a manual run succeeds.
- No restore drill is complete until a backup has been restored into a separate project and the checks in this document pass.

This is an operational gap for a production service that stores personal data: a database-loss or destructive-migration incident currently has no Supabase-managed recovery point. Do not describe backups or PITR as enabled until the plan changes and the Dashboard or Management API provides direct evidence.

## Recovery targets

Record the agreed targets before changing the Supabase plan or enabling a paid add-on.

| Target                         | Minimum operational baseline                        | Confirmed value |
| ------------------------------ | --------------------------------------------------- | --------------- |
| Recovery point objective (RPO) | No more than 24 hours for daily backups             | Not confirmed   |
| Recovery time objective (RTO)  | Restore and application verification within 4 hours | Not confirmed   |
| Backup retention               | At least 7 days                                     | Planned: 14-day encrypted logical backups |
| Restore drill frequency        | Quarterly and before a high-risk migration          | Not confirmed   |

PITR is preferred if losing up to one day of user writes is unacceptable. Enabling PITR or creating a restore project can incur charges and requires explicit operator approval.

## 1. Read-only backup verification

Open the source project in **Supabase Dashboard → Database → Backups** and record:

- project reference and region;
- plan and Postgres version;
- daily backup or PITR mode;
- earliest and latest available recovery points;
- retention period;
- most recent successful backup time;
- whether **Restore to a New Project** is available;
- the operator and timestamp that collected the evidence.

If using the Management API, use a personal access token stored outside the repository and call the backup-list endpoint. Never use `SUPABASE_SERVICE_ROLE_KEY` for this operation and never paste a token into an issue, terminal transcript, or committed file.

### Automated Free-plan fallback

The scheduled workflow runs daily at 02:30 Asia/Seoul and retains only encrypted artifacts for 14 days. Configure the repository secret `BACKUP_DATABASE_URL` with the production Supabase owner connection using either the direct endpoint or the session pooler on port 5432. The URL must include `sslmode=require` (or a stricter verification mode), and its project ref must be `zninmnfyanyqjaipbyzx`. Prefer the session pooler when the runner cannot reach Supabase's IPv6 direct endpoint.

The workflow pins `pg_dump` and `pg_restore` to PostgreSQL major 17 to match the current production server. When Supabase upgrades the production PostgreSQL major version, update and verify the workflow client major before relying on the next scheduled backup.

The encryption recipient is public and committed at `.github/backup-recipients.txt`. Its private recovery key must remain outside Git and GitHub:

- local key path: `C:\Users\lee\.fridgemate-backup\recovery_ed25519`;
- expected fingerprint: `SHA256:1vtNDl0iZw56xYLBkZaElRMYM00X5wDvwtqEw66wxpQ`;
- copy the private key once to a separately protected offline location;
- never paste the private key into a GitHub secret, issue, workflow, or chat.

After downloading an artifact, verify the checksum and decryptability without restoring it:

```bash
sha256sum --check fridgemate-*.dump.age.sha256
age --decrypt --identity /secure/path/recovery_ed25519 fridgemate-*.dump.age \
  | pg_restore --list --file=/dev/null
```

This logical backup covers PostgreSQL data and schema, including Supabase database schemas. It does not independently back up Storage objects, project configuration, API keys, Edge Functions, or external Cloudflare configuration. GitHub Actions is also not a substitute for an independent off-provider copy; migrate the encrypted artifacts to a separate object store when a no-card storage target is available.

Before a manual Free-plan logical backup, prepare an existing, empty, encrypted directory outside the repository and run:

```bash
npm run backup:preflight -- --output-dir=ABSOLUTE_ENCRYPTED_DIRECTORY --confirm-database-host=EXACT_DB_HOST --confirm-encrypted-storage
```

The preflight accepts only `BACKUP_DATABASE_URL` or `DIRECT_URL`, requires its project ref to match `SUPABASE_URL`, rejects transaction-pooler port 6543, and verifies that Supabase CLI plus a running Docker engine are already present. It does not create a dump, install software, prove encryption, or transmit data. The encryption flag is an explicit operator assertion and must not be supplied for an unencrypted location.

## 2. Pre-drill safety gate

Before starting a restore:

1. Announce the drill window and confirm that production will not be modified.
2. Select a recovery point before a known, harmless test marker.
3. Confirm the target is a **new project**, not the production project.
4. Record the expected cost and obtain approval before creating the target project.
5. Capture aggregate-only source evidence using the verification queries below.
6. Keep production Worker routes and Hyperdrive bindings unchanged.

Never test a restore by replacing the current production database.

## 3. Restore into a separate project

Use **Restore to a New Project** when the source project and plan support physical backups. Keep the new project in the same region unless the approved recovery design says otherwise.

After the restore finishes:

1. Reconfigure settings that a database restore does not reproduce, including API keys, Auth settings, Edge Functions, Realtime settings, Storage objects, and project-specific extensions/settings.
2. Reset passwords for custom database roles. Supabase physical/daily backups do not preserve custom-role passwords.
3. Verify `vector` and every extension required by the Prisma schema.
4. Verify the Prisma migration history and schema before connecting any application process.
5. Create a temporary RLS-only runtime connection for the restored project. Do not reuse or expose the database owner credential.
6. Run all validation below before declaring the restore usable.

## 4. Aggregate schema and data validation

Run these queries with an administrative connection to both source and restored projects. Store only aggregate results; do not export user rows into tickets or logs.

```sql
SELECT version();

SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('vector', 'pgcrypto')
ORDER BY extname;

SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT
  (SELECT COUNT(*) FROM "User") AS users,
  (SELECT COUNT(*) FROM "AuthSession") AS auth_sessions,
  (SELECT COUNT(*) FROM "Ingredient") AS ingredients,
  (SELECT COUNT(*) FROM "ImportCorrection") AS import_corrections,
  (SELECT COUNT(*) FROM "RecommendationEvent") AS recommendation_events,
  (SELECT COUNT(*) FROM "MenuDecision") AS menu_decisions,
  (SELECT COUNT(*) FROM "PantryOwnership") AS pantry_ownership,
  (SELECT COUNT(*) FROM "UserPreference") AS user_preferences,
  (SELECT COUNT(*) FROM "ProductEvent") AS product_events,
  (SELECT COUNT(*) FROM recipes) AS recipes,
  (SELECT COUNT(*) FROM recipe_ingredients) AS recipe_ingredients,
  (SELECT COUNT(*) FROM recipe_embeddings) AS recipe_embeddings;

SELECT
  namespace.nspname AS schema_name,
  relation.relname AS table_name,
  relation.relrowsecurity AS rls_enabled,
  relation.relforcerowsecurity AS rls_forced
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname IN (
    'User',
    'AuthSession',
    'Ingredient',
    'ImportCorrection',
    'RecommendationEvent',
    'MenuDecision',
    'PantryOwnership',
    'UserPreference',
    'ProductEvent',
    'recipes',
    'recipe_ingredients'
  )
ORDER BY relation.relname;

SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname IN ('fridgemate_app', 'fridgemate_runtime')
ORDER BY rolname;
```

Acceptance criteria:

- every migration is finished and none is unexpectedly rolled back;
- aggregate table counts match the selected recovery point;
- required tenant tables have RLS enabled and forced;
- `fridgemate_runtime` is neither superuser nor `BYPASSRLS`;
- recipe embedding dimensions and catalog integrity pass the repository verifier;
- no plaintext password, token, or secret is written into drill evidence.

## 5. Application and isolation validation

Point a non-production Worker preview at the restored project's temporary RLS connection, then run:

1. health and authenticated database connectivity checks;
2. signup, login, refresh, logout, and legacy-cookie migration checks;
3. two-account ingredient isolation, including cross-account GET/PATCH/DELETE attempts;
4. manual sync propagation, stale conflict rejection, and tombstone resurrection rejection;
5. OCR correction isolation;
6. recommendation-event ingestion limits;
7. data export and password-confirmed account deletion using temporary drill accounts;
8. recipe catalog and embedding integrity verification.

Do not route production traffic to the restored project during a drill.

## 6. Completion evidence

Record the following in a private operations log:

- source backup identifier and recovery timestamp;
- restore-project identifier and region;
- start time, database-ready time, and verification-complete time;
- measured RPO and RTO;
- aggregate count comparison;
- RLS/runtime-role verification result;
- application smoke-test result;
- gaps, owners, and target dates;
- approval and time for destroying the temporary project.

The drill is successful only when the application and tenant-isolation checks pass. A Dashboard message saying the restore completed is not sufficient.

## 7. Cleanup

After evidence is reviewed:

1. remove any temporary Worker preview and temporary Hyperdrive configuration;
2. rotate credentials that were created only for the drill;
3. obtain explicit approval immediately before deleting the restored project;
4. verify production health and authentication again;
5. schedule remediation for every failed acceptance criterion.

## References

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
- [Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase database connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
