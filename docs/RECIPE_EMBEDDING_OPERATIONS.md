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
npm run recipes:embed -- --backfill-missing --limit=1146 --batch-size=25 --api-batch-size=25 --max-writes=25 --quiet
npm run recipes:embed -- --backfill-missing --resume --limit=1146 --batch-size=25 --api-batch-size=25 --max-writes=25 --quiet
```

- The embedding API receives multiple public catalog texts per request, capped at 100 inputs and defaulting to 25.
- HTTP 429, 5xx, and network failures retry with bounded exponential backoff; other 4xx responses fail immediately.
- UUID keyset pagination replaces offset pagination, so a resumed run cannot skip the next catalog page.
- `.local/recipe-embedding-backfill-state.json` stores only operation metadata and the last successfully committed recipe UUID. It contains no API key, database URL, recipe text, or vector.
- The state file is updated after each successful upsert. A failed item is never recorded as successful, so `--resume` retries it safely.
- `--max-writes` remains independent of the catalog scan limit and is never raised automatically.
- Summaries report API inputs, requests, retries, estimated tokens, optional estimated cost, elapsed time, and throughput without logging secrets or raw vectors.
- `RECIPE_EMBEDDING_PRICE_PER_MILLION_TOKENS` is optional and only enables the cost estimate; provider pricing is not hardcoded.
- Checkpoints are gzip-compressed JSONL with a separate manifest containing row count, model/dimension groups, byte size, and SHA-256. The manifest is vector-free, while the checkpoint itself contains raw vectors and must remain protected.

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
