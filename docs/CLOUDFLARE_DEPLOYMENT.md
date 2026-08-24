# Cloudflare Workers API Deployment

FridgeMate keeps the React frontend on Vercel and the PostgreSQL database on Supabase. Cloudflare Workers replaces the discontinued Railway Express runtime.

## Runtime layout

```text
오늘뭐먹지.com (Vercel)
  -> VITE_API_URL
  -> FridgeMate Express API (Cloudflare Worker)
  -> Prisma driver adapter
  -> Cloudflare Hyperdrive
  -> Supabase PostgreSQL
```

`server/src/index.js` remains the local and conventional Node entry point. `server/src/worker.js` is the Cloudflare entry point and exposes the same `createApp()` routes through `httpServerHandler`.

## API surface

| Path | Access | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Minimal API liveness signal |
| `/api/auth/*` | Public/session | Signup, login, refresh, logout, session |
| `/api/ingredients/*` | Authenticated | Ingredient list and manual sync |
| `/api/import/*` | Authenticated | Import correction lookup and learning |
| `/api/recipes/*` | Authenticated | Recipe recommendations |
| `/api/recommendation-events/*` | Optional auth, rate-limited | Bounded recommendation event collection |

Recipe catalog imports are intentionally not exposed over HTTP. Run the trusted `seed:recipes` workflow from a local or CI environment that holds the required server-side credentials.

## One-time Cloudflare setup

1. Authenticate Wrangler with `npx wrangler login`.
2. Create a Hyperdrive configuration in the Cloudflare dashboard using the Supabase direct PostgreSQL connection. Do not commit or paste the connection string into `wrangler.jsonc`.
3. Add the generated Hyperdrive binding to `wrangler.jsonc` with the binding name `HYPERDRIVE`.
4. Create a Workers KV namespace and add its binding as `AUTH_KV` for access-token revocation.
5. Keep the `AUTH_RATE_LIMITER` Durable Object binding and `AuthRateLimiter` SQLite export from `wrangler.jsonc`; Wrangler provisions it on deploy.
6. Store `JWT_SECRET` with `npx wrangler secret put JWT_SECRET`.
7. Store optional `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` as Wrangler secrets only when those features are enabled.
8. Run `npm run worker:dry-run`, then `npm run dev:worker` for a local smoke check.
9. Deploy with `npm run worker:deploy` after the health and auth checks pass.

## Database runtime role and RLS

The tenant RLS migrations create a non-login, non-bypass role named `fridgemate_app`. They force user-scoped policies on `Ingredient` and `ImportCorrection`, bind account lookup to the submitted normalized email, bind refresh-session lookup to the presented token hash, and keep recipe access read-only. Create a separate login role directly in Supabase using a generated password, grant it membership, and configure Hyperdrive to connect as that login role:

```sql
CREATE ROLE fridgemate_runtime
  LOGIN
  PASSWORD '<generated-secret>'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;
GRANT fridgemate_app TO fridgemate_runtime;
```

Do not put the generated password in this repository or `wrangler.jsonc`. Update the Hyperdrive origin credentials through Cloudflare, then confirm the runtime role is neither the table owner nor a member of a role with `BYPASSRLS`. `DIRECT_URL` remains an admin/migration credential and must not be used by the deployed API.

Apply the migration and create/update the runtime role before deploying the Worker code. Production tenant queries fail closed when the connected database role owns either protected table, has `BYPASSRLS`, or is not a member of `fridgemate_app`.

The API sets `app.current_user_id`, `app.current_auth_email`, and `app.current_refresh_token_hash` with transaction-local `set_config(..., true)` before the corresponding database operation. Missing or mismatched context therefore receives the RLS default-deny behavior, and every setting is discarded at transaction end instead of leaking through the connection pool.

Example binding shape to add after Cloudflare creates the resources:

```jsonc
{
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<cloudflare-hyperdrive-id>" }],
  "kv_namespaces": [{ "binding": "AUTH_KV", "id": "<cloudflare-kv-id>" }],
  "durable_objects": {
    "bindings": [{ "name": "AUTH_RATE_LIMITER", "class_name": "AuthRateLimiter" }]
  },
  "exports": {
    "AuthRateLimiter": { "type": "durable-object", "storage": "sqlite" }
  }
}
```

The IDs are deployment identifiers, while database credentials and signing keys remain secrets.

## Domain cutover

Start with the generated `workers.dev` URL. After smoke testing, map `api.오늘뭐먹지.com` as a Worker custom domain. If the domain DNS is not managed by Cloudflare, move DNS management carefully while preserving the Vercel frontend records.

Production uses secure `SameSite=Lax` cookies with `__Host-` names on the same-site `api.오늘뭐먹지.com` domain. Cookie-authenticated state changes must also carry an exact allowed `Origin`, or an allowed `Referer` when `Origin` is unavailable. The cookie-name cutover invalidates existing browser sessions, so users must sign in once after deployment. Cross-site `workers.dev` authentication smoke tests require a separate, deliberate cookie configuration and are not the production default.

Set Vercel production environment variables to:

```env
VITE_API_URL=https://api.오늘뭐먹지.com/api
```

Redeploy the frontend and verify login, session restore, ingredient backup/pull, recipe recommendations, and logout. Keep the previous frontend deployment available for rollback until these checks pass.

## Operational notes

- Hyperdrive is preferred over a plain `DATABASE_URL` because it pools and routes PostgreSQL connections for Workers.
- Prisma migrations continue to run from a trusted local or CI environment with `DIRECT_URL`; Workers do not run migrations at startup.
- `AUTH_KV` persists logout revocations across Worker isolates. `AUTH_RATE_LIMITER` serializes each hashed email/IP/client rate-limit key in its own SQLite Durable Object so concurrent auth attempts and recommendation-event floods cannot bypass counters.
- Persistent auth-store failures are fail-closed. Production Node deployments require `REDIS_URL`; Cloudflare deployments require both auth bindings.
- Production database traffic must use the dedicated `fridgemate_runtime` login role; using the Supabase `postgres` or service role bypasses the RLS boundary.
- `ALLOWED_ORIGINS` is both the credentialed CORS allowlist and the CSRF source-origin allowlist; keep production entries exact and do not use `*`.
- `wrangler.jsonc` contains non-secret defaults only. Never add database URLs, API keys, or service role keys to it.

References: [Express on Workers](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/), [Supabase with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/), [Prisma with Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/).
