# Recipe Search Quality Gate

## Scope

This check evaluates semantic recipe candidate retrieval without writing production rows. The fixed fixture is `scripts/fixtures/recipe-search-evaluation.json`; the in-memory report is `docs/recipe-search-quality-report.json`, and the stored-production-vector report is `docs/recipe-search-stored-vector-report.json`. No embedding vectors are stored in either report.

A separate realistic fixture lives at `scripts/fixtures/recipe-search-home-meal-evaluation.json`. It keeps the UUID regression fixture intact and adds 20 source-backed recipes across soup, stew, rice, noodles, quick meals, side dishes, meat, seafood, and plant-forward meals. Each query uses only three to five plausible available ingredients, marks at least one expiring ingredient, and includes alias coverage such as `계란`/`달걀` and `파`/`대파`.

## Baseline and Result

| Metric | Old production vectors | Classification-aware in-memory vectors | Stored production vectors after limited refresh |
| --- | ---: | ---: | ---: |
| Hit@1 | not recorded | 9/10 | 9/10 |
| Hit@5 | historical 2/10; fixed fixture replay 3/10 | 9/10 | 10/10 |
| MRR@5 | not recorded | 0.9 | 0.95 |
| Average original rank | not recorded | 30.4 | 1.1 |
| Classification rate | 0% from the empty DB category column | 79.35% | 78.92% |
| Unknown rate | not represented | 20.65% | 21.08% |
| Median core missing count in evaluated Top 5 | observed range about 9-14 | 3.5 | 2 |
| Median missing seasoning count in evaluated Top 5 | not recorded | 1 | 1 |
| Existing embedding missing rate | 13.35% | 13.35% | 12.48% |

The agreed release gate is Hit@5 at least 7/10. The stored-vector result is **Go** for a separately approved, staged production backfill. The evaluation embedded ten fixture queries in one API request, read existing production vectors, and wrote no production rows. Semantic API publication remains a separate gate after catalog coverage and integrity verification.

## Failure Diagnosis and Minimal Fix

The 6/10 baseline had four misses. Every target existed in the 1,146-recipe candidate pool and had zero missing ingredients against its own fixture query, while the returned Top 5 recipes were missing multiple ingredients. Candidate-pool size, similarity threshold, missing catalog rows, stale-hash detection, and fixture IDs were therefore ruled out for these cases.

| Fixture | Baseline rank / similarity | Current rank / similarity | Finding |
| --- | ---: | ---: | --- |
| 포니언 스프 | 85 / 0.583549 | 1 / 0.894177 | Ingredient text was placed after menu metadata, weakening alignment with the ingredient-only query. |
| 떡갈비콩나물밥 | 58 / 0.603366 | 1 / 0.845062 | The same ordering issue was amplified by a long core-ingredient list and a minced-garlic classification mismatch. |
| 호박잎 삼계탕 | 25 / 0.667513 | 1 / 0.878200 | The query and candidate shared the core ingredients, but candidate metadata preceded the matching sections. |
| 케이준 스타일 닭고기 요리 | 524 / 0.538547 | 295 / 0.730204 | Dried-herb names and optional sugar remain inconsistently classified; this is the only remaining miss. |

The accepted change only reorders the existing deterministic candidate sections so normalized search ingredients, core ingredients, and seasonings precede menu/category/cooking metadata. It does not change the model, dimensions, candidate pool, threshold, fixture ground truth, or classification dictionaries.

## Classification Rules

The pure runtime classifier returns `main`, `seasoning`, `optional`, `garnish`, `liquid`, or `unknown`, plus confidence and a reason. It applies evidence in this order:

1. Explicit valid DB category or ingredient type.
2. Section and raw-text markers such as `양념장`, `고명`, and `선택`.
3. Recipe-title matches for likely core ingredients.
4. Exact normalized dictionaries for common seasonings and liquids.
5. Parsed substantial quantity as conservative main-ingredient evidence.
6. `unknown` when no supported evidence exists.

Only `main` blocks `canMakeNow`. Seasonings remain separate, optional/garnish/liquid rows do not block, and unknown rows contribute a small conservative score penalty without becoming core requirements.

## Embedding Text Contract

The builder emits deterministic Korean sections with ingredient-bearing sections first: normalized search ingredients, core ingredients, bounded seasonings, liquid, optional/garnish, then menu, category, cooking method, and tags. It removes HTML, quantity suffixes, section prefixes, duplicate names, raw ingredient repetition, and cooking-step noise. Output is capped at 1,200 characters and SHA-256 hashes are calculated from the exact final text.

## Reproduce

API-free preflight:

```bash
npm run recipes:embed -- --evaluate --dry-run --limit=1166
```

In-memory evaluation using the configured embedding API:

```bash
npm run recipes:embed -- --evaluate --execute --limit=1166 --output=docs/recipe-search-quality-report.json
```

Stored-production-vector preflight and evaluation:

```bash
npm run recipes:embed -- --evaluate --dry-run --stored-vectors --limit=1166
npm run recipes:embed -- --evaluate --execute --stored-vectors --limit=1166 --output=docs/recipe-search-stored-vector-report.json
```

Realistic home-meal fixture preflight and evaluation:

