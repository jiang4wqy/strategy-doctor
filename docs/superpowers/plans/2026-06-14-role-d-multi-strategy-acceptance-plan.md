# Role D Multi-Strategy Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the permanent RSI/Bollinger example, prove both strategies complete the same offline doctor workflow, and update all public-facing submission material to the final two-strategy state.

**Architecture:** Keep production code frozen. Acceptance tests exercise the registered adapters through the real parser, CLI, shared backtester, doctor pipeline, prescription search, and held-out validation. Documentation presents MA trend following and RSI/Bollinger mean reversion as complementary reference strategies.

**Tech Stack:** Node.js 24 native TypeScript, strict TypeScript, `node:test`, Markdown/JSON artifacts.

---

### Task 1: Add The Permanent Example And CLI Acceptance

**Files:**
- Create: `examples/rsi-bollinger.json`
- Modify: `tests/cli.test.ts`

- [x] **Step 1: Write a failing dual-strategy CLI test**

For both `examples/trend-follower.json` and the missing
`examples/rsi-bollinger.json`, run:

```powershell
node src/cli.ts <strategy> --style conservative --seed 42 --candidates 6 --format json
```

Assert five evaluations, three style scores, a prescription whose patched
strategy keeps the input archetype, and finite held-out trade-off values.

- [x] **Step 2: Verify RED**

```powershell
node --test tests/cli.test.ts
```

Expected: FAIL because `examples/rsi-bollinger.json` does not exist.

- [x] **Step 3: Add the enhanced example**

Use the approved parameters:

```json
{
  "rsiPeriod": 14,
  "rsiOversold": 30,
  "rsiOverbought": 70,
  "bollingerPeriod": 20,
  "bollingerStdDev": 2,
  "trendFilterPeriod": 50,
  "trendFilterThreshold": 0.03,
  "leverage": 3,
  "stopLossPct": 0.05,
  "positionPct": 0.5
}
```

- [x] **Step 4: Verify GREEN**

```powershell
node --test tests/cli.test.ts
npm.cmd run typecheck
```

- [x] **Step 5: Commit**

```powershell
git add examples/rsi-bollinger.json tests/cli.test.ts
git commit -m "test: accept both strategy CLI workflows"
```

### Task 2: Add Shared-Scenario Multi-Strategy Acceptance

**Files:**
- Create: `tests/integration/multi-strategy-acceptance.test.ts`

- [x] **Step 1: Write the acceptance test**

Load both examples through `parseStrategy`, run each through `runDoctor` with
the same seed 42 treatment set and seed 100042 held-out set, and assert:

- both return five evaluations and all three style scores;
- both return a prescription and finite trade-off;
- patched strategies preserve their archetype;
- evaluation metrics or causes differ between the complementary strategies;
- every changed field is allowed by the deaths and selected adapter policy;
- identical repeated runs are deterministic.

- [x] **Step 2: Run and inspect**

```powershell
node --test tests/integration/multi-strategy-acceptance.test.ts
```

Expected: PASS after Task 1. If the chosen frozen scenarios produce no deaths
for one strategy, zero changes are accepted.

- [x] **Step 3: Commit**

```powershell
git add tests/integration/multi-strategy-acceptance.test.ts
git commit -m "test: verify multi-strategy doctor acceptance"
```

### Task 3: Update Public Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/DEMO.md`
- Modify: `docs/SUBMISSION.md`
- Modify: `CONTRIBUTING.md`
- Modify: `handoff.md`
- Modify: `docs/superpowers/plans/2026-06-14-role-d-multi-strategy-acceptance-plan.md`

- [x] **Step 1: Update README**

Document both archetypes, both example commands, the shared adapter/engine
architecture, strategy-specific behavior, and current limitations.

- [x] **Step 2: Update demo and submission material**

Add the RSI/Bollinger comparison command and remove statements that the
submission supports only MA or treats RSI as a future milestone.

- [x] **Step 3: Record final engineering status**

Mark A/B/C/D implementation complete. Keep account-owner tasks such as video
upload and submission URL explicitly separate.

- [x] **Step 4: Commit**

```powershell
git add README.md docs/DEMO.md docs/SUBMISSION.md CONTRIBUTING.md handoff.md docs/superpowers/plans/2026-06-14-role-d-multi-strategy-acceptance-plan.md
git commit -m "docs: finalize multi-strategy submission"
```

### Task 4: Final Verification And Integration

**Files:**
- No additional production files.

- [ ] **Step 1: Run full verification**

```powershell
npm.cmd run verify
git diff --check
```

- [ ] **Step 2: Verify both CLIs and MA golden**

Run both example strategies through JSON output. Compare MA seed 42 output
byte-for-byte with `examples/demo-scorecard.json`.

- [ ] **Step 3: Push, create PR, wait for CI, and merge**

Push `test/multi-strategy-acceptance`, create the final PR to `main`, wait for
required checks, and merge with a merge commit.

- [ ] **Step 4: Verify final `main` and tag**

Fast-forward the main worktree, run `npm.cmd run verify` on merged `main`, then
create and push annotated tag `mvp-m3` if the tag does not already exist.
