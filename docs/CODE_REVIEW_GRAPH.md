# Code Review Graph

FridgeMate uses `code-review-graph` as an optional local development tool for understanding code relationships and change impact.

This is not an app runtime dependency. It is only for local review, debugging, and planning.

## Installed Setup

The tool was installed with `pipx` so it stays isolated from the FridgeMate Node/Vite app dependencies.

```bash
pipx install code-review-graph
```

Installed version:

```text
code-review-graph 2.3.2
```

Codex MCP integration was configured with:

```bash
code-review-graph install --platform codex --repo "C:\Users\lee\workspace\FridgeMate" -y
```

Restart Codex after installation so it can pick up the MCP config.

## Local Graph Storage

The graph database is stored locally in:

```text
.code-review-graph/
```

This folder is ignored by git because it contains local database files and absolute path metadata.

## Common Commands

Build or rebuild the graph:

```bash
code-review-graph build
```

Update only changed files:

```bash
code-review-graph update
```

Show graph stats:

```bash
code-review-graph status
```

Analyze change impact:

```bash
code-review-graph detect-changes
```

Generate a visual graph:

```bash
code-review-graph visualize
```

## Windows UTF-8 Note

On Windows, Python may use a legacy console encoding. If `code-review-graph build` fails with an encoding error, run:

```powershell
$env:PYTHONUTF8='1'
code-review-graph build
```

You can set that environment variable before other `code-review-graph` commands too.

## How To Use With Codex

After restarting Codex, ask for graph-assisted review or exploration:

```text
code-review-graph 기준으로 이번 변경의 영향 범위를 봐줘.
```

```text
수동 동기화 로직 변경 전에 관련 파일과 테스트 범위를 찾아줘.
```

```text
이 PR에서 같이 리뷰해야 할 파일 묶음을 code-review-graph로 정리해줘.
```

## Good FridgeMate Use Cases

- Checking the impact of `useIngredients` changes
- Reviewing IndexedDB, auth, and manual sync interactions
- Finding related tests before refactoring
- Understanding recipe import and recommendation dependencies
- Preparing safer commits and pull requests

## Current Graph Snapshot

Last verified local graph:

```text
Nodes: 1021
Edges: 7661
Files: 168
Languages: javascript, bash
Built on branch: main
Built at commit: bba7971
```
