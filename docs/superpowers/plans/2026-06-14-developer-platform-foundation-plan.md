# Developer Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the P1 shared contracts and extract one reusable deterministic diagnosis service without changing existing CLI or MA golden output.

**Architecture:** Extend the existing closed strategy registry with capability metadata, enforce the documented single-symbol market boundary in the runtime parser, expose detailed held-out metrics behind a compatibility wrapper, and add an application service that builds scenarios and transforms the existing Scorecard into API/Web chart data. The CLI migrates to that service but continues rendering and serializing the original Scorecard.

**Tech Stack:** Node.js 24 native TypeScript, strict TypeScript, `node:test`, existing Mock/Bitget backtest adapters, npm.

---

### Task 1: Open P1 Governance And Install Shared Dependencies

**Files:**
- Modify: `AGENTS.md`
- Modify: `CONTRIBUTING.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `web/tsconfig.json`
- Create: `web/src/env.d.ts`

- [ ] **Step 1: Update the milestone and ownership rules**

Replace P0-only scope language with P1 scope from the approved design. Preserve
worktree isolation, TDD, offline defaults, and the prohibition on account/order
features. Record the ownership table from the master plan and state that root
contracts, package files, and integration merges remain exclusive to the
integration owner.

- [ ] **Step 2: Install the approved dependencies once**

Run:

```powershell
npm.cmd install fastify@^5.8.5 @fastify/cookie@^10.0.1 @fastify/static@^9.1.3 @fastify/swagger@^9.7.0 @fastify/rate-limit@^11.0.0 react react-dom echarts
npm.cmd install --save-dev vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/user-event @playwright/test @axe-core/playwright @types/react @types/react-dom
```

Expected: `package.json` and `package-lock.json` change; no dependency is added
by Wave 2 workers.

- [ ] **Step 3: Add the final shared scripts**

Set the script block to include these commands while preserving existing demo
and snapshot commands:

```json
{
  "test:core": "node --test \"tests/**/*.test.ts\"",
  "test:web": "vitest run --config web/vitest.config.ts",
  "test": "npm run test:core && npm run test:web",
  "test:coverage": "node --experimental-test-coverage --test --test-coverage-lines=90 --test-coverage-branches=80 --test-coverage-functions=95 \"tests/**/*.test.ts\"",
  "typecheck:core": "tsc",
  "typecheck:web": "tsc -p web/tsconfig.json",
  "typecheck": "npm run typecheck:core && npm run typecheck:web",
  "build:web": "vite build --config web/vite.config.ts",
  "dev:api": "node --watch src/server/start.ts",
  "dev:web": "vite --config web/vite.config.ts",
  "server": "node src/server/start.ts",
  "web": "npm run build:web && npm run server",
  "test:e2e": "playwright test -c tests/e2e/playwright.config.ts"
}
```

Create `web/src/env.d.ts`:

```ts
/// <reference types="vite/client" />
```

This keeps `typecheck:web` valid before the Web Agent adds components.

Because Wave 2 files do not exist yet, do not run the aggregate `test`,
`typecheck`, or Web scripts in this task.

- [ ] **Step 4: Add the Web TypeScript boundary**

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 5: Verify governance and dependency state**

Run:

```powershell
npm.cmd install --package-lock-only
npm.cmd run test:core
npm.cmd run typecheck:core
git diff --check
```

Expected: existing 155 tests retain 154 pass, 1 skip, 0 fail.

- [ ] **Step 6: Commit**

```powershell
git add AGENTS.md CONTRIBUTING.md package.json package-lock.json tsconfig.json web/tsconfig.json web/src/env.d.ts
git commit -m "chore: open P1 developer platform milestone"
```

### Task 2: Add Capability Definitions And Market Validation

**Files:**
- Modify: `src/contracts.ts`
- Modify: `src/strategy/adapters/ma-cross.ts`
- Modify: `src/strategy/adapters/rsi-bollinger.ts`
- Modify: `src/strategy/registry.ts`
- Modify: `src/strategy/parse.ts`
- Modify: `tests/contracts.test.ts`
- Modify: `tests/strategy/registry.test.ts`
- Modify: `tests/strategy/parse.test.ts`

- [ ] **Step 1: Write failing capability and market-boundary tests**

Add assertions that:

```ts
assert.equal(strategyRegistry.listDefinitions().length, 2);
assert.equal(
  strategyRegistry.getDefinition('ma-cross').parameters[0].key,
  'fastMA',
);
assert.equal(
  parseStrategy({ ...validStrategy, universe: ['btcusdt'] }).universe[0],
  'BTCUSDT',
);
assert.throws(
  () => parseStrategy({ ...validStrategy, universe: ['BTCUSDT', 'ETHUSDT'] }),
  (error: unknown) => (
    error instanceof StrategyValidationError
    && error.code === 'MULTI_SYMBOL_UNSUPPORTED'
    && error.field === 'strategy.universe'
  ),
);
assert.throws(
  () => parseStrategy({ ...validStrategy, universe: ['BTCUSD'] }),
  /USDT/,
);
assert.throws(
  () => parseStrategy({ ...validStrategy, timeframe: '15m' }),
  /timeframe/,
);
```

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
node --test tests/contracts.test.ts tests/strategy/registry.test.ts tests/strategy/parse.test.ts
```

