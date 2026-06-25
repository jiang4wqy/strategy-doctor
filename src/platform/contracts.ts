import type {
  AnyStrategyDefinition,
  DeathCause,
  Dimension,
  ModelConsensus,
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
  code: 'LOW_CONFIDENCE' | 'AI_FALLBACK_FAILED' | 'CONSENSUS_LOW';
  message: string;
}

export interface StrategyDraft {
  strategy: Strategy;
  source: 'rules' | 'anthropic' | 'qwen';
  confidence: number;
  assumptions: DraftAssumption[];
  warnings: DraftWarning[];
  consensus?: ModelConsensus;
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

export type DeploymentReadinessStatus = 'ready' | 'watch' | 'blocked';

export interface DeploymentGate {
  key: string;
  label: string;
  passed: boolean;
  value: string;
}

export interface DeploymentReadiness {
  score: number;
  status: DeploymentReadinessStatus;
  headline: string;
  gates: DeploymentGate[];
  blockers: string[];
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
  deployment: DeploymentReadiness;
  charts: {
    treatmentEquity: DimensionEquity[];
    heldOutComparison: DimensionEquityComparison[];
    defaultHeldOutDimension: Dimension;
    riskRadar: DimensionRisk[];
    parameterChanges: ParameterChange[];
    scenarioTimeline: ScenarioTimelineItem[];
  };
}

export interface DiagnosisResult {
  scorecard: Scorecard;
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
