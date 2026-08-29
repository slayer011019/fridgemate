# Recipe Embedding Production Operations

This record captures the reviewed production migration-history recovery and limited recipe embedding run performed on 2026-08-29. It does not authorize a full backfill or semantic API release.

## Migration History Recovery

Production contained three migration names that were absent from the repository:

- `20260828090000_add_home_priority_fields`
- `20260828100000_align_recipe_catalog_pipeline`
- `20260828110000_secure_recipe_import_tables`

The executed schema statements were recovered from production schema metadata and normalized PostgreSQL statement statistics, then restored under the same names. The home-priority migration matches the production checksum exactly. The catalog-alignment and import-security SQL reproduce the executed statements, but their lost original comments or formatting could not be reconstructed, so their local file checksums differ from the historical production checksums.

No production migration row, checksum, table, or column was changed during recovery. `npx prisma migrate status` now reports only `20260826000000_add_ingredient_sync_tombstones` as pending. Keep that migration unapplied until the two recovered-checksum differences receive an explicit deployment review.

## Protected Checkpoint

Before writing embeddings, 993 `recipe_embeddings` rows were exported with vectors to protected local storage under `$HOME/.codex/backups/FridgeMate/`.

- Rows: `993`
- Compressed bytes: `6,900,391`
- SHA-256: `6a63d94518110d4101bcbc8de0043bdee12f7e556f6c160e02db5f05c5452ed9`

The backup contains catalog embedding text and raw vectors, so it must not be committed, logged, or shared publicly.

## Backfill Runner Safety Contract

The repository now provides a repeatable checkpoint command and a resumable backfill runner. Neither command authorizes production execution by itself.

```bash
npm run recipes:checkpoint -- --dry-run
npm run recipes:checkpoint -- --label=before-staged-backfill
npm run recipes:embed -- --backfill-missing --all --batch-size=25 --api-batch-size=25 --max-writes=25 --quiet
npm run recipes:verify-embeddings -- --expect-recipes=1166 --expect-embeddings=1028 --expect-current=45 --expect-missing=138 --expect-stale=983
npm run recipes:embed -- --backfill-missing --all --resume --batch-size=25 --api-batch-size=25 --max-writes=25 --quiet
```

- The embedding API receives multiple public catalog texts per request, capped at 100 inputs and defaulting to 25.
- HTTP 429, 5xx, and network failures retry with bounded exponential backoff; other 4xx responses fail immediately.
- UUID keyset pagination replaces offset pagination, so a resumed run cannot skip the next catalog page.
- `.local/recipe-embedding-backfill-state.json` stores only operation metadata and the last successfully committed recipe UUID. It contains no API key, database URL, recipe text, or vector.
- The state file is updated after each successful upsert. A failed item is never recorded as successful, so `--resume` retries it safely.
- `--max-writes` remains independent of the catalog scan limit and is never raised automatically.
- Every summary prints the effective `maxWrites` value so a dry-run can show the complete candidate count while still making the separately approved production write cap explicit.
- `--all` reads the live recipe count instead of relying on a hardcoded catalog size. A non-dry-run `--all` operation is rejected unless an explicit finite `--max-writes` cap is present.
- Summaries report API inputs, requests, retries, estimated tokens, optional estimated cost, elapsed time, and throughput without logging secrets or raw vectors.
- `RECIPE_EMBEDDING_PRICE_PER_MILLION_TOKENS` is optional and only enables the cost estimate; provider pricing is not hardcoded.
- Checkpoints are gzip-compressed JSONL with a separate manifest containing row count, model/dimension groups, byte size, and SHA-256. The manifest is vector-free, while the checkpoint itself contains raw vectors and must remain protected.
- `recipes:verify-embeddings` runs in a read-only transaction and exits unsuccessfully when expected staged counts, model/dimensions, `vector(1536)`, duplicate, orphan, or full-catalog hash-state checks differ. It makes no embedding API request and prints no recipe rows or vectors.
- When no `--limit` is provided, the verifier reads the live recipe count first and scans that exact count. This prevents catalog growth from being hidden by an obsolete hardcoded limit.