Expected: FAIL because definitions, validation errors, and normalization do not
exist.

- [ ] **Step 3: Add the public capability and API-facing contracts**

Add these types to `src/contracts.ts`:

```ts
export type StrategyValidationCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_ARCHETYPE'
  | 'MULTI_SYMBOL_UNSUPPORTED'
  | 'UNSUPPORTED_SYMBOL'
  | 'UNSUPPORTED_TIMEFRAME';

export class StrategyValidationError extends Error {
  constructor(
    readonly code: StrategyValidationCode,
    message: string,
    readonly field?: string,
  ) {
    super(`invalid strategy: ${message}`);
    this.name = 'StrategyValidationError';
  }
}

export interface ParameterDefinition {
  key: StrategyParamKey;
  label: string;
  description: string;
  kind: 'integer' | 'number';
  minimum: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  defaultValue: number;
}

export interface StrategyDefinition<A extends StrategyArchetype> {
  archetype: A;
  displayName: string;
  description: string;
  parameters: readonly ParameterDefinition[];
  example: StrategyByArchetype<A>;
}

export type AnyStrategyDefinition = {
  [A in StrategyArchetype]: StrategyDefinition<A>;
}[StrategyArchetype];
```

Extend `StrategyAdapter<A>` with:

```ts
readonly definition: StrategyDefinition<A>;
```

- [ ] **Step 4: Define metadata beside each adapter**

Add immutable definitions to both adapter modules. Use the existing parser
bounds and the values from `examples/trend-follower.json` and
`examples/rsi-bollinger.json` as defaults/examples. Do not create a third
metadata table.

The MA parameter order is:

```ts
['fastMA', 'slowMA', 'leverage', 'stopLossPct', 'positionPct']
```

The RSI/Bollinger parameter order is:

```ts
[
  'rsiPeriod',
  'rsiOversold',
  'rsiOverbought',
  'bollingerPeriod',
  'bollingerStdDev',
  'trendFilterPeriod',
  'trendFilterThreshold',
  'leverage',
  'stopLossPct',
  'positionPct',
]
```

- [ ] **Step 5: Extend the registry**

Add:

```ts
listDefinitions(): readonly AnyStrategyDefinition[];
getDefinition<A extends StrategyArchetype>(
  archetype: A,
): StrategyDefinition<A>;
```

Return frozen arrays/objects and preserve the existing `get` and `parse`
behavior.

- [ ] **Step 6: Enforce the market boundary in `parseStrategy`**

Require exactly one symbol. Normalize it with `trim().toUpperCase()`, require
the suffix `USDT`, and accept only `1h`, `4h`, or `1d`. Throw
`StrategyValidationError` with the stable codes and fields from the design.
Adapter parameter errors remain `INVALID_REQUEST` at the API boundary.

