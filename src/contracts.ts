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

/** 可进化的"基因"——处方层只允许改这里 */
export interface StrategyParams {
  fastMA: number;        // 快线周期（bar 数，≥2）
  slowMA: number;        // 慢线周期（> fastMA）
  leverage: number;      // 杠杆倍数（≥1）
  stopLossPct: number;   // 止损幅度（0.05 = 5%）
  positionPct: number;   // 单仓占权益比例（0~1]
}

export interface Strategy {
  id: string;
  name: string;
  archetype: 'ma-cross';   // MVP 仅一种原型；扩展时加联合成员
  params: StrategyParams;
  universe: string[];      // e.g. ['BTCUSDT']
  timeframe: string;       // e.g. '1h'
}

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
}

export interface StyleScore {
  style: StyleName;
  riskScore: number;        // 0（必死）~100（稳健）
  survived: boolean;        // 是否满足该风格全部阈值
  worstDrawdownPct: number;
  meanPnlPct: number;
}

export interface Prescription {
  changes: Partial<StrategyParams>;   // 相对原参数的改动
  rationale: string;                  // 每项改动对应哪条死因
  patchedStrategy: Strategy;
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
