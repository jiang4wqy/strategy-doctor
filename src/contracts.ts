export type Dimension = 'sentiment' | 'macro' | 'market-intel' | 'news' | 'technical';
export type StyleName = 'conservative' | 'aggressive' | 'trend';

export interface CommonRiskParams {
  leverage: number;
  stopLossPct: number;
  positionPct: number;
}

/** Moving-average strategy parameters. */
export interface MaCrossParams extends CommonRiskParams {
  fastMA: number;
  slowMA: number;
}

/** RSI + Bollinger strategy parameters. */
export interface RsiBollingerParams extends CommonRiskParams {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
  trendFilterPeriod: number;
  trendFilterThreshold: number;
}

export interface StrategyBase {
  id: string;
  name: string;
  universe: string[];
  timeframe: string;
  backtest?: BacktestSelection;
}

export interface BacktestSelection {
  source: 'offline-synthetic' | 'bitget-public';
  candleLimit: number;
  startDate?: string;
  endDate?: string;
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

export interface NarrationConsensus {
  primaryModel: string;
  requestedModels: string[];
  agreeingModels: string[];
  mismatches: string[];
  agreementRate: number;
  avgSimilarity: number;
}

export type StrategyValidationCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_ARCHETYPE'
  | 'MULTI_SYMBOL_UNSUPPORTED'
  | 'UNSUPPORTED_SYMBOL'
  | 'UNSUPPORTED_TIMEFRAME';

export class StrategyValidationError extends Error {
  readonly code: StrategyValidationCode;
  readonly field?: string;

  constructor(
    code: StrategyValidationCode,
    message: string,
    field?: string,
  ) {
    super(`invalid strategy: ${message}`);
    this.name = 'StrategyValidationError';
    this.code = code;
    this.field = field;
  }
}

export interface ParameterDefinition<
  K extends StrategyParamKey = StrategyParamKey,
> {
  key: K;
  label: string;
  description: string;
  kind: 'integer' | 'number';
  minimum: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  defaultValue: number;
}

export type StrategyDefinitionExample<A extends StrategyArchetype> =
  Readonly<Omit<StrategyByArchetype<A>, 'params' | 'universe'>>
  & {
    readonly params: Readonly<ParamsByArchetype[A]>;
    readonly universe: readonly string[];
  };

export interface StrategyDefinition<A extends StrategyArchetype> {
  archetype: A;
  displayName: string;
  description: string;
  parameters: readonly ParameterDefinition<
    keyof ParamsByArchetype[A] & StrategyParamKey
  >[];
  example: StrategyDefinitionExample<A>;
}

export type AnyStrategyDefinition = {
  [A in StrategyArchetype]: StrategyDefinition<A>;
}[StrategyArchetype];

export interface MarketShock {
  kind: 'crash' | 'whipsaw' | 'squeeze' | 'grind' | 'gap';
  magnitude: number;
  durationBars: number;
  volMult: number;
  seed: number;
}

export interface Scenario {
  id: string;
  name: string;
  dimension: Dimension;
  sourceSkill: string;
  narrative: string;
  severity: number;
  sourceObservedAt?: string;
  shock: MarketShock;
}

export interface Metrics {
  pnlPct: number;
  maxDrawdownPct: number;
  liquidated: boolean;
  numTrades: number;
  equityCurve: number[];
}

export interface BacktestAdapter {
  run(strategy: Strategy, scenario: Scenario): Promise<Metrics>;
}

export type DeathCause = 'liquidation' | 'drawdown-breach' | 'stop-loss-bleed' | 'survived';
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
  readonly definition: StrategyDefinition<A>;
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

export interface Death {
  scenarioId: string;
  scenarioName: string;
  dimension: Dimension;
  cause: DeathCause;
  metrics: Metrics;
  narrative: string;
}

export interface ScenarioEvaluation {
  scenarioId: string;
  scenarioName: string;
  dimension: Dimension;
  sourceSkill: string;
  sourceObservedAt?: string;
  severity: number;
  shock: MarketShock;
  metrics: Metrics;
  cause: DeathCause;
  damageScore: number;
  narrative: string;
  narrationConsensus?: NarrationConsensus;
}

export interface StyleScore {
  style: StyleName;
  riskScore: number;
  survived: boolean;
  worstDrawdownPct: number;
  meanPnlPct: number;
}

export interface PrescriptionConsensus {
  primaryStyle: StyleName;
  requestedStyles: StyleName[];
  agreeingStyles: StyleName[];
  agreementRate: number;
  mismatches: StyleName[];
}

export interface Prescription {
  changes: ParameterChanges;
  rationale: string;
  patchedStrategy: Strategy;
  consensus?: PrescriptionConsensus;
}

export interface Tradeoff {
  robustnessGain: number;
  returnCost: number;
}

export interface Scorecard {
  strategyId: string;
  scenarioSetId: string;
  perStyle: Record<StyleName, StyleScore>;
  evaluations: ScenarioEvaluation[];
  deaths: Death[];
  prescription: Prescription;
  tradeoff: Tradeoff;
}
