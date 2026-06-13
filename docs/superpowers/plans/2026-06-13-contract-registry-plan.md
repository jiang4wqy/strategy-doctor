# Strategy Contract And Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the shared multi-strategy type contract, immutable adapter registry, and registered MA adapter without changing existing runtime results.

**Architecture:** Define the closed two-archetype discriminated union in `contracts.ts`, while explicitly narrowing the still-MA-only execution and prescription code to `MaCrossParams`. Add a complete `maCrossAdapter` and registry, then make runtime strategy parsing delegate parameter validation and strategy construction to that registry. RSI execution remains unsupported until the strategy branch registers its adapter.

**Tech Stack:** Node.js 24 native TypeScript, `node:test`, strict TypeScript, no runtime dependencies.

**Execution status:** Tasks 1-3 completed on 2026-06-13. Task 4 is completed
when the verified baseline and role branches are pushed.

---

### Task 1: Freeze The Shared Type Contract

**Files:**
- Modify: `src/contracts.ts`
- Modify: `src/backtest/mock.ts`
- Modify: `src/backtest/bitget.ts`
- Modify: `src/prescribe/mutations.ts`
- Modify: `src/prescribe/evolve.ts`
- Modify: `tests/contracts.test.ts`
- Modify: `tests/backtest/mock.test.ts`
- Modify: `tests/prescribe/mutations.test.ts`
- Modify: `tests/integration/five-dimension-cycle.test.ts`

- [ ] **Step 1: Write the type-contract test**

Extend `tests/contracts.test.ts` to import and construct:

```ts
import type {
  MaCrossStrategy,
  RsiBollingerStrategy,
  Strategy,
} from '../src/contracts.ts';

const meanReversion: RsiBollingerStrategy = {
  id: 'mr1',
  name: 'mean reversion',
  archetype: 'rsi-bollinger-mean-reversion',
  params: {
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    bollingerPeriod: 20,
    bollingerStdDev: 2,
    leverage: 3,
    stopLossPct: 0.08,
    positionPct: 0.5,
  },
  universe: ['BTCUSDT'],
  timeframe: '1h',
};

const strategies: Strategy[] = [movingAverage, meanReversion];
assert.deepEqual(
  strategies.map(strategy => strategy.archetype),
  ['ma-cross', 'rsi-bollinger-mean-reversion'],
);
```

- [ ] **Step 2: Run typecheck and verify RED**

Run:

```powershell
npm.cmd run typecheck
```

Expected: FAIL because `MaCrossStrategy` and `RsiBollingerStrategy` are not exported.

- [ ] **Step 3: Implement the shared contract**

Replace the MA-only strategy contract with:

```ts
export interface CommonRiskParams {
  leverage: number;
  stopLossPct: number;
  positionPct: number;
}

export interface MaCrossParams extends CommonRiskParams {
  fastMA: number;
  slowMA: number;
}

export interface RsiBollingerParams extends CommonRiskParams {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
}

export interface StrategyBase {
  id: string;
  name: string;
  universe: string[];
  timeframe: string;
}

export interface MaCrossStrategy extends StrategyBase {
  archetype: 'ma-cross';
  params: MaCrossParams;
}

export interface RsiBollingerStrategy extends StrategyBase {
  archetype: 'rsi-bollinger-mean-reversion';
  params: RsiBollingerParams;
}

export type Strategy = MaCrossStrategy | RsiBollingerStrategy;
export type StrategyParams = Strategy['params'];
export type StrategyArchetype = Strategy['archetype'];

export interface ParamsByArchetype {
  'ma-cross': MaCrossParams;
  'rsi-bollinger-mean-reversion': RsiBollingerParams;
}

export type StrategyByArchetype<A extends StrategyArchetype> =
  Extract<Strategy, { archetype: A }>;

export type StrategyParamKey =
  | keyof MaCrossParams
  | keyof RsiBollingerParams;

export type ParameterChanges =
  Partial<Record<StrategyParamKey, number>>;

export type PositionDirection = -1 | 0 | 1;
export type StrategyDecision = 'hold' | 'flat' | 'long' | 'short';

export interface DecisionContext {
  prices: readonly number[];
  index: number;
  position: PositionDirection;
  entryPrice: number;
}

export interface TargetedPatch<P> {
  patch: Partial<P>;
  rationale: string[];
}

export interface StrategyAdapter<A extends StrategyArchetype> {
  readonly archetype: A;
  parseParams(value: unknown): ParamsByArchetype[A];
  decide(
    params: ParamsByArchetype[A],
    context: DecisionContext,
  ): StrategyDecision;
  targetedPatch(
    params: ParamsByArchetype[A],
    causes: readonly DeathCause[],
  ): TargetedPatch<ParamsByArchetype[A]>;
  targetedFields(
    causes: ReadonlySet<DeathCause>,
  ): readonly (keyof ParamsByArchetype[A])[];
  jitterParams(
    params: ParamsByArchetype[A],
    random: () => number,
    fields: readonly (keyof ParamsByArchetype[A])[],
  ): ParamsByArchetype[A];
  paramLabel(key: keyof ParamsByArchetype[A]): string;
}
```

