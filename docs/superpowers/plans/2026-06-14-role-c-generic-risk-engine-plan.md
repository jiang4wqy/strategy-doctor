# Role C Generic Risk Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move position and risk execution into one adapter-driven engine, then make both backtest entry points and prescription search strategy-generic without changing the MA golden result.

**Architecture:** `src/backtest/engine.ts` owns the common price loop and receives a validated strategy plus its adapter. Backtest adapters resolve through the immutable registry. `src/prescribe/evolve.ts` delegates patching, mutable fields, jitter, and labels to the selected adapter while retaining candidate ranking and generic intent guards.

**Tech Stack:** Node.js 24 native TypeScript, strict TypeScript, `node:test`, no runtime dependencies.

---

### Task 1: Extract The Shared Execution Engine

**Files:**
- Create: `tests/backtest/engine.test.ts`
- Create: `src/backtest/engine.ts`

- [x] **Step 1: Write failing engine tests**

Cover:

- invalid price arrays are rejected;
- MA results match the current `runOnPrices` metrics for trend and gap fixtures;
- `flat` closes an open position without counting a new trade;
- a stopped direction remains blocked through `hold`;
- `flat` while neutral clears the stopped-direction block and permits re-entry;
- the opposite direction may enter while the stopped direction is blocked;
- a mismatched strategy and adapter archetype is rejected.

- [x] **Step 2: Verify RED**

Run:

```powershell
node --test tests/backtest/engine.test.ts
```

Expected: FAIL because `src/backtest/engine.ts` does not exist.

- [x] **Step 3: Implement `runStrategyOnPrices`**

Export:

```ts
runStrategyOnPrices(
  strategy: Strategy,
  prices: readonly number[],
  adapter: AnyStrategyAdapter,
): Metrics
```

Preserve the frozen loop order: prior-position PnL, liquidation excursion,
stop excursion, equity floor, adapter decision, position transition, then
drawdown update.

- [x] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/backtest/engine.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add src/backtest/engine.ts tests/backtest/engine.test.ts
git commit -m "refactor: extract generic strategy execution engine"
```

### Task 2: Route Backtest Entry Points Through The Engine

**Files:**
- Modify: `tests/backtest/mock.test.ts`
- Modify: `tests/backtest/bitget.test.ts`
- Modify: `src/backtest/mock.ts`
- Modify: `src/backtest/bitget.ts`

- [x] **Step 1: Add failing dispatch tests**

Add a local registry-backed test adapter only where necessary and assert:

- `runOnPrices(MaCrossParams, prices)` remains byte-for-byte compatible;
- `MockBacktester` resolves the strategy adapter instead of checking
  `archetype === 'ma-cross'`;
- `BitgetBacktester` passes stressed close prices to the shared engine.

- [x] **Step 2: Verify RED**

Run:

```powershell
node --test tests/backtest/mock.test.ts tests/backtest/bitget.test.ts
```

Expected: new dispatch assertions fail against the MA-only loops.

- [x] **Step 3: Replace local loops**

`runOnPrices` constructs a minimal MA strategy and calls
`runStrategyOnPrices` with `maCrossAdapter`. Both backtester classes resolve
their adapter with `getStrategyAdapter(strategy.archetype)` and call the shared
engine. Candle loading, caching, and shock transformation remain unchanged.

- [x] **Step 4: Verify GREEN and MA golden**

Run:

```powershell
node --test tests/backtest/engine.test.ts tests/backtest/mock.test.ts tests/backtest/bitget.test.ts
npm.cmd run typecheck
```

Generate the seed 42 / six-candidate JSON and verify its SHA-256 remains:

```text
60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90
```

- [x] **Step 5: Commit**

```powershell
git add src/backtest/mock.ts src/backtest/bitget.ts tests/backtest/mock.test.ts tests/backtest/bitget.test.ts
git commit -m "refactor: dispatch backtests through strategy adapters"
```

### Task 3: Make Prescription Search Adapter-Driven

**Files:**
- Modify: `tests/prescribe/evolve.test.ts`
- Modify: `tests/prescribe/mutations.test.ts`
- Modify: `src/prescribe/evolve.ts`
- Modify: `src/prescribe/mutations.ts`

- [x] **Step 1: Write failing generic prescription tests**

Use a test-local adapter registered through `createStrategyRegistry` only for
unit-level generic behavior, or exercise the MA adapter through the default
registry. Assert:

- `prescribe` calls adapter `targetedPatch`, `targetedFields`, `jitterParams`,
  and `paramLabel`;
- patched strategies preserve their archetype and parameter shape;
- no actionable deaths still return the original strategy;
- candidate ordering remains survived, score, liquidation count, drawdown,
  then mean PnL;
- direction of every targeted patch is preserved during jitter;
- liquidation stop loss remains inside half of the simplified liquidation
  line.

- [x] **Step 2: Verify RED**

Run:

```powershell
node --test tests/prescribe/evolve.test.ts tests/prescribe/mutations.test.ts
```

Expected: generic adapter-policy assertions fail because `evolve.ts` imports
MA-specific mutation helpers.

- [x] **Step 3: Generalize parameter diff**

Change `diffParams` to:

```ts
export function diffParams<P extends object>(
  before: P,
  after: P,
): Partial<P>
```

Keep the legacy MA mutation exports temporarily for A's migration compatibility
test, but remove their use from `evolve.ts`.

- [x] **Step 4: Delegate prescription policy**

Resolve the selected adapter from the registry. Use adapter-owned targeted
patches, fields, jitter, and labels. Preserve targeted intent generically:

- common liquidation and drawdown bounds remain explicit;
- for other patched numeric fields, candidates may not cross back through the
  adapter's targeted base value in the opposite direction.

- [x] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/prescribe/evolve.test.ts tests/prescribe/mutations.test.ts tests/strategy/ma-cross-compatibility.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```powershell
git add src/prescribe/evolve.ts src/prescribe/mutations.ts tests/prescribe/evolve.test.ts tests/prescribe/mutations.test.ts
git commit -m "refactor: delegate prescription policy to adapters"
```

### Task 4: Verify And Hand Off Role C

**Files:**
- Modify: `handoff.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/superpowers/plans/2026-06-14-role-c-generic-risk-engine-plan.md`

- [x] **Step 1: Run complete verification**

```powershell
npm.cmd run verify
git diff --check
```

Expected: all tests, coverage, typecheck, and offline demo pass.

- [x] **Step 2: Verify MA golden compatibility**

Compare generated seed 42 / six-candidate JSON byte-for-byte with
`examples/demo-scorecard.json`.

- [x] **Step 3: Record integration boundary**

Document:

- C completed engine and adapter-driven prescription;
- C did not register the RSI/Bollinger adapter;
- B PR #7 must merge next;
- A then registers the adapter and handles CLI wiring;
- D remains responsible for examples and end-to-end acceptance.

- [ ] **Step 4: Commit, push, and open Draft PR**

```powershell
git add CONTRIBUTING.md handoff.md docs/superpowers/plans/2026-06-14-role-c-generic-risk-engine-plan.md
git commit -m "docs: record role c engine handoff"
git push origin feat/generic-risk-engine
```

Open a Draft PR to `main`, with B PR #7 and A final integration listed as the
next dependencies.
