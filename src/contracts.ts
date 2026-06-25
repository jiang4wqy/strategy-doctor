// src/contracts.ts — 接口契约 v0.1（冻结：改动需全队同意）
//
// 这是全项目唯一的类型来源。所有模块只 import 不重定义。
// 五个攻击维度 Dimension 一一对应 Bitget 官方五大分析师 Skill：
//   sentiment     ← sentiment-analyst
//   macro         ← macro-analyst
//   market-intel  ← market-intel
//   news          ← news-briefing
//   technical     ← technical-analysis
// （Skill 安装见 docs/SETUP.md）

export type Dimension = 'sentiment' | 'macro' | 'market-intel' | 'news' | 'technical';
export type StyleName = 'conservative' | 'aggressive' | 'trend';

export interface ModelVote {
  model: string;
  signature: string;
  confidence: number;
  agree: boolean;
}

export interface ModelConsensus {
  models: string[];
  score: number;
  signature: string;
  votes: ModelVote[];
}

export interface CommonRiskParams {
  leverage: number;      // 杠杆倍数（≥1）
  stopLossPct: number;   // 止损幅度（0.05 = 5%）
  positionPct: number;   // 单仓占权益比例（0~1]
}

/** 均线策略可进化的"基因" */
export interface MaCrossParams extends CommonRiskParams {
  fastMA: number;        // 快线周期（bar 数，≥2）
  slowMA: number;        // 慢线周期（> fastMA）
}

/** RSI + Bollinger 均值回归策略可进化的"基因" */
export interface RsiBollingerParams extends CommonRiskParams {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
  trendFilterPeriod: number;
  trendFilterThreshold: number;
}

export interface BreakoutConfirmationParams extends CommonRiskParams {
  breakoutLookback: number;
  confirmationBars: number;
  exitLookback: number;
  volatilityLookback: number;
  minBreakoutPct: number;
  minVolatilityPct: number;
}

export interface StrategyBase {
  id: string;
  name: string;
  universe: string[];      // e.g. ['BTCUSDT']
  timeframe: string;       // e.g. '1h'
}

export interface MaCrossStrategy extends StrategyBase {
  archetype: 'ma-cross';
  params: MaCrossParams;
}

export interface RsiBollingerStrategy extends StrategyBase {
  archetype: 'rsi-bollinger-mean-reversion';
  params: RsiBollingerParams;
}

export interface BreakoutConfirmationStrategy extends StrategyBase {
  archetype: 'breakout-confirmation';
  params: BreakoutConfirmationParams;
}

export type Strategy =
  | MaCrossStrategy
  | RsiBollingerStrategy
  | BreakoutConfirmationStrategy;
export type StrategyParams = Strategy['params'];
export type StrategyArchetype = Strategy['archetype'];

export interface ParamsByArchetype {
  'ma-cross': MaCrossParams;
  'rsi-bollinger-mean-reversion': RsiBollingerParams;
  'breakout-confirmation': BreakoutConfirmationParams;
}

export type StrategyByArchetype<A extends StrategyArchetype> =
  Extract<Strategy, { archetype: A }>;

export type StrategyParamKey =
  | keyof MaCrossParams
  | keyof RsiBollingerParams
  | keyof BreakoutConfirmationParams;

export type ParameterChanges =
  Partial<Record<StrategyParamKey, number>>;

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
  magnitude: number;       // 主冲击幅度（0.3 = 30%）
  durationBars: number;    // 冲击持续 bar 数
  volMult: number;         // 波动放大倍数
  seed: number;            // 路径随机种子（可复现的根基）
}

export interface Scenario {
  id: string;
  name: string;
  dimension: Dimension;
  sourceSkill: string;     // 对应的 Bitget 官方 Skill（用官方真名）
  narrative: string;       // 自然语言剧情（死亡报告素材）
  severity: number;        // 1~5
  sourceObservedAt?: string;
  shock: MarketShock;
}

export interface Metrics {
  pnlPct: number;          // 总收益率（0.1 = +10%）
  maxDrawdownPct: number;  // 最大回撤（正数，0.3 = 30%）
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
  narrativeConsensus?: ModelConsensus;
}

export interface StyleScore {
  style: StyleName;
  riskScore: number;        // 0（必死）~100（稳健）
  survived: boolean;        // 是否满足该风格全部阈值
  worstDrawdownPct: number;
  meanPnlPct: number;
}

export interface Prescription {
  changes: ParameterChanges;          // 相对原参数的改动
  rationale: string;                  // 每项改动对应哪条死因
  patchedStrategy: Strategy;
  consensus?: ModelConsensus;
}

export interface Tradeoff {
  robustnessGain: number;   // held-out 上风险分变化（处方版 − 原版）
  returnCost: number;       // held-out 上平均收益变化（常为负，诚实输出）
}

export interface Scorecard {
  strategyId: string;
  scenarioSetId: string;    // 形如 'tx42/ho100042'，体现两套种子分离
  perStyle: Record<StyleName, StyleScore>;
  evaluations: ScenarioEvaluation[];
  deaths: Death[];
  prescription: Prescription;
  tradeoff: Tradeoff;
}