- [ ] **Step 7: Verify GREEN**

```powershell
node --test tests/contracts.test.ts tests/strategy/registry.test.ts tests/strategy/parse.test.ts
npm.cmd run typecheck:core
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit**

```powershell
git add src/contracts.ts src/strategy tests/contracts.test.ts tests/strategy/registry.test.ts tests/strategy/parse.test.ts
git commit -m "feat: expose strategy capabilities and market bounds"
```

### Task 3: Preserve Detailed Held-Out Metrics

**Files:**
- Modify: `src/prescribe/validate.ts`
- Modify: `src/pipeline/doctor.ts`
- Modify: `tests/prescribe/validate.test.ts`
- Modify: `tests/pipeline/doctor.test.ts`

- [ ] **Step 1: Write failing detailed-validation tests**

Add:

```ts
const detailed = await validateOnHeldOutDetailed(
  original,
  patched,
  treatment,
  heldOut,
  new MockBacktester(),
  getProfile('conservative'),
);

assert.equal(detailed.originalMetrics.length, heldOut.length);
assert.equal(detailed.patchedMetrics.length, heldOut.length);
assert.deepEqual(
  await validateOnHeldOut(
    original,
    patched,
    treatment,
    heldOut,
    new MockBacktester(),
    getProfile('conservative'),
  ),
  detailed.tradeoff,
);
```

Add a `runDoctorDetailed` test asserting:

```ts
assert.deepEqual(detailed.scorecard, await runDoctor(strategy, backtest, options));
assert.equal(detailed.heldOut.originalMetrics.length, options.heldOut.length);
```

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/prescribe/validate.test.ts tests/pipeline/doctor.test.ts
```

Expected: FAIL because both detailed functions are missing.

- [ ] **Step 3: Add detailed result types beside their owners**

Export `HeldOutValidation` from `src/prescribe/validate.ts` and `DoctorResult`
from `src/pipeline/doctor.ts`:

```ts
export interface HeldOutValidation {
  tradeoff: Tradeoff;
  originalMetrics: Metrics[];
  patchedMetrics: Metrics[];
}

export interface DoctorResult {
  scorecard: Scorecard;
  heldOut: HeldOutValidation;
}
```

- [ ] **Step 4: Implement the compatibility wrappers**

In `src/prescribe/validate.ts`, move existing work into:

```ts
export async function validateOnHeldOutDetailed(
  original: Strategy,
  patched: Strategy,
  treatment: Scenario[],
  heldOut: Scenario[],
  backtest: BacktestAdapter,
  profile: StyleProfile,
): Promise<HeldOutValidation>
```

Then implement:

```ts
export async function validateOnHeldOut(
  original: Strategy,
  patched: Strategy,
  treatment: Scenario[],
  heldOut: Scenario[],
  backtest: BacktestAdapter,
  profile: StyleProfile,
): Promise<Tradeoff> {
  return (await validateOnHeldOutDetailed(
    original,
    patched,
    treatment,
    heldOut,
    backtest,
    profile,
  )).tradeoff;
}
```

In `src/pipeline/doctor.ts`, implement `runDoctorDetailed` using the detailed
validator. Keep:

```ts
export async function runDoctor(
  strategy: Strategy,
  backtest: BacktestAdapter,
  options: DoctorOptions,
): Promise<Scorecard> {
  return (await runDoctorDetailed(strategy, backtest, options)).scorecard;
}
```

Do not run held-out validation twice.

- [ ] **Step 5: Verify GREEN and compatibility**

```powershell
node --test tests/prescribe/validate.test.ts tests/pipeline/doctor.test.ts tests/integration/multi-strategy-acceptance.test.ts
npm.cmd run typecheck:core
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/prescribe/validate.ts src/pipeline/doctor.ts tests/prescribe/validate.test.ts tests/pipeline/doctor.test.ts
git commit -m "refactor: expose detailed held-out diagnosis"
```

