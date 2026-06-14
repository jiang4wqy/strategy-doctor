import type {
  Dimension,
  Scenario,
  StrategyParamKey,
} from '../contracts.ts';
import type { DoctorResult } from '../pipeline/doctor.ts';
import type {
  DiagnoseRequest,
  DiagnosisView,
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

export function buildDiagnosisView(
  request: DiagnoseRequest,
  doctor: DoctorResult,
  heldOut: readonly Scenario[],
): DiagnosisView {
  const selectedStyle = doctor.scorecard.perStyle[request.style];
  return {
    scorecard: doctor.scorecard,
    summary: {
      riskScore: selectedStyle.riskScore,
      worstDrawdownPct: selectedStyle.worstDrawdownPct,
      totalTrades: doctor.scorecard.evaluations.reduce(
        (sum, evaluation) => sum + evaluation.metrics.numTrades,
        0,
      ),
      robustnessGain: doctor.scorecard.tradeoff.robustnessGain,
      returnDelta: doctor.scorecard.tradeoff.returnCost,
    },
    charts: {
      treatmentEquity: doctor.scorecard.evaluations.map(evaluation => ({
        dimension: evaluation.dimension,
        equity: [...evaluation.metrics.equityCurve],
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
        }))
        .sort((left, right) => right.damageScore - left.damageScore),
    },
  };
}