## Limited Missing Backfill

Preflight state:

- `current=0`
- `missing=153`
- `stale=993`

Reviewed command:

```bash
npm run recipes:embed -- --backfill-missing --limit=1146 --batch-size=25 --max-writes=10 --quiet
```

Result:

- `processed=552`
- `generated=10`
- `skipped=542`
- `failed=0`
- `writeLimitReached=true`

Post-run integrity:

- Total embeddings: `1,003`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Current/missing/stale: `10 / 143 / 993`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`

## Stored-Vector Smoke Test

The normalized query was:

```text
검색재료: 계란, 대파, 밥
양념: 진간장
```

The query embedding, pgvector cosine search, recipe join, and semantic reranker all succeeded. The top three vector results were `간장계란밥`, `계란찜`, and `계란말이`; the Top 5 similarity range was `0.6380` to `0.8082`. After canonical ingredient names were supplied, `간장계란밥` remained first with four matched ingredients, expiring `계란`, and a reranked score of `0.4037`.

Raw input aliases such as `달걀` and `간장` must be normalized to catalog names such as `계란` and `진간장` before calling the standalone semantic reranker. The current vector query builder already performs this normalization, but the future semantic endpoint must preserve the same boundary.

## Decision and Next Gate

The limited missing-row operation is a **Go**. The checkpoint, write cap, integrity checks, vector ordering, ingredient join, and reranking smoke test all passed.

The following remain intentionally blocked pending separate review:

- Backfilling the remaining 143 missing rows
- Replacing the 993 stale rows
- Removing or increasing `--max-writes`
- Publishing a semantic recommendation endpoint
- Applying the ingredient tombstone migration

Before full replacement, run a separately approved ten-row stale replacement, compare the stored-vector fixture against the 9/10 Hit@5 baseline, and confirm alias normalization at the reranker boundary.

## Limited Stale Replacement

After commit `0e0198d` passed lint, unit tests, build, and E2E in GitHub Actions, a second protected checkpoint was created before replacing stale rows.

- Checkpoint rows: `1,003`
- Compressed bytes: `6,967,142`
- SHA-256: `a6762d8dc350800df039ac07f06ff4584a86b2ee33b35b6d671496fc8959bbe3`

Reviewed command:

```bash
npm run recipes:embed -- --backfill-stale --limit=1146 --batch-size=25 --max-writes=10 --quiet
```

Result:

- `processed=11`
- `generated=10`
- `skipped=1`
- `failed=0`
- `writeLimitReached=true`

Post-run verification:

- Total embeddings: `1,003`
- Updated since checkpoint: `10`
- Current/missing/stale: `20 / 143 / 983`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Refreshed-vector self retrieval: Top 1 `10/10`, Top 5 `10/10`, self similarity `1.0`

No additional query-embedding API call was made as part of the ten-row stale replacement itself.

## Stored-Vector Quality Gate

After separate approval, the fixed fixture was evaluated against stored production vectors. The evaluator ran in a read-only transaction, embedded only ten public catalog ingredient queries in one API request, and performed no database writes.

- Model/dimensions: `text-embedding-3-small` / `1536`
- Query inputs/API requests: `10 / 1`
- Estimated input tokens: `135`
- Hit@1: `9/10`
- Hit@5: `10/10`
- MRR@5: `0.95`
- Average target rank: `1.1`
- Unavailable fixture targets: `0`
- Production writes: `0`
- Post-evaluation state: `current=20`, `missing=143`, `stale=983`

The stored-vector gate exceeds both the agreed 7/10 release threshold and the 9/10 in-memory comparison baseline. This is a **Go** for a separately approved, checkpointed, staged backfill. It is not approval to remove write caps or publish the semantic API before full coverage and final verification.

## Latest Pre-Missing Checkpoint

Immediately before the next staged missing-row operation, production was checked again through the checkpoint command's read-only transaction and a fresh protected checkpoint was created under `$HOME/.codex/backups/FridgeMate/`.

- Rows: `1,003`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Compressed bytes: `6,961,640`
- SHA-256: `4b260d87d05278c605406248c9541ed8b4256fa57cc9060ae15fc75f8cb2b7db`
- Checkpoint verification: passed
- Production writes: `0`
- Embedding API requests: `0`

This checkpoint reflects the stored vectors after the ten-row stale replacement. It is the rollback reference for the separately approved, maximum-25-row missing backfill. The checkpoint contains raw vectors and must remain outside the repository and public logs.

## Catalog Count Drift Preflight

The first full-catalog verifier run after the checkpoint found that production had grown from `1,146` to `1,166` recipes. The older `--limit=1146` command therefore omitted 20 catalog rows from hash-state classification even though embedding integrity remained valid.

The corrected read-only baseline is:

- Recipes: `1,166`
- Embeddings: `1,003`
- Current/missing/stale: `20 / 163 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Embedding API requests: `0`
- Production writes: `0`

