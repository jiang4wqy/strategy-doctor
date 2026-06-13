# Strategy Doctor Multi-Strategy Design

**Status:** Approved on 2026-06-13. The shared contract, MA adapter,
immutable registry, and registry-backed parser are merged on the integration
branch.

**Goal:** Add a second strategy archetype behind a small typed adapter registry
while preserving the existing `ma-cross` behavior and the offline diagnostic
pipeline.

**Scope:** P0 only: contract, registry, MA migration, RSI + Bollinger mean
reversion, shared execution, strategy-specific prescription, and dual-strategy
verification.

## 1. Design Decision

Use a closed, typed registry of built-in adapters.

This is preferred over two alternatives:

- Scattered `if (archetype === ...)` branches would be faster initially but
  would duplicate parsing, backtesting, and mutation logic across the pipeline.
- A dynamic plugin SDK or strategy DSL would expand the security and execution
  semantics beyond the hackathon scope.

The registry is intentionally closed to two archetypes in P0:

- `ma-cross`
- `rsi-bollinger-mean-reversion`

Adding a third archetype later requires an explicit contract change, parser
tests, an adapter, prescription policy, fixtures, and integration tests.

## 2. Data Model

Common identity and market fields remain unchanged:

```ts
interface StrategyBase {
  id: string;
  name: string;
  universe: string[];
  timeframe: string;
}
```

Risk parameters are shared by both strategies:

```ts
interface CommonRiskParams {
  leverage: number;
  stopLossPct: number;
  positionPct: number;
}
```

Signal parameters remain strategy-specific:

```ts
interface MaCrossParams extends CommonRiskParams {
  fastMA: number;
  slowMA: number;
}

interface RsiBollingerParams extends CommonRiskParams {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
}
```

`Strategy` becomes a discriminated union:

```ts
interface MaCrossStrategy extends StrategyBase {
  archetype: 'ma-cross';
  params: MaCrossParams;
}

interface RsiBollingerStrategy extends StrategyBase {
  archetype: 'rsi-bollinger-mean-reversion';
  params: RsiBollingerParams;
}

type Strategy = MaCrossStrategy | RsiBollingerStrategy;
type StrategyParams = Strategy['params'];
type StrategyArchetype = Strategy['archetype'];

interface ParamsByArchetype {
  'ma-cross': MaCrossParams;
  'rsi-bollinger-mean-reversion': RsiBollingerParams;
}
```

Validation boundaries:

- `universe` remains non-empty and P0 still runs the first symbol only.
- `timeframe` remains a non-empty string.
- `fastMA >= 2` and `slowMA > fastMA`.
- `rsiPeriod >= 2`.
- `0 < rsiOversold < 50 < rsiOverbought < 100`.
- `bollingerPeriod >= 2`.
- `0 < bollingerStdDev <= 5`.
- `leverage >= 1`.
- `0 < stopLossPct <= 0.99`.
- `0 < positionPct <= 1`.

## 3. Adapter Contract

The adapter owns strategy-specific parsing, decisions, mutation, and parameter
labels. The shared engine owns position and risk execution.

```ts
type PositionDirection = -1 | 0 | 1;
type StrategyDecision = 'hold' | 'flat' | 'long' | 'short';

interface DecisionContext {
  prices: readonly number[];
  index: number;
  position: PositionDirection;
  entryPrice: number;
}

interface TargetedPatch<P> {
  patch: Partial<P>;
  rationale: string[];
}

interface StrategyAdapter<A extends StrategyArchetype> {
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

`ParamsByArchetype` is the archetype-to-params lookup map. The registry contains
one contained cast at the construction boundary; strategy modules and callers
do not cast.

`hold` and `flat` are distinct:

- `hold`: keep the current position and do not clear a stop-loss re-entry block.
- `flat`: close an open position and clear the block after the strategy has
  returned to a neutral state.
- `long` / `short`: target the corresponding direction.

## 4. Registry

`src/strategy/registry.ts` exports:

```ts
type AnyStrategyAdapter = {
  [A in StrategyArchetype]: StrategyAdapter<A>;
}[StrategyArchetype];

