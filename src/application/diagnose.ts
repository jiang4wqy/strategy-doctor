import { MockBacktester } from '../backtest/mock.ts';
import type {
  BacktestAdapter,
  StyleName,
} from '../contracts.ts';
import {
  loadDefaultSnapshotBundle,
  type SnapshotBundle,
} from '../data/snapshots.ts';
import { runDoctorDetailed } from '../pipeline/doctor.ts';
import type {
  DiagnoseRequest,
  DiagnosisResult,
} from '../platform/contracts.ts';
import type { Narrator } from '../redteam/narrate.ts';
import { buildAdversarialScenarioSet } from '../redteam/search.ts';
import { parseStrategy } from '../strategy/parse.ts';
import { buildDiagnosisView } from './view.ts';

const STYLES = new Set<StyleName>([
  'conservative',
  'aggressive',
  'trend',
]);

export interface DiagnoseDependencies {
  backtest?: BacktestAdapter;
  snapshots?: SnapshotBundle;
  narrator?: Narrator;
}

function validateRequest(request: DiagnoseRequest): void {
  if (!STYLES.has(request.style)) {
    throw new Error(`unsupported style: ${String(request.style)}`);
  }
  if (
    !Number.isSafeInteger(request.seed)
    || !Number.isSafeInteger(request.seed + 100_000)
  ) {
    throw new Error('seed and held-out seed must be safe integers');
  }
  if (
    !Number.isInteger(request.candidates)
    || request.candidates < 1
    || request.candidates > 50
  ) {
    throw new Error('candidate count must be an integer from 1 to 50');
  }
}

export async function diagnoseStrategy(
  request: DiagnoseRequest,
  dependencies: DiagnoseDependencies = {},
): Promise<DiagnosisResult> {
  validateRequest(request);
  const strategy = parseStrategy(request.strategy);
  const normalizedRequest: DiagnoseRequest = {
    ...request,
    strategy,
  };
  const backtest = dependencies.backtest ?? new MockBacktester();
  const snapshots = dependencies.snapshots ?? loadDefaultSnapshotBundle();
  const heldOutSeed = request.seed + 100_000;
  const [treatment, heldOut] = await Promise.all([
    buildAdversarialScenarioSet(
      strategy,
      snapshots,
      request.seed,
      request.candidates,
      backtest,
    ),
    buildAdversarialScenarioSet(
      strategy,
      snapshots,
      heldOutSeed,
      request.candidates,
      backtest,
    ),
  ]);
  const doctor = await runDoctorDetailed(strategy, backtest, {
    style: request.style,
    treatment,
    heldOut,
    narrator: dependencies.narrator,
  });

  return {
    scorecard: doctor.scorecard,
    view: buildDiagnosisView(normalizedRequest, doctor, heldOut),
  };
}