### Task 4: Add The Shared Application Service And Preserve CLI Output

**Files:**
- Create: `src/platform/contracts.ts`
- Create: `src/application/diagnose.ts`
- Create: `src/application/view.ts`
- Create: `tests/application/diagnose.test.ts`
- Create: `tests/application/view.test.ts`
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing view-transformation tests**

Create deterministic fixture metrics and assert:

```ts
assert.equal(view.summary.riskScore, scorecard.perStyle.conservative.riskScore);
assert.equal(view.summary.returnDelta, scorecard.tradeoff.returnCost);
assert.equal(view.charts.heldOutComparison.length, heldOut.length);
assert.equal(
  view.charts.riskRadar.find(item => item.dimension === 'news')?.value,
  100,
);
assert.deepEqual(
  view.charts.scenarioTimeline.map(item => item.damageScore),
  [...view.charts.scenarioTimeline]
    .map(item => item.damageScore)
    .sort((left, right) => right - left),
);
assert.ok(
  view.charts.parameterChanges.every(change => change.before !== change.after),
);
```

- [ ] **Step 2: Write the failing service test**

Call:

```ts
const result = await diagnoseStrategy({
  strategy,
  style: 'conservative',
  seed: 42,
  candidates: 6,
});
```

Assert five treatment dimensions, five held-out comparisons, deterministic
repeated output, and `result.scorecard === result.view.scorecard` by deep value.

- [ ] **Step 3: Verify RED**

```powershell
node --test tests/application/diagnose.test.ts tests/application/view.test.ts
```

Expected: FAIL because the application modules and view contracts are missing.

- [ ] **Step 4: Add the frozen platform contracts**

Create `src/platform/contracts.ts` for the exact request, natural-language
draft, summary, chart, API envelope, and response interfaces from the approved
design. Domain and adapter contracts stay in `src/contracts.ts`.

```ts
export type {
  AnyStrategyDefinition,
  StrategyArchetype,
} from '../contracts.ts';

export interface DiagnoseRequest {
  strategy: Strategy;
  style: StyleName;
  seed: number;
  candidates: number;
}

export interface DiagnosisResult {
  scorecard: Scorecard;
  view: DiagnosisView;
}

export interface StrategyDraft {
  strategy: Strategy;
  source: 'rules' | 'anthropic';
  confidence: number;
  assumptions: DraftAssumption[];
  warnings: DraftWarning[];
}

export interface DraftAssumption {
  field: string;
  value: string | number;
  reason: 'registered-default' | 'market-default';
}

export interface DraftWarning {
  code: 'LOW_CONFIDENCE' | 'AI_FALLBACK_FAILED';
  message: string;
}

export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'SERVER_BUSY'
  | 'INVALID_REQUEST'
  | 'AMBIGUOUS_DESCRIPTION'
  | 'UNSUPPORTED_STRATEGY_DESCRIPTION'
  | 'UNSUPPORTED_ARCHETYPE'
  | 'MULTI_SYMBOL_UNSUPPORTED'
  | 'UNSUPPORTED_SYMBOL'
  | 'UNSUPPORTED_TIMEFRAME'
  | 'DIAGNOSIS_FAILED';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  field?: string;
  retryable: boolean;
}

export interface ApiEnvelope<T> {
  apiVersion: 'v1';
  requestId: string;
  data: T;
}

export interface ApiErrorEnvelope {
  apiVersion: 'v1';
  requestId: string;
  error: ApiError;
}

export interface DimensionEquity {
  dimension: Dimension;
  equity: number[];
}

export interface DimensionEquityComparison {
  dimension: Dimension;
  original: number[];
  patched: number[];
}

export interface DimensionRisk {
  dimension: Dimension;
  value: number;
}

export interface ParameterChange {
  key: StrategyParamKey;
  label: string;
  before: number;
  after: number;
}

export interface ScenarioTimelineItem {
  dimension: Dimension;
  scenarioName: string;
  damageScore: number;
  cause: DeathCause;
  pnlPct: number;
  maxDrawdownPct: number;
}

export interface DiagnosisView {
  scorecard: Scorecard;
  summary: {
    riskScore: number;
    worstDrawdownPct: number;
    totalTrades: number;
    robustnessGain: number;
    returnDelta: number;
  };
  charts: {
    treatmentEquity: DimensionEquity[];
    heldOutComparison: DimensionEquityComparison[];
    defaultHeldOutDimension: Dimension;
    riskRadar: DimensionRisk[];
    parameterChanges: ParameterChange[];
    scenarioTimeline: ScenarioTimelineItem[];
  };
}

export interface StoredDiagnosis {
  id: string;
  createdAt: string;
  description: string;
  requestId: string;
  request: DiagnoseRequest;
  view: DiagnosisView;
}
```

