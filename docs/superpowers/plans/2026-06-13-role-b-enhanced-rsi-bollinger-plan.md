# Role B Enhanced RSI Bollinger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a deterministic RSI + Bollinger mean-reversion adapter with a long-term trend filter, strategy-specific mutation policy, and complete focused tests.

**Architecture:** Add pure close-price indicator functions, then compose them inside a self-contained `rsiBollingerAdapter`. The adapter validates all strategy parameters, blocks wrong-way entries during strong trends, keeps exits independent from the filter, and owns its mutation and jitter policy. B does not register the adapter globally or modify the shared execution engine.

**Tech Stack:** Node.js 24 native TypeScript, strict TypeScript, `node:test`, no runtime dependencies.

---

### Task 1: Extend The Enhanced Strategy Contract

**Files:**
- Modify: `tests/contracts.test.ts`
- Modify: `src/contracts.ts`

- [ ] **Step 1: Add trend-filter fields to the typed contract fixture**

Add:

```ts
trendFilterPeriod: 50,
trendFilterThreshold: 0.03,
```

to the `RsiBollingerStrategy` fixture and assert both values.

- [ ] **Step 2: Run typecheck and verify RED**

Run:

```powershell
npm.cmd run typecheck
```

Expected: FAIL because the two fields are not defined on
`RsiBollingerParams`.

- [ ] **Step 3: Extend `RsiBollingerParams`**

Add:

```ts
trendFilterPeriod: number;
trendFilterThreshold: number;
```

- [ ] **Step 4: Verify the contract**

Run:

```powershell
node --test tests/contracts.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/contracts.ts tests/contracts.test.ts
git commit -m "feat: extend mean reversion contract"
```

### Task 2: Implement Deterministic Indicators

**Files:**
- Create: `tests/strategy/indicators.test.ts`
- Create: `src/strategy/indicators.ts`

- [ ] **Step 1: Write failing indicator tests**

Cover:

```ts
assert.equal(simpleMovingAverage([1, 2, 3, 4], 3, 3), 3);
assert.equal(simpleMovingAverage([1, 2], 3, 1), null);

assert.ok(
  Math.abs(
    populationStandardDeviation([1, 2, 3], 3, 2)!
      - Math.sqrt(2 / 3),
  ) < 1e-12,
);

assert.equal(wilderRsi([1, 2, 3, 4], 3, 3), 100);
assert.equal(wilderRsi([4, 3, 2, 1], 3, 3), 0);
assert.equal(wilderRsi([1, 1, 1, 1], 3, 3), 50);
assert.ok(
  Math.abs(wilderRsi([1, 2, 3, 2, 4], 3, 4)! - 83.33333333333333)
    < 1e-12,
);
assert.equal(wilderRsi([1, 2, 3], 3, 2), null);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/strategy/indicators.test.ts
```

Expected: FAIL because `src/strategy/indicators.ts` does not exist.

- [ ] **Step 3: Implement the pure indicators**

Export:

```ts
simpleMovingAverage(
  prices: readonly number[],
  period: number,
  index: number,
): number | null

populationStandardDeviation(
  prices: readonly number[],
  period: number,
  index: number,
): number | null

wilderRsi(
  prices: readonly number[],
  period: number,
  index: number,
): number | null
```

Wilder RSI uses the first `period` deltas as the initial simple averages and
then recursively smooths all later deltas. Flat windows return 50.

- [ ] **Step 4: Run tests and typecheck**

Run:

```powershell
node --test tests/strategy/indicators.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/strategy/indicators.ts tests/strategy/indicators.test.ts
git commit -m "feat: add deterministic strategy indicators"
```

### Task 3: Implement The Enhanced Adapter

**Files:**
- Create: `tests/strategy/rsi-bollinger.test.ts`
- Create: `src/strategy/adapters/rsi-bollinger.ts`

- [ ] **Step 1: Write failing adapter tests**

Use this compact decision fixture:

```ts
const decisionParams: RsiBollingerParams = {
  rsiPeriod: 2,
  rsiOversold: 40,
  rsiOverbought: 60,
  bollingerPeriod: 3,
  bollingerStdDev: 1,
  trendFilterPeriod: 4,
  trendFilterThreshold: 0.2,
  leverage: 3,
  stopLossPct: 0.08,
  positionPct: 0.5,
};
```

Tests must cover:

