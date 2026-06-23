import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockBacktester } from '../../src/backtest/mock.ts';
import type { Strategy } from '../../src/contracts.ts';
import {
  buildBaseScenarioSet,
  loadDefaultSnapshotBundle,
} from '../../src/data/snapshots.ts';
import { runDoctorDetailed } from '../../src/pipeline/doctor.ts';
import { buildDiagnosisView } from '../../src/application/view.ts';
import type { DiagnoseRequest } from '../../src/platform/contracts.ts';

const strategy = JSON.parse(
  readFileSync(
    new URL('../../examples/trend-follower.json', import.meta.url),
    'utf8',
  ),
) as Strategy;

test('buildDiagnosisView derives deterministic chart data without changing the scorecard', async () => {
  const treatment = buildBaseScenarioSet(loadDefaultSnapshotBundle(), 42);
  const heldOut = buildBaseScenarioSet(
    loadDefaultSnapshotBundle(),
    100042,
  );
  const request: DiagnoseRequest = {
    strategy,
    style: 'conservative',
    seed: 42,
    candidates: 6,
  };
  const doctor = await runDoctorDetailed(
    strategy,
    new MockBacktester(),
    {
      style: request.style,
      treatment,
      heldOut,
    },
  );
  const scorecardBefore = structuredClone(doctor.scorecard);

  const view = buildDiagnosisView(request, doctor, heldOut);

  assert.deepEqual(doctor.scorecard, scorecardBefore);
  assert.deepEqual(view.scorecard, doctor.scorecard);
  assert.equal(
    view.summary.riskScore,
    doctor.scorecard.perStyle.conservative.riskScore,
  );
  assert.equal(
    view.summary.returnDelta,
    doctor.scorecard.tradeoff.returnCost,
  );
  assert.equal(
    view.summary.totalTrades,
    doctor.scorecard.evaluations.reduce(
      (sum, evaluation) => sum + evaluation.metrics.numTrades,
      0,
    ),
  );
  assert.equal(
    view.summary.totalTurnoverPct,
    doctor.scorecard.evaluations.reduce(
      (sum, evaluation) => sum + (evaluation.metrics.turnoverPct ?? 0),
      0,
    ),
  );
  assert.equal(
    view.summary.feeCostPct,
    doctor.scorecard.evaluations.reduce(
      (sum, evaluation) => sum + (evaluation.metrics.feeCostPct ?? 0),
      0,
    ),
  );
  assert.equal(view.charts.treatmentEquity.length, treatment.length);
  assert.equal(view.charts.treatmentDrawdown.length, treatment.length);
  assert.equal(view.charts.executionQuality.length, treatment.length);
  assert.ok(view.charts.treatmentDrawdown.every(item => item.drawdown.length > 0));
  assert.equal(view.charts.heldOutComparison.length, heldOut.length);
  assert.deepEqual(
    view.charts.heldOutComparison.map(item => item.dimension),
    heldOut.map(scenario => scenario.dimension),
  );

  const expectedDefault = heldOut[
    doctor.heldOut.originalMetrics.reduce(
      (worst, metrics, index, all) => (
        metrics.maxDrawdownPct > all[worst].maxDrawdownPct
          ? index
          : worst
      ),
      0,
    )
  ].dimension;
  assert.equal(view.charts.defaultHeldOutDimension, expectedDefault);
  assert.ok(view.charts.riskRadar.every(item => {
    const evaluation = doctor.scorecard.evaluations.find(
      candidate => candidate.dimension === item.dimension,
    );
    if (!evaluation) {
      return false;
    }
    const expected = evaluation.metrics.liquidated
      ? 100
      : Math.round(Math.min(
        100,
        Math.max(0, evaluation.metrics.maxDrawdownPct * 100),
      ));
    return item.value === expected;
  }));
  assert.deepEqual(
    view.charts.scenarioTimeline.map(item => item.damageScore),
    [...view.charts.scenarioTimeline]
      .map(item => item.damageScore)
      .sort((left, right) => right - left),
  );
  assert.ok(
    view.charts.parameterChanges.every(
      change => change.before !== change.after,
    ),
  );
});