Source-level aggregate checks confirmed that the 20-row increase is intentional catalog content rather than duplicate import drift:

- `MFDS_COOKRCP01`: recipes `1,146`, recipes with embeddings `993`, recipes with ingredients `1,142`, ingredient rows `12,932`
- `curated_home_v1`: recipes `20`, recipes with embeddings `10`, recipes with ingredients `20`, ingredient rows `150`

The curated rows were created on 2026-08-28. No recipe names, ingredient contents, vectors, or user data were queried or printed during this source check.

All staged backfill and final-completion counts must use `1,166` as the current source of truth unless a later read-only verifier run reports another catalog change.

## First 25-Row Missing Backfill

After explicit approval, the guarded full-catalog runner was executed once with `--backfill-missing --all --max-writes=25`. The command detected all `1,166` recipes dynamically and stopped exactly at the approved write cap.

- Processed before stop: `1,028`
- Generated/written: `25`
- Failed: `0`
- API inputs: `25`
- API requests: `6`
- Retries: `0`
- Estimated input tokens: `619`
- Effective write cap: `25`
- Write limit reached: `true`

Missing rows were spread across multiple UUID-keyset pages, so the 25 inputs were sent in six bounded requests rather than one request. The total API input and successful write counts remained exactly within the approved 25-row boundary.

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,028`
- Current/missing/stale: `45 / 138 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

The resume state is `paused` at the last successfully committed recipe UUID and contains operation metadata only. It contains no secret, recipe text, user data, or vector. No additional missing or stale rows are authorized by this record; the next capped batch requires separate approval.

## Second 25-Row Missing Backfill

After separate approval, production was reverified at `embeddings=1,028`, `current=45`, `missing=138`, and `stale=983`. A new protected checkpoint was then created before any API call or write.

- Checkpoint rows: `1,028`
- Compressed bytes: `7,123,952`
- SHA-256: `27e0f2f3cb0e153a2e80f629bb653229b9ffcdba078e77e9be509164dda28a37`
- Hash verification: passed
- Checkpoint production writes: `0`

The runner resumed after the prior successful UUID and executed once with `--backfill-missing --all --resume --max-writes=25`.

- Processed: `25`
- Generated/written: `25`
- Failed: `0`
- API inputs: `25`
- API requests: `1`
- Retries: `0`
- Estimated input tokens: `668`
- Write limit reached: `true`

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,053`
- Current/missing/stale: `70 / 113 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

The next missing or stale write batch remains unauthorized until separately approved.

## Third 25-Row Missing Backfill

After separate approval, production was reverified at `embeddings=1,053`, `current=70`, `missing=113`, and `stale=983`. A new protected checkpoint was created and independently hash-verified before any API call or write.