`DimensionEquityComparison` includes `dimension`, `original`, and `patched`.
`ParameterChange` includes `key`, `label`, `before`, and `after`.
`DiagnosisView.charts.defaultHeldOutDimension` is selected by the backend from
the original held-out metric with the largest drawdown.

- [ ] **Step 5: Implement pure chart transformation**

Export:

```ts
export function buildDiagnosisView(
  request: DiagnoseRequest,
  doctor: DoctorResult,
  heldOut: readonly Scenario[],
): DiagnosisView
```

Use these rules:

```ts
const riskValue = metrics.liquidated
  ? 100
  : Math.round(Math.min(100, Math.max(0, metrics.maxDrawdownPct * 100)));
```

Sort timeline by `damageScore` descending, keep equity point order unchanged,
and omit unchanged parameters.

- [ ] **Step 6: Implement the shared service**

Export:

```ts
export interface DiagnoseDependencies {
  backtest?: BacktestAdapter;
  snapshots?: SnapshotBundle;
  narrator?: Narrator;
}

export async function diagnoseStrategy(
  request: DiagnoseRequest,
  dependencies: DiagnoseDependencies = {},
): Promise<DiagnosisResult>
```

The default backtester is `MockBacktester`; the default snapshots are
`loadDefaultSnapshotBundle()`. Build treatment with `seed`, held-out with
`seed + 100_000`, call `runDoctorDetailed` once, and return the Scorecard plus
the view.

- [ ] **Step 7: Migrate the CLI without changing its output**

Replace CLI-local scenario orchestration with `diagnoseStrategy`. Pass the
selected Mock/Bitget adapter and narrator through dependencies. Continue
serializing `result.scorecard`, not `result.view`.

Add a golden assertion:

```ts
assert.equal(
  jsonOutput.trim(),
  readFileSync(
    new URL('../examples/demo-scorecard.json', import.meta.url),
    'utf8',
  ).trim(),
);
```

- [ ] **Step 8: Verify the full foundation**

```powershell
node --test tests/application/*.test.ts tests/cli.test.ts tests/integration/multi-strategy-acceptance.test.ts
npm.cmd run verify
git diff --check
```

Expected:

- existing test count increases;
- 0 failures;
- existing single skipped live integration test remains skipped;
- coverage remains above 90/80/95;
- MA golden JSON is byte-identical.

- [ ] **Step 9: Commit**

```powershell
git add src/platform/contracts.ts src/application src/cli.ts tests/application tests/cli.test.ts
git commit -m "refactor: share diagnosis service across interfaces"
```

### Task 5: Foundation Review And Handoff

**Files:**
- Modify: `handoff.md`

- [ ] **Step 1: Record the foundation commit and API contracts**

Document exported types/functions, files owned by Wave 2, exact test counts,
coverage, skipped tests, and the requirement that all four Wave 2 branches
start from this commit.

- [ ] **Step 2: Run the branch handoff gate**

```powershell
npm.cmd ci
npm.cmd run verify
git diff --check
git status --short
```

Expected: only the handoff update remains before commit.

- [ ] **Step 3: Commit**

```powershell
git add handoff.md
git commit -m "docs: hand off P1 foundation contract"
```
