import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Scorecard } from '../../src/contracts.ts';
import {
  assessDeploymentReadiness,
} from '../../src/application/deployability.ts';

const baseScorecard: Scorecard = {
  strategyId: 'ready',
  scenarioSetId: 'tx42/ho100042',
  perStyle: {
    conservative: {
      style: 'conservative',
      riskScore: 92,
      survived: true,
      worstDrawdownPct: 0.12,
      meanPnlPct: 0.08,
    },
    aggressive: {
      style: 'aggressive',
      riskScore: 95,
      survived: true,
      worstDrawdownPct: 0.12,
      meanPnlPct: 0.08,
    },
    trend: {
      style: 'trend',
      riskScore: 94,
      survived: true,
      worstDrawdownPct: 0.12,
      meanPnlPct: 0.08,
    },
  },
  evaluations: ['macro', 'market-intel', 'news', 'sentiment', 'technical']
    .map((dimension, index) => ({
      scenarioId: `scenario-${index}`,
      scenarioName: `${dimension} stress`,
      dimension: dimension as Scorecard['evaluations'][number]['dimension'],
      sourceSkill: `${dimension}-skill`,
      severity: 2,
      shock: {
        kind: 'grind' as const,
        magnitude: 0.1,
        durationBars: 20,
        volMult: 1.2,
        seed: index,
      },
      metrics: {
        pnlPct: 0.02,
        maxDrawdownPct: 0.1,
        liquidated: false,
        numTrades: 2,
        equityCurve: [1, 1.02],
      },
      cause: 'survived' as const,
      damageScore: 0,
      narrative: `${dimension} narrative`,
    })),
  deaths: [],
  prescription: {
    changes: {},
    rationale: '',
    patchedStrategy: {
      id: 'ready',
      name: 'ready',
      archetype: 'ma-cross',
      params: {
        fastMA: 8,
        slowMA: 30,
        leverage: 3,
        stopLossPct: 0.08,
        positionPct: 0.5,
      },
      universe: ['BTCUSDT'],
      timeframe: '1h',
    },
  },
  tradeoff: {
    robustnessGain: 8,
    returnCost: -0.03,
  },
};

test('assessDeploymentReadiness marks clean held-out improvement ready', () => {
  const readiness = assessDeploymentReadiness(baseScorecard, 'conservative');

  assert.equal(readiness.status, 'ready');
  assert.ok(readiness.score >= 75);
  assert.equal(readiness.blockers.length, 0);
  assert.ok(readiness.gates.every(gate => gate.passed));
});

test('assessDeploymentReadiness blocks liquidation and severe drawdown', () => {
  const broken: Scorecard = {
    ...baseScorecard,
    perStyle: {
      ...baseScorecard.perStyle,
      conservative: {
        ...baseScorecard.perStyle.conservative,
        riskScore: 25,
        worstDrawdownPct: 0.72,
      },
    },
    evaluations: baseScorecard.evaluations.map((evaluation, index) => ({
      ...evaluation,
      metrics: {
        ...evaluation.metrics,
        liquidated: index === 0,
        maxDrawdownPct: index === 0 ? 0.72 : 0.2,
      },
      cause: index === 0 ? 'liquidation' : evaluation.cause,
    })),
    tradeoff: {
      robustnessGain: -4,
      returnCost: -0.24,
    },
  };
  const readiness = assessDeploymentReadiness(broken, 'conservative');

  assert.equal(readiness.status, 'blocked');
  assert.ok(readiness.score < 50);
  assert.ok(readiness.blockers.some(blocker =>
    blocker.includes('No liquidation')
  ));
});
