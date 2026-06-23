import type {
  Dimension,
  Scenario,
  StrategyParamKey,
  StyleName,
} from '../contracts.ts';
import type { DoctorResult } from '../pipeline/doctor.ts';
import type {
  DiagnoseRequest,
  DiagnosisView,
  DashboardAlert,
  DiagnosisModelConsistency,
  RiskDashboard,
  ParameterChange,
} from '../platform/contracts.ts';
import {
  getStrategyAdapter,
  type AnyStrategyAdapter,
} from '../strategy/registry.ts';

function parameterChanges(
  request: DiagnoseRequest,
  doctor: DoctorResult,
): ParameterChange[] {
  const before = request.strategy.params as unknown as Record<string, number>;
  const after = doctor.scorecard.prescription.patchedStrategy
    .params as unknown as Record<string, number>;
  const adapter = getStrategyAdapter(
    request.strategy.archetype,
  ) as AnyStrategyAdapter;

  return Object.keys(doctor.scorecard.prescription.changes)
    .flatMap(key => {
      const previous = before[key];
      const next = after[key];
      if (
        typeof previous !== 'number'
        || typeof next !== 'number'
        || previous === next
      ) {
        return [];
      }
      const parameterKey = key as StrategyParamKey;
      return [{
        key: parameterKey,
        label: adapter.paramLabel(parameterKey as never),
        before: previous,
        after: next,
      }];
    });
}

function defaultHeldOutDimension(
  doctor: DoctorResult,
  heldOut: readonly Scenario[],
): Dimension {
  let worstIndex = 0;
  for (
    let index = 1;
    index < doctor.heldOut.originalMetrics.length;
    index++
  ) {
    if (
      doctor.heldOut.originalMetrics[index].maxDrawdownPct
      > doctor.heldOut.originalMetrics[worstIndex].maxDrawdownPct
    ) {
      worstIndex = index;
    }
  }
  return heldOut[worstIndex].dimension;
}

const TREND_SCORE_THRESHOLD = 35;
const DEFENSE_SCORE_THRESHOLD = 42;
const COST_EFFICIENCY_THRESHOLD = 1;
const COST_RATIO_CRITICAL_THRESHOLD = 0.25;
const MAX_RETURN_COST_FOR_INF = 0.0005;

function addAlert(
  alerts: DashboardAlert[],
  code: string,
  severity: DashboardAlert['severity'],
  message: string,
  value: number,
  threshold: number,
): void {
  alerts.push({
    code,
    severity,
    message,
    value,
    threshold,
  });
}

function buildRiskDashboard(doctor: DoctorResult, selectedStyle: StyleName): RiskDashboard {
  const trendScore = doctor.scorecard.perStyle.trend.riskScore;
  const defenseScore = doctor.scorecard.perStyle.conservative.riskScore;
  const robustness = doctor.scorecard.tradeoff.robustnessGain;
  const returnCost = doctor.scorecard.tradeoff.returnCost * 100;
  const costEfficiency = Math.abs(returnCost) <= MAX_RETURN_COST_FOR_INF
    ? (robustness >= 0 ? 999 : 0)
    : Number((robustness / Math.abs(returnCost)).toFixed(4));
  const gap = trendScore - defenseScore;
  const alerts: DashboardAlert[] = [];

  if (selectedStyle === 'trend' && trendScore < TREND_SCORE_THRESHOLD) {
    addAlert(
      alerts,
      'trend-threshold',
      'warning',
      'trend score is below the threshold',
      trendScore,
      TREND_SCORE_THRESHOLD,
    );
  }
  if (defenseScore < DEFENSE_SCORE_THRESHOLD) {
    addAlert(
      alerts,
      'defense-threshold',
      'warning',
      'defense score is below the threshold',
      defenseScore,
      DEFENSE_SCORE_THRESHOLD,
    );
  }
  if (robustness < 0) {
    addAlert(
      alerts,
      'robustness-negative',
      'critical',
      'held-out robustness is negative',
      robustness,
      0,
    );
  }
  if (costEfficiency < COST_EFFICIENCY_THRESHOLD) {
    addAlert(
      alerts,
      'cost-efficiency-threshold',
      costEfficiency <= COST_RATIO_CRITICAL_THRESHOLD ? 'critical' : 'warning',
      'cost-efficiency is below the threshold',
      costEfficiency,
      COST_EFFICIENCY_THRESHOLD,
    );
  }

  return {
    trendScore,
    defenseScore,
    costEfficiency,
    trendDefenseGap: gap,
    costEfficiencyThreshold: COST_EFFICIENCY_THRESHOLD,
    trendThreshold: TREND_SCORE_THRESHOLD,
    defenseThreshold: DEFENSE_SCORE_THRESHOLD,
    alerts,
  };
}