Change `Prescription.changes` to `ParameterChanges`.

- [ ] **Step 4: Narrow existing MA-only implementation types**

Use `MaCrossParams` in:

- `runOnPrices`
- `targetedPatch`
- `jitterParams`
- `diffParams`
- MA candidate evaluation and labels in `evolve.ts`
- MA-specific tests

Add explicit guards before existing MA-only execution:

```ts
if (strategy.archetype !== 'ma-cross') {
  throw new Error(`unsupported strategy archetype: ${strategy.archetype}`);
}
```

The guards are transitional and must not alter valid MA behavior.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```powershell
node --test tests/contracts.test.ts tests/backtest/mock.test.ts tests/prescribe/mutations.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the type contract**

```powershell
git add src/contracts.ts src/backtest/mock.ts src/backtest/bitget.ts `
  src/prescribe/mutations.ts src/prescribe/evolve.ts `
  tests/contracts.test.ts tests/backtest/mock.test.ts `
  tests/prescribe/mutations.test.ts tests/integration/five-dimension-cycle.test.ts
git commit -m "refactor: define multi-strategy type contract"
```

### Task 2: Add The MA Adapter And Immutable Registry

**Files:**
- Create: `src/strategy/adapters/ma-cross.ts`
- Create: `src/strategy/registry.ts`
- Create: `tests/strategy/registry.test.ts`

- [ ] **Step 1: Write failing registry tests**

Cover:

```ts
test('registry returns the registered MA adapter', () => {
  assert.equal(getStrategyAdapter('ma-cross').archetype, 'ma-cross');
});

test('registry rejects unsupported registered archetypes', () => {
  assert.throws(
    () => getStrategyAdapter('rsi-bollinger-mean-reversion'),
    /unsupported strategy archetype/i,
  );
});

test('registry rejects duplicate adapter registration', () => {
  assert.throws(
    () => createStrategyRegistry([maCrossAdapter, maCrossAdapter]),
    /duplicate strategy archetype/i,
  );
});

test('MA adapter parses parameters and reproduces MA decisions', () => {
  const adapter = getStrategyAdapter('ma-cross');
  assert.deepEqual(adapter.parseParams(validParams), validParams);
  assert.equal(
    adapter.decide(validParams, {
      prices: [1, 2, 3, 4],
      index: 3,
      position: 0,
      entryPrice: 0,
    }),
    'long',
  );
});
```

Also test invalid MA bounds, `hold` before indicators are ready, MA parameter
labels, targeted fields, targeted patch, and deterministic jitter delegation.

- [ ] **Step 2: Run the registry test and verify RED**

Run:

```powershell
node --test tests/strategy/registry.test.ts
```

Expected: FAIL because the adapter and registry modules do not exist.

- [ ] **Step 3: Implement `maCrossAdapter`**

`src/strategy/adapters/ma-cross.ts` must:

- Parse the five MA/risk parameters with the current validation messages.
- Reproduce the existing SMA signal with `hold`, `long`, and `short`.
- Delegate the current patch and jitter behavior without changing values.
- Return current targeted fields by death cause.
- Return the current Chinese parameter labels.

Do not move the common execution loop in this task.

- [ ] **Step 4: Implement the immutable registry**

`src/strategy/registry.ts` must export:

```ts
export type AnyStrategyAdapter = {
  [A in StrategyArchetype]: StrategyAdapter<A>;
}[StrategyArchetype];

export interface StrategyRegistry {
  get<A extends StrategyArchetype>(archetype: A): StrategyAdapter<A>;
  parse<A extends StrategyArchetype>(
    archetype: A,
    base: StrategyBase,
    value: unknown,
  ): StrategyByArchetype<A>;
}

export function createStrategyRegistry(
  adapters: readonly AnyStrategyAdapter[],
): StrategyRegistry;

export const strategyRegistry: StrategyRegistry;

export function getStrategyAdapter<A extends StrategyArchetype>(
  archetype: A,
): StrategyAdapter<A>;
```