- valid parsing and every numeric/cross-field bound;
- `[10, 10, 10, 9]` enters long with threshold `0.2`;
- `[10, 10, 10, 11]` enters short with threshold `0.2`;
- the same entries are blocked with threshold `0.03`;
- existing long and short positions exit at middle-band/RSI-50 conditions;
- a strong trend does not force an existing position to exit;
- indicators not ready return `hold`;
- liquidation and drawdown only patch common risk fields;
- stop-loss bleed patches Bollinger width, RSI thresholds, and trend threshold;
- targeted fields and Chinese labels are stable;
- identical jitter seeds return identical valid parameters.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/strategy/rsi-bollinger.test.ts
```

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement parsing**

Validate:

```text
rsiPeriod integer >= 2
0 < rsiOversold < 50
50 < rsiOverbought < 100
bollingerPeriod integer >= 2
0 < bollingerStdDev <= 5
trendFilterPeriod integer > bollingerPeriod
0 < trendFilterThreshold <= 0.5
leverage >= 1
0 < stopLossPct <= 0.99
0 < positionPct <= 1
```

- [ ] **Step 4: Implement decisions**

Calculate Bollinger middle/deviation, Wilder RSI, trend SMA, and:

```ts
const trendDeviation = close / trendAverage - 1;
const strongUptrend =
  trendDeviation > params.trendFilterThreshold;
const strongDowntrend =
  trendDeviation < -params.trendFilterThreshold;
```

Exit existing positions before considering new entries. The trend flags only
block new entries.

- [ ] **Step 5: Implement mutation policy**

Use the existing common formulas for liquidation and drawdown. For
`stop-loss-bleed`:

```ts
patch.bollingerStdDev = Math.min(
  5,
  Number((params.bollingerStdDev * 1.15).toFixed(3)),
);
patch.rsiOversold = Math.max(1, params.rsiOversold - 3);
patch.rsiOverbought = Math.min(99, params.rsiOverbought + 3);
patch.trendFilterThreshold = Math.max(
  0.001,
  Number((params.trendFilterThreshold * 0.85).toFixed(4)),
);
```

Jitter uses the MA adapter's deterministic `0.8 + random() * 0.4` multiplier,
clamps every parser bound, and preserves
`trendFilterPeriod > bollingerPeriod`.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
node --test tests/architecture/strategy-boundaries.test.ts tests/strategy/indicators.test.ts tests/strategy/rsi-bollinger.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/strategy/adapters/rsi-bollinger.ts tests/strategy/rsi-bollinger.test.ts
git commit -m "feat: add trend-filtered mean reversion adapter"
```

### Task 4: Prove Temporary Registry Compatibility

**Files:**
- Modify: `tests/strategy/rsi-bollinger.test.ts`

- [ ] **Step 1: Add a local registry test**

Create a registry with:

```ts
createStrategyRegistry([maCrossAdapter, rsiBollingerAdapter])
```

Parse a complete enhanced strategy and assert the discriminated
`rsi-bollinger-mean-reversion` result.

- [ ] **Step 2: Run focused tests**

Run:

```powershell
node --test tests/strategy/rsi-bollinger.test.ts tests/strategy/registry.test.ts
npm.cmd run typecheck
```

Expected: PASS. The default global registry remains unchanged for A.

- [ ] **Step 3: Commit**

```powershell
git add tests/strategy/rsi-bollinger.test.ts
git commit -m "test: prove mean reversion registry compatibility"
```

### Task 5: Record B Handoff And Verify

**Files:**
- Modify: `handoff.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/superpowers/plans/2026-06-13-role-b-enhanced-rsi-bollinger-plan.md`

- [ ] **Step 1: Record ownership status**

Document:

- enhanced contract fields;
- indicators and adapter completed;
- B did not modify registry, engine, prescription consumer, CLI, or examples;
- A must register the adapter after review;
- C must execute `flat` and consume adapter mutation policy.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm.cmd run verify
git diff --check
git status --short
```

Expected: all tests, coverage, typecheck, and offline MA demo pass.

- [ ] **Step 3: Verify MA golden compatibility**

Generate seed 42 / six-candidate JSON and compare it byte-for-byte with
`examples/demo-scorecard.json`. The SHA-256 must remain:

```text
60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90
```

- [ ] **Step 4: Commit and push**

```powershell
git add CONTRIBUTING.md handoff.md docs/superpowers/plans/2026-06-13-role-b-enhanced-rsi-bollinger-plan.md
git commit -m "docs: record role b adapter handoff"
git push origin feat/rsi-bollinger-adapter
```

- [ ] **Step 5: Open a draft PR**

Open a draft PR to `main` that declares dependencies on C for shared execution
and A for global registration.
