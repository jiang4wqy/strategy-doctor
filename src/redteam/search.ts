import { mulberry32 } from '../backtest/path.ts';
import type {
  BacktestAdapter,
  Dimension,
  Metrics,
  Scenario,
  Strategy,
} from '../contracts.ts';
import {
  buildBaseScenarioSet,
  type SnapshotBundle,
} from '../data/snapshots.ts';

interface Bounds {
  magnitude: readonly [number, number];
  duration: readonly [number, number];
  vol: readonly [number, number];
}

const DIMENSION_ORDER: Dimension[] = [
  'macro',
  'market-intel',
  'news',
  'sentiment',
  'technical',
];

const BOUNDS: Record<Dimension, Bounds> = {
  macro: {
    magnitude: [0.08, 0.4],
    duration: [24, 192],
    vol: [1, 3],
  },
  'market-intel': {
    magnitude: [0.12, 0.4],
    duration: [18, 72],
    vol: [1.2, 3],
  },
  news: {
    magnitude: [0.08, 0.35],
    duration: [1, 12],
    vol: [1.2, 3],
  },
  sentiment: {
    magnitude: [0.15, 0.45],
    duration: [24, 72],
    vol: [1.5, 3],
  },
  technical: {
    magnitude: [0.15, 0.4],
    duration: [40, 100],
    vol: [1, 2],
  },
};

const clamp = (value: number, range: readonly [number, number]): number =>
  Math.min(range[1], Math.max(range[0], value));

const round6 = (value: number): number =>
  Math.round(value * 1_000_000) / 1_000_000;

function dimensionHash(dimension: Dimension): number {
  let hash = 2166136261;
  for (const character of dimension) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function damageScore(metrics: Metrics): number {
  return (
    (metrics.liquidated ? 1000 : 0)
    + metrics.maxDrawdownPct * 100
    - metrics.pnlPct * 100
  );
}

export function buildScenarioCandidates(
  base: Scenario,
  candidateCount: number,
): Scenario[] {
  if (
    !Number.isInteger(candidateCount)
    || candidateCount < 1
    || candidateCount > 50
  ) {
    throw new Error('candidate count must be an integer from 1 to 50');
  }

  const bounds = BOUNDS[base.dimension];
  const random = mulberry32(
    (base.shock.seed ^ dimensionHash(base.dimension)) >>> 0,
  );
  const candidates: Scenario[] = [];

  for (let index = 0; index < candidateCount; index++) {
    const shock = index === 0
      ? { ...base.shock }
      : {
        ...base.shock,
        magnitude: round6(clamp(
          base.shock.magnitude * (0.75 + random() * 0.5),
          bounds.magnitude,
        )),
        durationBars: Math.round(clamp(
          base.shock.durationBars * (0.75 + random() * 0.5),
          bounds.duration,
        )),
        volMult: round6(clamp(
          base.shock.volMult * (0.85 + random() * 0.35),
          bounds.vol,
        )),
      };
    candidates.push({
      ...base,
      id: `${base.dimension}-${base.shock.seed}-c${index}`,
      shock,
    });
  }

  return candidates;
}

export async function selectWorstPerDimension(
  strategy: Strategy,
  candidates: Scenario[],
  backtest: BacktestAdapter,
): Promise<Scenario[]> {
  if (candidates.length === 0) {
    throw new Error('scenario candidates must not be empty');
  }

  const evaluated = await Promise.all(
    candidates.map(async scenario => ({
      scenario,
      score: damageScore(await backtest.run(strategy, scenario)),
    })),
  );

  return DIMENSION_ORDER.flatMap(dimension => {
    const matches = evaluated
      .filter(candidate => candidate.scenario.dimension === dimension)
      .sort((left, right) => (
        right.score - left.score
        || left.scenario.id.localeCompare(right.scenario.id)
      ));
    return matches.length > 0 ? [matches[0].scenario] : [];
  });
}

export async function buildAdversarialScenarioSet(
  strategy: Strategy,
  bundle: SnapshotBundle,
  seed: number,
  candidateCount: number,
  backtest: BacktestAdapter,
): Promise<Scenario[]> {
  const candidates = buildBaseScenarioSet(bundle, seed)
    .flatMap(scenario => buildScenarioCandidates(scenario, candidateCount));
  return selectWorstPerDimension(strategy, candidates, backtest);
}
