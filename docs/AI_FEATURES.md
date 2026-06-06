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

## Experimental

- OpenAI-compatible embeddings for OCR correction suggestions
- recipe catalog embeddings and pgvector search
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