Build the default registry with only `maCrossAdapter`. Use one contained cast
inside the registry to restore the archetype/params correlation. Freeze the
returned registry object.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
node --test tests/strategy/registry.test.ts tests/prescribe/mutations.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the registry**

```powershell
git add src/strategy/adapters/ma-cross.ts src/strategy/registry.ts `
  tests/strategy/registry.test.ts
git commit -m "feat: register moving-average strategy adapter"
```

### Task 3: Route Parsing Through The Registry And Freeze The Baseline

**Files:**
- Modify: `src/strategy/parse.ts`
- Modify: `tests/strategy/parse.test.ts`
- Modify: `docs/superpowers/specs/2026-06-13-multi-strategy-design.md`
- Modify: `handoff.md`

- [ ] **Step 1: Write failing parser tests**

Add:

```ts
test('parseStrategy rejects a known but unregistered strategy', () => {
  assert.throws(
    () => parseStrategy({
      ...validStrategy,
      archetype: 'rsi-bollinger-mean-reversion',
      params: {},
    }),
    /unsupported strategy archetype/i,
  );
});
```

Keep all existing MA validation tests.

- [ ] **Step 2: Run the parser test and verify RED**

Run:

```powershell
node --test tests/strategy/parse.test.ts
```

Expected: FAIL because parsing still contains the MA-only inline parser rather
than registry delegation.

- [ ] **Step 3: Implement registry-driven parsing**

`parseStrategy` must:

1. Parse common identity and market fields.
2. Require the raw archetype to equal one of the closed contract archetypes.
3. Call `strategyRegistry.parse(archetype, base, rawParams)`.
4. Let the registry reject the known-but-unregistered RSI adapter.

Remove the inline MA parameter parser from `parse.ts`.

- [ ] **Step 4: Mark the design approved and update handoff**

Change the design status to:

```text
Approved on 2026-06-13; contract/registry implementation in progress.
```

Record the contract commit, verification results, and the exact role branches
that will be created from the final contract HEAD.

- [ ] **Step 5: Run golden compatibility verification**

Run:

```powershell
npm.cmd run verify
node src/cli.ts examples/trend-follower.json --style conservative `
  --seed 42 --candidates 6 --format json `
  --output $env:TEMP\strategy-doctor-contract.json
Compare-Object `
  (Get-Content examples/demo-scorecard.json) `
  (Get-Content $env:TEMP\strategy-doctor-contract.json)
git diff --check
```

Expected:

- 0 failed tests.
- Existing coverage thresholds pass.
- Typecheck and offline demo pass.
- `Compare-Object` emits no differences.

- [ ] **Step 6: Commit the approved contract baseline**

```powershell
git add src/strategy/parse.ts tests/strategy/parse.test.ts `
  docs/superpowers/specs/2026-06-13-multi-strategy-design.md handoff.md
git commit -m "refactor: parse strategies through adapter registry"
```

### Task 4: Create Role Branches From The Contract HEAD

**Files:** None.

- [ ] **Step 1: Confirm the integration worktree is clean**

```powershell
git status --short --branch
npm.cmd run verify
```

Expected: clean `feat/multi-strategy-integration`, all verification passing.

- [ ] **Step 2: Create the four role branches**

```powershell
git branch feat/ma-adapter-integration HEAD
git branch feat/rsi-bollinger-adapter HEAD
git branch feat/generic-risk-engine HEAD
git branch test/multi-strategy-acceptance HEAD
```

- [ ] **Step 3: Verify all branches share the contract commit**

```powershell
git show-ref --heads |
  Select-String 'ma-adapter-integration|rsi-bollinger-adapter|generic-risk-engine|multi-strategy-acceptance'
```

Expected: all four refs point to the same contract HEAD.

- [ ] **Step 4: Push integration and role branches**

```powershell
git push -u origin feat/multi-strategy-integration
git push origin feat/ma-adapter-integration
git push origin feat/rsi-bollinger-adapter
git push origin feat/generic-risk-engine
git push origin test/multi-strategy-acceptance
```

Expected: all branches are available to team members. Each member works only on
their assigned branch and opens a PR back to `feat/multi-strategy-integration`.
