import type {
  AnyStrategyDefinition,
  DeathCause,
  Dimension,
  Scorecard,
  Strategy,
  StrategyParamKey,
  StyleName,
} from '../contracts.ts';

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

export interface DraftAssumption {
  field: string;
  value: string | number;
  reason: 'registered-default' | 'market-default';
}

export interface DraftWarning {
  code: 'LOW_CONFIDENCE' | 'AI_FALLBACK_FAILED' | 'MULTI_MODEL_DISAGREEMENT';
  message: string;
}

export interface ParseConsensus {
  primaryModel: string;
  requestedModels: string[];
  agreeingModels: string[];
  agreementRate: number;
  mismatches: string[];
}

export interface PrescriptionConsensus {
  primaryStyle: StyleName;
  requestedStyles: StyleName[];
  agreeingStyles: StyleName[];
  agreementRate: number;
  mismatches: StyleName[];
}

export interface DashboardAlert {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  value: number;
  threshold: number;
}

export interface RiskDashboard {
  trendScore: number;
  defenseScore: number;
  costEfficiency: number;
  trendDefenseGap: number;
  costEfficiencyThreshold: number;
  trendThreshold: number;
  defenseThreshold: number;
  alerts: DashboardAlert[];
}

export interface DiagnosisModelConsistency {
  prescription?: {
    agreementRate: number;
    requestedStyles: StyleName[];
    agreeingStyles: StyleName[];
    mismatches: string[];
  };
  narration?: {
    agreementRate: number;
    requestedModels: string[];
    agreeingModels: string[];
    mismatches: string[];
    avgSimilarity: number;
    sampleCount: number;
  };
}

export interface StrategyModelReview {
  reviewer: string;
  mode: 'rules' | 'open-source-model';
  score: number;
  agreementRate: number;
  objections: string[];
  recommendations: string[];
  summary: string;
}