- Checkpoint rows: `1,053`
- Compressed bytes: `7,285,416`
- SHA-256: `2076b0acff6f96e24da24a7d06bda7cd37e73f170c5c8e42d8f0cfa1b20c02dd`
- Hash verification: passed
- Checkpoint production writes: `0`

The runner resumed after the prior successful UUID and executed once with `--backfill-missing --all --resume --max-writes=25`.

- Processed: `25`
- Generated/written: `25`
- Failed: `0`
- API inputs: `25`
- API requests: `1`
- Retries: `0`
- Estimated input tokens: `625`
- Write limit reached: `true`

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,078`
- Current/missing/stale: `95 / 88 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

The next missing or stale write batch remains unauthorized until separately approved.

## Fourth 25-Row Missing Backfill

After separate approval, production was reverified at `embeddings=1,078`, `current=95`, `missing=88`, and `stale=983`. A new protected checkpoint was created and independently hash-verified before any API call or write.

- Checkpoint rows: `1,078`
- Compressed bytes: `7,446,432`
- SHA-256: `c540220d1260582b788e5fd81cf9c9d510da66aa7a15f7b25ca5d17937b493f7`
- Hash verification: passed
- Checkpoint production writes: `0`

The runner resumed after the prior successful UUID and executed once with `--backfill-missing --all --resume --max-writes=25`.

- Processed: `25`
- Generated/written: `25`
- Failed: `0`
- API inputs: `25`
- API requests: `1`
- Retries: `0`
- Estimated input tokens: `708`
- Write limit reached: `true`

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,103`
- Current/missing/stale: `120 / 63 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

The next missing or stale write batch remains unauthorized until separately approved.

## Fifth 25-Row Missing Backfill

After separate approval, production was reverified at `embeddings=1,103`, `current=120`, `missing=63`, and `stale=983`. A new protected checkpoint was created and independently hash-verified before any API call or write.

- Checkpoint rows: `1,103`
- Compressed bytes: `7,608,159`
- SHA-256: `5a18b4f90f33897d2ff0c1e139979daa95e26bdf2a6a6abdb4b656c0428a68b5`
- Hash verification: passed
- Checkpoint production writes: `0`

The runner resumed after the prior successful UUID and executed once with `--backfill-missing --all --resume --max-writes=25`.

- Processed: `25`
- Generated/written: `25`
- Failed: `0`
- API inputs: `25`
- API requests: `1`
- Retries: `0`
- Estimated input tokens: `685`
- Write limit reached: `true`

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,128`
- Current/missing/stale: `145 / 38 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

The next missing or stale write batch remains unauthorized until separately approved.

## Sixth 25-Row Missing Backfill

After separate approval, production was reverified at `embeddings=1,128`, `current=145`, `missing=38`, and `stale=983`. The previously prepared protected checkpoint was independently hash-verified again before any API call or write.

- Checkpoint rows: `1,128`
- Compressed bytes: `7,769,667`
- SHA-256: `1b71cbe6e5cf18065c2203a0d4353a46d962052fa92e678c932cd19e6d1e1872`
- Hash verification: passed
- Checkpoint production writes: `0`

The runner resumed after the prior successful UUID and executed once with `--backfill-missing --all --resume --max-writes=25`.

- Processed: `25`
- Generated/written: `25`
- Failed: `0`
- API inputs: `25`
- API requests: `1`
- Retries: `0`
- Estimated input tokens: `687`
- Write limit reached: `true`

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,153`
- Current/missing/stale: `170 / 13 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

## Final 13-Row Missing Backfill

After separate approval, production was reverified at `embeddings=1,153`, `current=170`, `missing=13`, and `stale=983`. The protected checkpoint prepared before this batch was independently hash-verified again before any API call or write.

