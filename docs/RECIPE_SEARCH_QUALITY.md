# Recipe Search Quality Gate

## Scope

This check evaluates semantic recipe candidate retrieval without writing production rows. The fixed fixture is `scripts/fixtures/recipe-search-evaluation.json`; the generated aggregate and per-recipe report is `docs/recipe-search-quality-report.json`. No embedding vectors are stored in either file.

## Baseline and Result

| Metric | Old production vectors | Classification-aware in-memory vectors |
| --- | ---: | ---: |
| Hit@1 | not recorded | 5/10 |
| Hit@5 | historical 2/10; fixed fixture replay 3/10 | 6/10 |
| MRR@5 | not recorded | 0.55 |
| Average original rank | not recorded | 69.7 |
| Classification rate | 0% from the empty DB category column | 79.35% |
| Unknown rate | not represented | 20.65% |
| Median core missing count in evaluated Top 5 | observed range about 9-14 | 5 |
| Median missing seasoning count in evaluated Top 5 | not recorded | 1.5 |
| Existing embedding missing rate | 13.35% | 13.35% |

The agreed release gate is Hit@5 at least 7/10. The current result is **No-Go** for production backfill.

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

The builder emits deterministic Korean sections: menu, category, cooking method, normalized search ingredients, core ingredients, bounded seasonings, liquid, optional/garnish, and tags. It removes HTML, quantity suffixes, section prefixes, duplicate names, raw ingredient repetition, and cooking-step noise. Output is capped at 1,200 characters and SHA-256 hashes are calculated from the exact final text.

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

1. Take a Supabase checkpoint and export `recipe_embeddings` IDs, model, dimensions, content hashes, and vectors to protected storage for rollback.
2. Run `npm run recipes:embed -- --dry-run --limit=1146 --batch-size=100 --quiet`. The current new-builder state is `missing=153`, `stale=993`, `current=0`.
3. Backfill missing rows first in batches of 25 with `--backfill-missing --limit=1146 --batch-size=25`. Resume after interruption with the reported `--resume-from=<lastProcessedRecipeId>` cursor.
4. Verify model/dimension counts, duplicate composite keys, orphans, failures, and a limited production query smoke test.
5. Replace stale rows with `--backfill-stale --limit=1146 --batch-size=25`; retry only failed batches with the last safe cursor. API 429 and 5xx errors retain the old row and remain retryable.
6. During stale replacement, old and new content hashes coexist temporarily under the same model/dimension filter. Run during a controlled window, monitor search quality, and pause on regression.
7. Re-run the fixed quality report against stored vectors, then verify total count 1,146, dimensions 1,536, duplicate keys 0, and orphans 0.
8. Roll back by restoring the protected `recipe_embeddings` snapshot if stored-vector quality differs from the approved in-memory report.

Do not run either backfill mode until Hit@5 reaches 7/10 and the report is reviewed.

## Next Improvement Candidates

- Fix parser artifacts still visible in names such as `버터 1½작은술` and merged section text.
- Add broader canonical aliases for meat cuts, dried herbs, and section-prefixed names.
- Replace UUID-order smoke coverage with a reviewed category-balanced Korean home-meal set while preserving the original fixture for regression comparison.
- Evaluate candidate retrieval plus the existing structured reranker separately; several vector misses had much worse ingredient overlap than the target recipe.
