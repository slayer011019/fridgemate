# Code Review Graph Workflow

Use Code Review Graph as a review aid for risky changes, dependency-heavy refactors, and release checks. It is advisory only; keep normal tests and builds as the source of truth.

## Current Status

- FridgeMate graph exists for this workspace: 168 files, 1021 nodes, 7661 edges.
- Last observed graph update: 2026-05-02T00:37:39.
- MCP registry currently has no registered repositories, so path-based calls work but registry-based repo lookup does not.
- `get_minimal_context_tool` timed out once at 120 seconds, and `get_suggested_questions_tool` returned an internal path error. Prefer stats and focused review-context calls until those are fixed.

## Setup

Register this repo once:

```bash
code-review-graph register C:\Users\lee\workspace\FridgeMate --alias fridgemate
```

Confirm registration:

```bash
code-review-graph repos
```

## Refresh Before Review

After a meaningful code change, refresh the graph before asking it for review context:

```bash
code-review-graph update --repo C:\Users\lee\workspace\FridgeMate
```

Use a full rebuild if the incremental graph looks stale:

```bash
code-review-graph build --repo C:\Users\lee\workspace\FridgeMate
```

## Review Pattern

- Start with graph stats to confirm the graph is present and recently updated.
- Use focused review context for the changed files instead of broad minimal context when the broad tool is slow.
- Treat low or zero impacted-node output as a prompt for manual review, not proof that a change is risk-free.
- For the current MFDS/Supabase scripts, review the changed scripts, SQL, and docs together because the graph sees them as low-risk standalone tooling.