```bash
npm run recipes:embed -- --evaluate --dry-run --stored-vectors --limit=1166 --fixture=scripts/fixtures/recipe-search-home-meal-evaluation.json
npm run recipes:embed -- --evaluate --execute --stored-vectors --limit=1166 --fixture=scripts/fixtures/recipe-search-home-meal-evaluation.json --output=docs/recipe-search-home-meal-report.json
```

This profile resolves targets by stable catalog `externalId`, reports Hit@5 rate, owned core-ingredient ratio, missing core/seasoning counts, and expiring ingredient matches, and uses a 70% Hit@5 gate. Its production score remains unmeasured until the catalog backfill stage receives separate DB/API approval.

The stored-vector mode embeds only the ten fixture queries, evaluates them against matching model/dimension rows in `recipe_embeddings`, and runs inside a read-only transaction. The production run used ten inputs, one API request, about 135 estimated input tokens, and zero database writes.

The final run used `text-embedding-3-small`, 1,536 dimensions, 1,156 inputs, 12 API requests, and an estimated 38,125 input tokens. Cost is calculated as `estimated input tokens / 1,000,000 * the provider's current per-million-token embedding price`.

## Backfill Plan After Go

1. Completed 2026-08-29: exported 993 `recipe_embeddings` rows, including vectors, to protected local storage and verified the compressed backup checksum.
2. Completed preflight: `missing=153`, `stale=993`, `current=0`.
3. Completed limited missing backfill: `generated=10`, `failed=0`, and `writeLimitReached=true` with `--backfill-missing --limit=1146 --batch-size=25 --max-writes=10`.
4. Completed integrity and stored-vector smoke checks: total 1,003, `text-embedding-3-small`/1,536 count 1,003, duplicates 0, orphans 0, and relevant Top 3 results for the egg-rice query. The post-run state is `missing=143`, `stale=993`, `current=10`.
5. Completed limited stale replacement: `generated=10`, `failed=0`, `writeLimitReached=true`, post-run `current=20`, `missing=143`, `stale=983`, and refreshed-vector self retrieval Top 1/Top 5 `10/10`.
6. Completed the fixed ten-query stored-vector gate: Hit@1 `9/10`, Hit@5 `10/10`, MRR@5 `0.95`, unavailable targets `0`, API inputs `10`, requests `1`, and production writes `0`.
7. Completed 2026-08-30 KST: reverified `1,003` production rows through a read-only transaction and created a fresh protected post-stale-replacement checkpoint with SHA-256 `4b260d87d05278c605406248c9541ed8b4256fa57cc9060ae15fc75f8cb2b7db`. A later full-catalog verifier found 20 additional production recipes. Six separately approved 25-row missing batches and the final 13-row batch then completed with no failures. The latest verified state is `recipes=1,166`, `embeddings=1,166`, `current=183`, `missing=0`, `stale=983`, duplicates 0, orphans 0, and `vector(1536)`. Further writes still require separate approval.
8. Completed the first separately approved 25-row stale replacement with `generated=25`, `failed=0`, `apiInputCount=25`, `apiRequestCount=2`, and no retries. The immediate verifier passed at `embeddings=1,166`, `current=208`, `missing=0`, `stale=958`, duplicates 0, orphans 0, and `vector(1536)`.
9. Completed under separate approval: the post-replacement fixed fixture passed at Hit@1 `8/10`, Hit@5 `9/10`, and MRR@5 `0.85`, using 10 API inputs, one request, and zero writes. The Korean home-meal fixture returned Hit@1 `2/20`, Hit@5 `2/20`, and MRR@5 `0.10`, using 20 API inputs, one request, and zero writes.
10. Completed without API calls or writes: a fixture-scoped stale dry-run resolved all 20 Korean home-meal targets and found `current=2`, `stale=18`, `missing=0`, and `plannedInputs=18`. The stale/current split explains the quality result strongly enough that retrieval weights and fixture ground truth remain unchanged.
11. Before any further quality judgment, create a fresh protected checkpoint and replace only the 18 stale fixture targets under separate approval and `--max-writes=18`, then rerun both fixtures under a separately bounded API approval.
12. Roll back by restoring the protected `recipe_embeddings` snapshot if stored-vector quality regresses.

The in-memory, missing-row coverage, limited stale-row, integrity, and fixed stored-vector quality gates are satisfied. Every catalog recipe has a stored vector, and the first 25-row stale replacement is complete. The realistic Korean home-meal gate is not satisfied because 18 of its 20 target vectors still use stale content. The runner can now isolate those 18 rows, but no targeted production write is authorized yet. Full freshness and semantic API release remain blocked until the targeted rerun is reviewed, the remaining 958 stale rows are replaced, integrity checks pass, and both stored-vector fixtures meet their gates. See `docs/RECIPE_EMBEDDING_OPERATIONS.md` for the production record.

## Next Improvement Candidates

- Fix parser artifacts still visible in names such as `버터 1½작은술` and merged section text.
- Add broader canonical aliases for meat cuts, dried herbs such as `바질마른것`/`오레가노마른것`/`타임 마른것`, and section-prefixed names.
- Review and run the new category-balanced Korean home-meal fixture against complete stored vectors while preserving the original UUID fixture for regression comparison.
- Evaluate candidate retrieval plus the existing structured reranker separately; several vector misses had much worse ingredient overlap than the target recipe.
