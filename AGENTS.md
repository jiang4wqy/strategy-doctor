# Strategy Doctor Agent Rules

These instructions apply to the entire repository.

## Required Reading

Before changing files, read:

1. `handoff.md`
2. `CONTRIBUTING.md`
3. `docs/superpowers/specs/2026-06-13-multi-strategy-design.md`

If these files disagree, stop and surface the conflict before editing.

## Current Scope

The active milestone is P0 multi-strategy support:

- Extract a typed `StrategyAdapter` registry.
- Preserve the existing `ma-cross` behavior.
- Add one `rsi-bollinger-mean-reversion` adapter.
- Share position, stop-loss, liquidation, and equity execution.
- Support strategy-specific prescription mutations.
- Verify both strategies through the same CLI and five-dimension pipeline.

Do not add a strategy DSL, Web UI, account access, order placement, or a third
strategy in this milestone.

## Workspace Isolation

- Use one branch and one Git worktree per worker.
- Never share a working directory between workers.
- Do not switch branches in another worker's checkout.
- Do not use `git reset --hard`, `git checkout --`, force-push, or history
  rewrites on shared branches.
- Treat unexpected file or branch changes as concurrent work. Stop, inspect
  `git status` and `git reflog`, then coordinate instead of reverting.

## Ownership

The integration owner has exclusive control of:

- `src/contracts.ts`
- `src/strategy/parse.ts`
- `src/strategy/registry.ts`
- `src/cli.ts`
- `package.json`
- pull-request merges into `main`

Other ownership lanes are defined in `CONTRIBUTING.md`. A worker must not edit
another lane's files without recording the cross-lane dependency in the PR.

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
- Reports are diagnostics, not trading or return guarantees.
