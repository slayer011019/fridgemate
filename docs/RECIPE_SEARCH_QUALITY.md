# Recipe Search Quality Gate

## Scope

This check evaluates semantic recipe candidate retrieval without writing production rows. The fixed fixture is `scripts/fixtures/recipe-search-evaluation.json`; the generated aggregate and per-recipe report is `docs/recipe-search-quality-report.json`. No embedding vectors are stored in either file.

## Baseline and Result

| Metric | Old production vectors | Classification-aware in-memory vectors |
| --- | ---: | ---: |
| Hit@1 | not recorded | 9/10 |
| Hit@5 | historical 2/10; fixed fixture replay 3/10 | 9/10 |
| MRR@5 | not recorded | 0.9 |
| Average original rank | not recorded | 30.4 |
| Classification rate | 0% from the empty DB category column | 79.35% |
| Unknown rate | not represented | 20.65% |
| Median core missing count in evaluated Top 5 | observed range about 9-14 | 3.5 |
| Median missing seasoning count in evaluated Top 5 | not recorded | 1 |
| Existing embedding missing rate | 13.35% | 13.35% |

The agreed release gate is Hit@5 at least 7/10. The current result is **Go** for a separately reviewed, limited production backfill. No production vectors were written by this evaluation.

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
npm run recipes:embed -- --evaluate --dry-run --limit=1146
```

In-memory evaluation using the configured embedding API:

```bash
npm run recipes:embed -- --evaluate --execute --limit=1146 --output=docs/recipe-search-quality-report.json
```

The final run used `text-embedding-3-small`, 1,536 dimensions, 1,156 inputs, 12 API requests, and an estimated 38,125 input tokens. Cost is calculated as `estimated input tokens / 1,000,000 * the provider's current per-million-token embedding price`.

## Backfill Plan After Go

1. Completed 2026-08-29: exported 993 `recipe_embeddings` rows, including vectors, to protected local storage and verified the compressed backup checksum.
2. Completed preflight: `missing=153`, `stale=993`, `current=0`.
3. Completed limited missing backfill: `generated=10`, `failed=0`, and `writeLimitReached=true` with `--backfill-missing --limit=1146 --batch-size=25 --max-writes=10`.
4. Completed integrity and stored-vector smoke checks: total 1,003, `text-embedding-3-small`/1,536 count 1,003, duplicates 0, orphans 0, and relevant Top 3 results for the egg-rice query. The post-run state is `missing=143`, `stale=993`, `current=10`.
5. Completed limited stale replacement: `generated=10`, `failed=0`, `writeLimitReached=true`, post-run `current=20`, `missing=143`, `stale=983`, and refreshed-vector self retrieval Top 1/Top 5 `10/10`. Do not remove or raise the write cap until the fixed ten-query fixture is evaluated against stored vectors.
6. During stale replacement, old and new content hashes coexist temporarily under the same model/dimension filter. Run during a controlled window, monitor search quality, and pause on regression.
7. Re-run the fixed quality report against stored vectors, then verify total count 1,146, dimensions 1,536, duplicate keys 0, and orphans 0.
8. Roll back by restoring the protected `recipe_embeddings` snapshot if stored-vector quality differs from the approved in-memory report.

The in-memory gate, initial missing-row gate, and limited stale-row integrity gate are satisfied. The next separately reviewed operation is the fixed ten-query fixture against stored production vectors, including alias-normalized reranking checks. Full replacement and semantic API release remain blocked. See `docs/RECIPE_EMBEDDING_OPERATIONS.md` for the production record.

## Next Improvement Candidates

- Fix parser artifacts still visible in names such as `버터 1½작은술` and merged section text.
- Add broader canonical aliases for meat cuts, dried herbs such as `바질마른것`/`오레가노마른것`/`타임 마른것`, and section-prefixed names.
- Replace UUID-order smoke coverage with a reviewed category-balanced Korean home-meal set while preserving the original fixture for regression comparison.
- Evaluate candidate retrieval plus the existing structured reranker separately; several vector misses had much worse ingredient overlap than the target recipe.
