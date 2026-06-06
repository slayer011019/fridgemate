# Contributing to FridgeMate

Thanks for helping improve FridgeMate. This project is intended to be useful both as an app and as a reference codebase for students and junior developers.

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Run frontend-only mode:

```bash
npm run dev
```

Run backend mode in a second terminal after configuring PostgreSQL:

```bash
npm run dev:server
```

## Environment Variables

Use `.env.example` and `server/.env.example` as references. Never commit real secrets.

Important variables:

- `VITE_API_URL` or `VITE_API_BASE_URL` for frontend API mode
- `DATABASE_URL` and `DIRECT_URL` for Prisma/PostgreSQL
- `JWT_SECRET` for backend auth
- `ANTHROPIC_API_KEY` for optional AI recipe suggestions
- `OPENAI_API_KEY` for optional embedding experiments
- `SUPABASE_SERVICE_ROLE_KEY` for server-side seed/import scripts only

Rules:

- Do not use real API keys in issues, PRs, screenshots, logs, or committed files.
- Do not expose server-only keys with a `VITE_` prefix.
- If a secret may have been committed, rotate it before opening a PR.

## Development Workflow

1. Open or comment on an issue before starting larger changes.
2. Keep PRs focused on one behavior or documentation goal.
3. Prefer simple JavaScript functions and hooks over new abstractions.
4. Preserve local-first behavior unless the issue explicitly changes it.
5. Update README, CHANGELOG, or docs when behavior or setup changes.
6. Add or update tests when behavior changes.

## Branch and Commit Convention

Branch names should be short and descriptive:

```text
docs/oss-readiness
fix/ocr-parser-regression
feat/recommendation-event-export
test/auth-session-restore
```

Commit messages should use an imperative summary:

```text
Add contribution guide
Fix receipt parser quantity detection
Document recommendation event export
```

## How to Run Tests

Recommended checks before opening a PR:

```bash
npm run lint
npm run test:run
npm run build
npx prisma validate
```

Optional:

```bash
npm run test:e2e
npm run test:coverage
```

If you cannot run a check, mention why in the PR description.

## How to Open Issues

Use the issue templates when possible.

Bug reports should include:

- expected behavior
- actual behavior
- reproduction steps
- browser and OS
- frontend-only or backend-connected mode
- relevant logs with secrets removed

Feature requests should include:

- user problem
- proposed behavior
- whether it affects local-only mode, backend mode, or both
- any AI/API dependency

## How to Submit Pull Requests

Before submitting:

- rebase or merge the latest `main`
- keep generated artifacts out of the PR
- update docs for user-visible changes
- include test results in the PR body
- include screenshots for UI changes when useful, without exposing private data

PRs should avoid unrelated formatting or broad refactors.

## Security and Secret Handling

Do not commit:

- `.env` or `.env.local`
- real database URLs
- JWT secrets
- API keys
- service role keys
- private deployment URLs if they expose internal services
- user data, receipts, or screenshots with personal information

Report suspected secret exposure privately to the maintainer instead of opening a public issue with the secret value.

## Maintainer Review Process

Maintainers review for:

- correctness and reproducibility
- local-first behavior preservation
- auth and secret safety
- test coverage or clear manual verification
- documentation updates
- small, readable changes

For larger changes, maintainers may ask for a design note or staged PRs before merging.
