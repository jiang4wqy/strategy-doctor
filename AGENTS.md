# Strategy Doctor Agent Rules

These instructions apply to the entire repository.

## Required Reading

Before changing files, read:

1. `handoff.md`
2. `CONTRIBUTING.md`
3. `docs/superpowers/specs/2026-06-14-developer-platform-design.md`
4. The implementation plan assigned to the current branch.

If these files disagree, stop and surface the conflict before editing.

## Current Scope

The active milestone is the Track 2 submission hardening pass on top of the
completed P1 developer platform:

- Preserve the verified CLI, MA golden output, and deterministic offline
  defaults.
- Expose capability metadata, a shared diagnosis service, and REST API v1.
- Parse supported Chinese and English strategy descriptions into a draft.
- Require explicit structured confirmation before diagnosis.
- Add a React/Vite/ECharts reference client and local-only browser history.
- Add a first-party TypeScript client, OpenAPI, MCP adapter, public showcase,
  developer guide, and team preview workflow.

The current public registry contains four reviewed archetypes:
`ma-cross`, `rsi-bollinger-mean-reversion`, `breakout-confirmation`, and
`atr-trend-breakout`. The product remains single-symbol and offline Mock by
default. Do not add arbitrary strategy code, a DSL, private account access,
order placement, or claims of permanent cloud hosting without explicit review.

## Workspace Isolation

- Use one branch and one Git worktree per worker.
- Never share a working directory between workers.
- Do not switch branches in another worker's checkout.
- Do not use `git reset --hard`, `git checkout --`, force-push, or history
  rewrites on shared branches.
- Treat unexpected file or branch changes as concurrent work. Stop, inspect
  `git status` and `git reflog`, then coordinate instead of reverting.

## Ownership

The Foundation/integration owner has exclusive control of:

- `src/contracts.ts`
- `src/platform/**`
- `src/strategy/parse.ts`
- `src/strategy/registry.ts`
- `src/cli.ts`
- `package.json`
- `package-lock.json`
- root TypeScript and build configuration
- pull-request merges into `main`

Other ownership lanes are defined in `CONTRIBUTING.md`. A worker must not edit
another lane's files without recording the cross-lane dependency in the PR.
Historical P1 foundation commits should be treated as immutable unless the
current task explicitly updates governance documentation.

## Change Discipline

- Keep every diff limited to the assigned task.
- Match existing TypeScript and test patterns.
- Write a failing test before behavior changes.
- Preserve deterministic seeds and the offline default.
- Do not weaken coverage thresholds or change shocks to force a death.
- Shared contract changes require parser tests, type coverage, migration notes,
  and an example strategy.
- Do not add runtime dependencies unless the design spec explicitly requires
  them.
- API, Web, natural-language, and client implementations consume
  `src/platform/contracts.ts`; they must not create competing DTO tables.
- Never update `examples/demo-scorecard.json` to hide a regression.

## Verification

Before handing off a branch, run:

```powershell
npm.cmd ci
npm.cmd run verify
git diff --check
git status --short
```

Report the test counts, coverage, skipped tests, changed files, known limits,
and required merge order.

## Security Boundary

- Never commit credentials, account data, positions, or private market data.
- Bitget integration remains public market data only.
- CI and the default demo must remain offline.
- The public Web/API path uses `MockBacktester` only in P1.
- Public preview requires an access code or Bearer API key.
- Reports are diagnostics, not trading or return guarantees.