export interface StrategyDraft {
  strategy: Strategy;
  source: 'rules' | 'anthropic';
  confidence: number;
  assumptions: DraftAssumption[];
  warnings: DraftWarning[];
  consensus?: ParseConsensus;
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

export interface DimensionDrawdown {
  dimension: Dimension;
  drawdown: number[];
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
  turnoverPct: number;
}

export interface ExecutionQualityItem {
  dimension: Dimension;
  scenarioName: string;
  turnoverPct: number;
  feeCostPct: number;
  slippageCostPct: number;
  numTrades: number;
}

export interface DiagnosisView {
  scorecard: Scorecard;
  summary: {
    riskScore: number;
    worstDrawdownPct: number;
    totalTrades: number;
    totalTurnoverPct: number;
    feeCostPct: number;
    slippageCostPct: number;
    robustnessGain: number;
    returnDelta: number;
  };
  riskDashboard?: RiskDashboard;
  modelConsistency?: DiagnosisModelConsistency;
  strategyReview?: StrategyModelReview;
  charts: {
    treatmentEquity: DimensionEquity[];
    treatmentDrawdown: DimensionDrawdown[];
    heldOutComparison: DimensionEquityComparison[];
    defaultHeldOutDimension: Dimension;
    riskRadar: DimensionRisk[];
    parameterChanges: ParameterChange[];
    scenarioTimeline: ScenarioTimelineItem[];
    executionQuality: ExecutionQualityItem[];
  };
}

export interface DiagnosisResult {
  scorecard: Scorecard;
  view: DiagnosisView;
}

export interface PlaybookImportView {
  source: 'strategy-json' | 'description';
  playbookId?: string;
  playbookName?: string;
  description?: string;
  strategy: Strategy;
}

export interface PlaybookDiagnosisView {
  import: PlaybookImportView;
  view: DiagnosisView;
}

export interface StoredDiagnosis {
  id: string;
  createdAt: string;
  description: string;
  requestId: string;
  request: DiagnoseRequest;
  view: DiagnosisView;
}

export type CapabilityList = readonly AnyStrategyDefinition[];

export interface FactorDefinition {
  id: string;
  group: 'trend' | 'mean-reversion' | 'volatility' | 'liquidity' | 'sentiment' | 'macro' | 'news';
  name: string;
  description: string;
  scenarioUse: Dimension | 'cross-dimension';
  defaultWeight: number;
}

export interface FactorLibraryView {
  factors: FactorDefinition[];
  frameworkVersion: string;
}

export interface PaperSignalRequest {
  strategy: Strategy;
  prices?: number[];
}

export interface PaperSignalView {
  strategyId: string;
  symbol: string;
  timeframe: string;
  latestSignal: 'long' | 'short' | 'flat' | 'hold';
  simulatedPosition: 'long' | 'short' | 'flat';
  paperEquity: number;
  totalTrades: number;
  turnoverPct: number;
  feeCostPct: number;
  slippageCostPct: number;
  lastUpdatedAt: string;
  notes: string[];
}

export interface PaperSandboxRequest {
  strategy: Strategy;
  prices?: number[];
  maxBars?: number;
}

export interface PaperSandboxStepRequest {
  steps?: number;
}

export interface PaperSignalStepSnapshot {
  index: number;
  time: string;
  signal: 'long' | 'short' | 'hold';
  position: 'long' | 'short' | 'flat';
  equity: number;
  totalTrades: number;
  turnoverPct: number;
  feeCostPct: number;
  slippageCostPct: number;
}

export interface PaperSandboxSessionSummary {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  status: 'active' | 'ended';
  currentIndex: number;
  totalBars: number;
  lastUpdatedAt: string;
  createdAt: string;
}

export interface PaperSandboxSessionView {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  status: 'active' | 'ended';
  createdAt: string;
  updatedAt: string;
  currentIndex: number;
  totalBars: number;
  signal: 'long' | 'short' | 'hold';
  position: 'long' | 'short' | 'flat';
  equity: number;
  totalTrades: number;
  turnoverPct: number;
  feeCostPct: number;
  slippageCostPct: number;
  latestNotes: string[];
  history: PaperSignalStepSnapshot[];
}

export interface PaperSandboxCloseRequest {
  sessionId: string;
}

export interface PaperSandboxCreateResponse {
  session: PaperSandboxSessionView;
}

export interface PaperSandboxListView {
  sessions: PaperSandboxSessionSummary[];
}

export interface PaperSandboxStatus {
  id: string;
  status: 'ended' | 'removed';
}

export interface OnChainDashboardRequest {
  symbol: string;
  timeframe: string;
}

export interface ApiCallRecord {
  id: string;
  requestId: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
}

export interface ApiCallPathMetric {
  path: string;
  count: number;
  errorCount: number;
  avgDurationMs: number;
  successRate: number;
  lastStatus: number;
  lastSeen: string;
}

export interface ApiCallTelemetry {
  windowStart: string;
  windowEnd: string;
  totalCalls: number;
  totalErrors: number;
  successRate: number;
  topPaths: ApiCallPathMetric[];
  recent: ApiCallRecord[];
}

export interface OnChainSymbolDashboard {
  symbol: string;
  timeframe: string;
  asOf: string;
  onChainFlowUsd: number;
  spotVolumeUsd: number;
  perpsOpenInterestUsd: number;
  fundingRate: number;
  liquidationsUsd: number;
}

export interface OnChainDashboardView {
  symbol: string;
  timeframe: string;
  asOf: string;
  metrics: {
    flowPressure: OnChainSymbolDashboard;
    liquidityPressure: {
      bidAskSpreadBps: number;
      whaleOrderDepthUsd: number;
      borrowRate: number;
    };
    riskSignals: {
      squeezeRisk: number;
      liquidationRisk: number;
      momentumSkew: number;
    };
  };
}

export interface NotebookTemplate {
  id: string;
  title: string;
  cells: Array<{
    kind: 'markdown' | 'query' | 'diagnosis' | 'export';
    title: string;
    body: string;
  }>;
}

export interface NotebookCatalogView {
  templates: NotebookTemplate[];
}

export interface MultiFactorFrameworkView {
  version: string;
  stages: string[];
  factorGroups: FactorDefinition['group'][];
  outputs: string[];
  safeguards: string[];
}
