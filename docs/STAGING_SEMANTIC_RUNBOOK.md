# Semantic Staging Runbook

This runbook creates an isolated semantic-recommendation staging environment. It never copies production users, ingredients, sessions, corrections, decisions, preferences, or analytics events.

## Isolation Contract

- Create a separate Supabase project and use a separate database password.
- Apply the complete repository migration history only to that staging project.
- Copy only `recipes`, `recipe_ingredients`, `recipe_embeddings`, and the catalog normalization tables they reference.
- Create staging-only Cloudflare KV, Hyperdrive, Worker, Durable Object namespace, JWT secret, and OpenAI secret.
- Keep AdSense and GA disabled on `staging.오늘뭐먹지.com`.
- Never reuse production Hyperdrive, KV, JWT, cookies, or database credentials.

## Prepare Configuration

1. Copy `wrangler.staging.example.jsonc` to the ignored `wrangler.staging.jsonc`.
2. Replace only the staging KV and Hyperdrive identifiers.
3. Store `JWT_SECRET` and `OPENAI_API_KEY` with Wrangler secrets. Do not place them in JSON or commit them.
4. Configure the staging frontend from `.env.staging.example` and point it only at `https://api-staging.오늘뭐먹지.com/api`.

## Database Setup

Use trusted staging owner credentials for migrations and a dedicated `fridgemate_app` member for Hyperdrive. Before importing catalog data, verify `vector`, `pgcrypto`, `gen_random_uuid()`, RLS policies, and migration status. Import public catalog tables in FK order, then run:

```bash
npm run recipes:verify-embeddings -- --expect-recipes=1166 --expect-embeddings=1166 --expect-current=1166 --expect-missing=0 --expect-stale=0
npm run recipes:embed -- --evaluate --dry-run --stored-vectors --limit=1166
```

The import must finish with 1,166 current vectors, zero missing/stale rows, zero duplicate keys, zero orphans, and `vector(1536)`.

Before applying `20260830140000_add_menu_decisions_and_feedback`, run `scripts/sql/recommendation-event-preflight.sql`. Record only its aggregate counts. The safely linkable count may be backfilled; local and unmatched keys must remain nullable and must not be deleted.

## Worker Gate

```bash
npx wrangler deploy --dry-run --config wrangler.staging.jsonc
npx wrangler deploy --config wrangler.staging.jsonc
```

Verify with a dedicated staging account:

- fixed fixture reranked Hit@5 is at least 7/10;
- home-meal reranked Hit@5 is at least 14/20 and candidate recall@100 is at least 18/20;
- healthy vector requests return `mode=semantic` and `_recommendationSource=hybrid`;
- a controlled vector failure returns `mode=rule-fallback` and `_recommendationSource=rule`;
- missing auth returns 401, invalid input returns 400, and the semantic rate limit returns 429;
- logs contain only request group/status/latency, aggregate semantic mode/count/latency, and aggregate AI usage;
- logs contain no request body, user ID, recipe query text, ingredient name, token, cookie, database URL, prompt, or vector.

## Production Release And Rollback

After every staging gate passes, change only production `SEMANTIC_RECIPE_API_ENABLED` to `true` and deploy the Worker. Keep the existing frontend endpoint unchanged. Observe error rate, `semantic_recommendation` mode counts, request latency, and `ai_usage` totals for 24 hours.

Rollback is only a flag change back to `false` followed by a Worker deployment. No database rollback is required. Stop and roll back for elevated 5xx rates, database connection failures, sustained latency above the agreed threshold, or an unexpected rise in `rule-fallback` events.

## Provisioning Status

Repository configuration and verification steps are ready. Cloud resources remain intentionally unprovisioned until the separate Supabase project identifiers and staging-only credentials exist; production resources must not be substituted.