getStrategyAdapter<A extends StrategyArchetype>(
  archetype: A,
): StrategyAdapter<A>
```

The registry is immutable after module initialization. It rejects duplicate
archetypes during construction and throws `unsupported strategy archetype:
<value>` for unknown runtime input. Runtime parsing first narrows the raw
archetype to `StrategyArchetype`, then uses the generic lookup.

No adapter is selected inside `contracts.ts`. Runtime parsing reads the outer
object, resolves the adapter by `archetype`, delegates `params` parsing, and
returns the discriminated strategy.

## 5. Shared Execution Engine

Move the common price loop into `src/backtest/engine.ts`. The engine receives a
validated `Strategy`, positive finite prices, and an adapter.

For each bar, preserve this order:

1. Apply leveraged PnL for the position held from the prior bar.
2. Check liquidation excursion.
3. Check stop-loss excursion.
4. Apply the existing equity floor liquidation rule.
5. Ask the adapter for `hold`, `flat`, `long`, or `short`.
6. Apply close, switch, entry, and re-entry-block rules.
7. Update peak equity, drawdown, and the equity curve.

This ordering is required for MA compatibility.

After a stop or liquidation, the stopped direction is blocked:

- `hold` leaves it blocked.
- the opposite direction may enter.
- `flat` clears the block, allowing a later fresh signal in the same direction.

`MockBacktester` generates the existing deterministic path, resolves the
adapter, then calls the engine.

`BitgetBacktester` keeps the existing candle cache and shock transformation,
then calls the same engine with stressed close prices.

Compatibility wrapper:

```ts
runOnPrices(params: MaCrossParams, prices: number[]): Metrics
```

remains exported from `src/backtest/mock.ts` and delegates to the MA adapter.
Existing direct tests and external demo usage therefore do not need to change.

## 6. MA Adapter Semantics

The MA adapter reproduces the current signal exactly:

- Before both averages are available: `hold`.
- `fastMA > slowMA`: `long`.
- `fastMA < slowMA`: `short`.
- Equal averages: `hold`.

It never returns `flat`. The current blocked-direction behavior therefore
remains unchanged after a stop.

The seed 42 JSON result for `examples/trend-follower.json` is a golden
compatibility fixture. Any difference in evaluations, deaths, style scores,
prescription, or held-out trade-off requires explicit review.

## 7. RSI + Bollinger Semantics

Indicators use close prices only:

- Bollinger middle: simple moving average over `bollingerPeriod`.
- Bollinger deviation: population standard deviation over the same window.
- Upper/lower bands: middle plus/minus `bollingerStdDev * deviation`.
- RSI: Wilder RSI over `rsiPeriod`. The first ready value uses simple average
  gains and losses over the first `rsiPeriod` deltas; later values use Wilder's
  recursive smoothing.
- If an indicator is not ready, return `hold`.
- A zero-loss RSI window produces RSI 100.
- A zero-gain RSI window produces RSI 0.
- A fully flat window produces RSI 50.

Decision rules:

- Enter `long` when close is at or below the lower band and
  `RSI <= rsiOversold`.
- Enter `short` when close is at or above the upper band and
  `RSI >= rsiOverbought`.
- While long, return `flat` when close is at or above the middle band or
  `RSI >= 50`.
- While short, return `flat` when close is at or below the middle band or
  `RSI <= 50`.
- Otherwise return `hold`.

When both entry conditions are impossible or indicators are flat, remain
neutral. P0 does not add pyramiding, partial positions, cooldown bars, fees, or
slippage.

## 8. Prescription Model

Keep the existing JSON-compatible object shape:

```ts
type StrategyParamKey =
  | keyof MaCrossParams
  | keyof RsiBollingerParams;

type ParameterChanges =
  Partial<Record<StrategyParamKey, number>>;
