# Role A Final Multi-Strategy Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register the enhanced RSI/Bollinger adapter in the default runtime registry and prove the existing generic parser, backtest, prescription, and CLI pipeline can execute it.

**Architecture:** Keep the final A change deliberately small. The CLI and pipeline already consume the registry-backed parser, shared engine, and adapter-driven prescription; therefore global registration is the only production wiring needed. Tests and a temporary CLI fixture prove the full path without taking ownership of D's permanent example.

**Tech Stack:** Node.js 24 native TypeScript, strict TypeScript, `node:test`, GitHub Actions.

---

### Task 1: Register The Second Adapter

**Files:**
- Modify: `tests/strategy/registry.test.ts`
- Modify: `tests/strategy/parse.test.ts`
- Modify: `src/strategy/registry.ts`

- [x] **Step 1: Write failing registration tests**

Assert:

- `getStrategyAdapter('rsi-bollinger-mean-reversion')` returns the B adapter;
- the default registry parses a fully populated enhanced strategy;
- `parseStrategy` accepts the second archetype and preserves both trend fields.

- [x] **Step 2: Verify RED**

```powershell
node --test tests/strategy/registry.test.ts tests/strategy/parse.test.ts
```

Expected: FAIL because the default registry contains only `maCrossAdapter`.

- [x] **Step 3: Register `rsiBollingerAdapter`**

Import the adapter and initialize:

```ts
createStrategyRegistry([maCrossAdapter, rsiBollingerAdapter])
```

No parser or CLI branch should be added.

- [x] **Step 4: Verify GREEN**

```powershell
node --test tests/strategy/registry.test.ts tests/strategy/parse.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add src/strategy/registry.ts tests/strategy/registry.test.ts tests/strategy/parse.test.ts
git commit -m "feat: register RSI Bollinger strategy"
```

### Task 2: Prove Full CLI Wiring

**Files:**
- No permanent production or example file required.

- [x] **Step 1: Create a temporary complete strategy JSON**

Use:

```json
{
  "id": "rsi-bollinger-demo",
  "name": "RSI Bollinger Mean Reversion",
  "archetype": "rsi-bollinger-mean-reversion",
  "params": {
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
  },
  "universe": ["BTCUSDT"],
  "timeframe": "4h"
}
```

- [x] **Step 2: Run the complete offline CLI**

```powershell
node src/cli.ts <temp-json> --style conservative --seed 42 --candidates 6 --format json
```

Expected: exit 0 with five evaluations, three style scores, a prescription,
and held-out trade-off.

- [x] **Step 3: Verify MA golden**

Confirm the original seed 42 / six-candidate MA output remains byte-for-byte
equal to `examples/demo-scorecard.json`.

### Task 3: Verify And Hand Off A Final Integration

**Files:**
- Modify: `handoff.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/superpowers/plans/2026-06-14-role-a-final-integration-plan.md`

- [x] **Step 1: Run complete verification**

```powershell
npm.cmd run verify
git diff --check
```

- [x] **Step 2: Record status**

Document that A, B, and C are integrated; D is the only remaining development
stage and owns the permanent example, CLI acceptance tests, README, and demo
material.

- [x] **Step 3: Commit, push, and open PR**

Push `feat/ma-adapter-integration`, open a new PR to `main`, wait for CI, and
merge it before starting D.
