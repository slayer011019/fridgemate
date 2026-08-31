# AI Features

FridgeMate uses AI and AI-adjacent workflows where they improve food management without making the core app unusable without API keys.

## Implemented

### OCR Import

Shopping screenshots and receipt text can be imported through a review-before-save flow.

- Tesseract.js extracts text in the browser
- parser rules identify likely ingredient candidates
- users review and edit before saving
- correction learning improves repeated imports

### Ingredient Normalization

The import flow normalizes noisy product text into simpler ingredient names. The current implementation is rule-based and intentionally readable so contributors can add regression cases.

### Expiration-Aware Suggestions

Recipe scoring considers:

- available fridge ingredients
- pantry staple ownership
- missing ingredient count
- ingredients that are expiring soon

This supports food waste reduction by pushing urgent ingredients into recommendation decisions.

### Optional AI Recipe Suggestions

When `ANTHROPIC_API_KEY` is configured, the backend can request AI-assisted recipe suggestions. If the key is missing, the app should continue with rule-based and database-backed fallback behavior.

### Recommendation Events

Backend-connected mode can store recommendation impressions and clicks. Events include score feature snapshots such as rank, match rate, missing ingredient count, urgent match count, source, and click labels.

The export command creates future training data:

```bash
npm run export:recommendation-training -- --format=jsonl --output=data/training/recommendation-training.jsonl
```

The export is bounded to the latest 180 server-created days by default. Operators can provide an explicit `--since` and `--until` window, but the script rejects ranges wider than 180 days and future end times.

### Import Correction Embeddings

Import-correction learning and its embedding path are independently disabled by default. Historical correction rows do not contain evidence of a disclosed, per-request external-AI action, so bulk embedding execution is intentionally disabled even when feature flags and provider keys are configured. The inspection path rebuilds text from bounded, privacy-checked correction fields and never falls back to a legacy raw embedding string.

The command is read-only and supports dry-run inspection only:

```bash
npm run import-corrections:backfill
```

Passing `--execute` always fails before a database read, provider request, or write. Rows that resemble an email address, phone number, resident identifier, card number, URL, or street address are also rejected during the dry-run review. A future migration would need trustworthy per-record consent evidence and a newly reviewed execution design; operator flags must not be used to invent that consent. The current import screen does not automatically request correction embeddings.

### Recipe Embedding Groundwork

Recipe embeddings convert stable recipe text into vectors for future semantic candidate search. This is storage and retrieval infrastructure, not model training.

Current boundaries:

- recipe vectors belong in the separate `recipe_embeddings` table
- the existing production `recipes` table shape should not be changed for the first rollout
- vector search joins `recipe_embeddings.recipe_id` to the production UUID `recipes.id` and never expects `recipes.embedding`
- model and dimensions are part of the retrieval filter as well as the embedding-generation configuration
- pgvector search should only choose candidates
- final ordering should remain rule-based, using owned ingredient match, expiration urgency, missing ingredient count, and existing recommendation score
- ranking model training should wait until recommendation events are plentiful enough for offline evaluation

The initial August 2026 baseline found 993 old embeddings for 1,146 recipes and failed the retrieval gate. That state is now historical: the catalog contains 1,166 recipes and all 1,166 vectors are current, with no missing, stale, duplicate, or orphan rows. Final stored-vector evaluation reached fixed-fixture reranked Hit@5 9/10 and Korean home-meal candidate recall@100 19/20 with reranked Hit@5 15/20. Production activation remains behind `SEMANTIC_RECIPE_API_ENABLED` until isolated staging verifies API behavior and fallback.

The embedding command defaults to dry-run. `--evaluate --execute` embeds public catalog text only in memory, never stores vectors, and records request counts and aggregate metrics. Production writes require an explicit `--backfill-missing` or `--backfill-stale` mode after the quality gate is approved.

## Experimental

- OpenAI-compatible embeddings for OCR correction suggestions
- recipe catalog semantic retrieval from pgvector candidates
- model-assisted recipe ingredient normalization
- ranking experiments from recommendation event exports

## Maintainer Automation

FridgeMate is a good fit for AI-assisted maintainership because contributors can use automation for:

- issue triage and reproduction checklists
- code review assistance
- test-gap identification
- release note generation
- documentation consistency checks

Automation should support maintainers, not bypass review. Secrets, user data, and private deployment details must stay out of prompts and public logs.