```

`Prescription.changes` remains a key/value object containing new values. The
report renderer uses the original strategy plus adapter labels to print
`before -> after`.

Common death policies:

- `liquidation`: reduce leverage and constrain stop loss inside half the
  simplified liquidation line.
- `drawdown-breach`: reduce position size by 30%.

Strategy-specific `stop-loss-bleed` policies:

- MA: increase `fastMA` and `slowMA` by 1.5x.
- RSI/Bollinger: widen `bollingerStdDev` by 15%, move oversold down by 3, and
  move overbought up by 3, all within parser bounds.

Candidate search remains in `src/prescribe/evolve.ts`. It asks the selected
adapter for the targeted patch, mutable fields, jitter, and parameter labels.
Selection order remains: survived, risk score, fewer liquidations, lower worst
drawdown, then higher mean PnL.

No actionable deaths still produce zero changes and the original strategy.

## 9. File Boundaries

Create:

- `src/strategy/registry.ts`: immutable adapter lookup.
- `src/strategy/indicators.ts`: SMA, population standard deviation, Wilder RSI.
- `src/strategy/adapters/ma-cross.ts`: MA decisions and mutation policy.
- `src/strategy/adapters/rsi-bollinger.ts`: mean-reversion decisions and policy.
- `src/backtest/engine.ts`: common position/risk/equity execution.
- `examples/rsi-bollinger.json`: second strategy example.

Modify:

- `src/contracts.ts`: union and adapter-related shared types.
- `src/strategy/parse.ts`: registry-based parameter parsing.
- `src/backtest/mock.ts`: compatibility wrapper and registry dispatch.
- `src/backtest/bitget.ts`: shared engine dispatch.
- `src/prescribe/evolve.ts`: adapter-owned mutation policy.
- `src/prescribe/mutations.ts`: retain only common helpers, or remove exports
  after all callers migrate.
- tests, CLI expectations, README, demo docs, and handoff.

Do not change scenario generation, damage scoring, style thresholds, narrator,
snapshot schemas, or public-data collection in P0.

## 10. Test Strategy

Contract and parser:

- Both valid archetypes parse and narrow correctly.
- Every numeric bound is tested at valid and invalid edges.
- Unknown archetypes fail before backtesting.

Indicators and decisions:

- SMA, standard deviation, and RSI have deterministic fixtures.
- RSI flat, all-gain, and all-loss windows cover 50, 100, and 0.
- RSI/Bollinger long entry, short entry, neutral hold, and middle-band exits
  each have focused tests.

Execution:

- Existing MA price fixtures remain byte-for-byte compatible.
- Both adapters share stop-loss, liquidation, drawdown, and equity behavior.
- `flat` closes and clears a stopped-direction block; `hold` does not.
- Invalid prices are still rejected.

Prescription:

- Common causes only change common risk fields.
- MA bleed only changes MA fields.
- RSI/Bollinger bleed only changes mean-reversion fields.
- Jitter preserves every parser invariant.
- Identical seeds remain deterministic.

Integration:

- The same CLI runs both example files.
- Each scorecard contains exactly five dimensions and separate held-out seeds.
- Both strategies expose survivors and deaths honestly.
- Markdown and JSON include strategy-specific parameter changes.
- The existing offline demo remains the default and makes no network call.

## 11. Merge Sequence

1. Contract, adapter types, and empty registry wiring.
2. MA adapter migration with golden compatibility evidence.
3. Shared execution engine and adapter-driven prescription.
4. Indicators and RSI/Bollinger adapter.
5. Dual-strategy CLI, integration tests, examples, README, and demo materials.

Each stage must leave `npm.cmd run verify` passing before the next stage merges.

## 12. Acceptance Criteria

- Existing `ma-cross` seed 42 output has no unreviewed change.
- `examples/rsi-bollinger.json` passes runtime validation.
- One CLI command path handles both archetypes.
- Both strategies produce five evaluations, deaths/survivors, a prescription,
  and held-out trade-off.
- Diagnostics differ for explainable strategy reasons under the same scenarios.
- Tests, typecheck, offline demo, and current coverage thresholds pass.
- Default behavior remains offline and never accesses an account or places an
  order.