- Checkpoint rows: `1,153`
- Compressed bytes: `7,930,860`
- SHA-256: `3b624a4b37536fb03bfbc0ba0afed9e3833866ce1aa6011d09f54e679de4e933`
- Hash verification: passed
- Checkpoint production writes: `0`

The runner resumed after the prior successful UUID and executed once with `--backfill-missing --all --resume --max-writes=13`.

- Processed: `13`
- Generated/written: `13`
- Failed: `0`
- API inputs: `13`
- API requests: `1`
- Retries: `0`
- Estimated input tokens: `325`
- Write limit reached: `true`

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,166`
- Current/missing/stale: `183 / 0 / 983`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

Every catalog recipe now has a stored embedding. The remaining 983 stale rows require separately approved staged replacement; this batch did not run a quality-evaluation API call or publish the semantic endpoint.

## First 25-Row Stale Replacement

After separate approval, production was reverified at `embeddings=1,166`, `current=183`, `missing=0`, and `stale=983`. The protected post-missing checkpoint was independently hash-verified before any API call or write.

- Checkpoint rows: `1,166`
- Compressed bytes: `8,014,845`
- SHA-256: `2de31839eb0c041c02370c1a2ee50f92dae6c5b7e528614ef474d47e65be550f`
- Hash verification: passed
- Checkpoint production writes: `0`

The runner executed once with `--backfill-stale --all --max-writes=25`. It scanned clean rows while selecting stale candidates, so two multi-input API requests covered the 25 approved writes.

- Processed: `36`
- Generated/written: `25`
- Skipped current rows: `11`
- Failed: `0`
- API inputs: `25`
- API requests: `2`
- Retries: `0`
- Estimated input tokens: `722`
- Write limit reached: `true`

The immediate read-only verifier passed with:

- Recipes: `1,166`
- Embeddings: `1,166`
- Current/missing/stale: `208 / 0 / 958`
- Duplicate composite keys: `0`
- Orphan embeddings: `0`
- Column type: `vector(1536)`
- Model/dimensions: `text-embedding-3-small` / `1536`
- Verification API requests: `0`
- Verification production writes: `0`

No quality-evaluation API call or semantic endpoint publication was included in this approval. The next separately approved operation is the fixed ten-query and Korean home-meal stored-vector quality rerun before increasing stale replacement batch sizes.

## Post-Stale-Replacement Quality Rerun

Under separate approval, both stored-vector fixtures were evaluated without database writes.

| Fixture | API inputs | API requests | Hit@1 | Hit@5 | MRR@5 | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fixed UUID regression, 10 queries | 10 | 1 | 8/10 | 9/10 | 0.85 | Go |
| Korean home meal, 20 queries | 20 | 1 | 2/20 | 2/20 | 0.10 | No-Go |

The Korean home-meal report had no unavailable targets, but its average target rank was `208.2`, median Top 5 missing-ingredient count was `5`, median missing-seasoning count was `2`, and median owned-ingredient ratio was `0.1381`. A separate write-free catalog scan then established that 18 fixture targets were stale and only 2 were current. The current count matched the two successful Hit@5 cases, so stored-vector generation mismatch is the primary gate blocker; no retrieval-weight or fixture-ground-truth change was made.

The runner now supports a fixture-scoped safety boundary:

```bash
npm run recipes:embed -- --dry-run --backfill-stale --target-fixture=scripts/fixtures/recipe-search-home-meal-evaluation.json --batch-size=25 --api-batch-size=18 --max-writes=18 --quiet
```

The verified dry-run result was `processed=20`, `current=2`, `missing=0`, `stale=18`, `plannedInputs=18`, `apiInputCount=0`, `apiRequestCount=0`, and `generated=0`. Production use of `--target-fixture` refuses to start without an explicit finite `--max-writes`, validates every fixture target against the catalog, and records the target fixture in resume state. This dry-run does not authorize the 18 writes or another quality-evaluation API call.