function buildModelConsistency(
  doctor: DoctorResult,
): DiagnosisModelConsistency | undefined {
  const prescription = doctor.modelConsistency?.prescriptionAgreement;
  const narration = doctor.modelConsistency?.narrationAgreement;
  if (!prescription && !narration) {
    return undefined;
  }

  return {
    prescription: prescription
      ? {
        agreementRate: prescription.agreementRate,
        requestedStyles: prescription.requestedStyles,
        agreeingStyles: prescription.agreeingStyles,
        mismatches: prescription.mismatches,
      }
      : undefined,
    narration: narration
      ? {
        agreementRate: narration.agreementRate,
        requestedModels: narration.requestedModels,
        agreeingModels: narration.agreeingModels,
        mismatches: narration.mismatches,
        avgSimilarity: narration.avgSimilarity,
        sampleCount: narration.sampleCount,
      }
      : undefined,
  };
}

function drawdownCurve(equityCurve: readonly number[]): number[] {
  let peak = equityCurve[0] ?? 1;
  return equityCurve.map(value => {
    peak = Math.max(peak, value);
    return peak <= 0 ? 0 : (peak - value) / peak;
  });
}

export function buildDiagnosisView(
  request: DiagnoseRequest,
  doctor: DoctorResult,
  heldOut: readonly Scenario[],
): DiagnosisView {
  const selectedStyle = doctor.scorecard.perStyle[request.style];
  const totalTrades = doctor.scorecard.evaluations.reduce(
    (sum, evaluation) => sum + evaluation.metrics.numTrades,
    0,
  );
  const totalTurnoverPct = doctor.scorecard.evaluations.reduce(
    (sum, evaluation) => sum + (evaluation.metrics.turnoverPct ?? 0),
    0,
  );
  const feeCostPct = doctor.scorecard.evaluations.reduce(
    (sum, evaluation) => sum + (evaluation.metrics.feeCostPct ?? 0),
    0,
  );
  const slippageCostPct = doctor.scorecard.evaluations.reduce(
    (sum, evaluation) => sum + (evaluation.metrics.slippageCostPct ?? 0),
    0,
  );
  return {
    scorecard: doctor.scorecard,
    summary: {
      riskScore: selectedStyle.riskScore,
      worstDrawdownPct: selectedStyle.worstDrawdownPct,
      totalTrades,
      totalTurnoverPct,
      feeCostPct,
      slippageCostPct,
      robustnessGain: doctor.scorecard.tradeoff.robustnessGain,
      returnDelta: doctor.scorecard.tradeoff.returnCost,
    },
    modelConsistency: buildModelConsistency(doctor),
    riskDashboard: buildRiskDashboard(doctor, selectedStyle.style),
    charts: {
      treatmentEquity: doctor.scorecard.evaluations.map(evaluation => ({
        dimension: evaluation.dimension,
        equity: [...evaluation.metrics.equityCurve],
      })),
      treatmentDrawdown: doctor.scorecard.evaluations.map(evaluation => ({
        dimension: evaluation.dimension,
        drawdown: [
          ...(evaluation.metrics.drawdownCurve
            ?? drawdownCurve(evaluation.metrics.equityCurve)),
        ],
      })),
      heldOutComparison: heldOut.map((scenario, index) => ({
        dimension: scenario.dimension,
        original: [
          ...doctor.heldOut.originalMetrics[index].equityCurve,
        ],
        patched: [
          ...doctor.heldOut.patchedMetrics[index].equityCurve,
        ],
      })),
      defaultHeldOutDimension: defaultHeldOutDimension(doctor, heldOut),
      riskRadar: doctor.scorecard.evaluations.map(evaluation => ({
        dimension: evaluation.dimension,
        value: evaluation.metrics.liquidated
          ? 100
          : Math.round(Math.min(
            100,
            Math.max(0, evaluation.metrics.maxDrawdownPct * 100),
          )),
      })),
      parameterChanges: parameterChanges(request, doctor),
      scenarioTimeline: doctor.scorecard.evaluations
        .map(evaluation => ({
          dimension: evaluation.dimension,
          scenarioName: evaluation.scenarioName,
          damageScore: evaluation.damageScore,
          cause: evaluation.cause,
          pnlPct: evaluation.metrics.pnlPct,
          maxDrawdownPct: evaluation.metrics.maxDrawdownPct,
          turnoverPct: evaluation.metrics.turnoverPct ?? 0,
        }))
        .sort((left, right) => right.damageScore - left.damageScore),
      executionQuality: doctor.scorecard.evaluations.map(evaluation => ({
        dimension: evaluation.dimension,
        scenarioName: evaluation.scenarioName,
        turnoverPct: evaluation.metrics.turnoverPct ?? 0,
        feeCostPct: evaluation.metrics.feeCostPct ?? 0,
        slippageCostPct: evaluation.metrics.slippageCostPct ?? 0,
        numTrades: evaluation.metrics.numTrades,
      })),
    },
  };
}
