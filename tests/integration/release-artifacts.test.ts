import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  Dimension,
  Scorecard,
  StrategyArchetype,
} from '../../src/contracts.ts';
import type {
  DiagnoseRequest,
  DiagnosisView,
} from '../../src/platform/contracts.ts';
import { parseStrategy } from '../../src/strategy/parse.ts';

const CLI_PATH = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
const EXPECTED_DIMENSIONS: Dimension[] = [
  'macro',
  'market-intel',
  'news',
  'sentiment',
  'technical',
];
const EXPECTED_STYLES = ['aggressive', 'conservative', 'trend'];
const SUBMISSION_ARTIFACTS = {
  ma: 'ma-cross',
  rsi: 'rsi-bollinger-mean-reversion',
  breakout: 'breakout-confirmation',
} as const satisfies Record<string, StrategyArchetype>;
const SECRET_LIKE_PATTERN = /(?:playbook\s+key|GETAGENT_ACCESS_KEY)\s*[:=]\s*['"]?(?!<|replace-|demo-)[A-Za-z0-9_-]{12,}/i;
const EXAMPLES: {
  path: string;
  archetype: StrategyArchetype;
}[] = [
  {
    path: 'examples/trend-follower.json',
    archetype: 'ma-cross',
  },
  {
    path: 'examples/rsi-bollinger.json',
    archetype: 'rsi-bollinger-mean-reversion',
  },
  {
    path: 'examples/breakout-confirmation.json',
    archetype: 'breakout-confirmation',
  },
];

interface SubmissionApiLogEntry {
  timestamp: string;
  endpoint: string;
  requestId: string;
  strategyId: string;
  archetype: StrategyArchetype;
  status: number;
  latencyMs: number;
  evaluations: number;
  selectedStyleRiskScore: number;
  deploymentStatus: string;
  deploymentScore: number;
  deaths: string[];
}

const readRepoText = (relativePath: string): string =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const readRepoJson = <T>(relativePath: string): T =>
  JSON.parse(readRepoText(relativePath)) as T;

const runCliJson = (relativePath: string): Scorecard => {
  const output = execFileSync(
    process.execPath,
    [
      CLI_PATH,
      fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
      '--style',
      'conservative',
      '--seed',
      '42',
      '--candidates',
      '6',
      '--format',
      'json',
    ],
    { encoding: 'utf8' },
  );
  return JSON.parse(output) as Scorecard;
};

test('public release docs reference executable registered strategy examples', () => {
  for (const docPath of [
    'README.md',
    'docs/DEMO.md',
    'docs/SUBMISSION.md',
    'docs/SUBMISSION_EVIDENCE.md',
  ]) {
    const text = readRepoText(docPath);
    for (const example of EXAMPLES) {
      assert.ok(
        text.includes(example.path),
        `${docPath} should mention ${example.path}`,
      );
    }
  }
});

test('hackathon evidence docs point reviewers to public UI and Playbook proof', () => {
  const publicEntryReferences = [
    'http://127.0.0.1:8080/showcase',
    'SUBMISSION_EVIDENCE.md',
    'PLAYBOOK_EVIDENCE.md',
  ];

  for (const docPath of [
    'README.md',
    'docs/DEMO.md',
    'docs/SUBMISSION.md',
  ]) {
    const text = readRepoText(docPath);
    assert.doesNotMatch(text, SECRET_LIKE_PATTERN);
    for (const expectedReference of publicEntryReferences) {
      assert.ok(
        text.includes(expectedReference),
        `${docPath} should mention ${expectedReference}`,
      );
    }
  }

  const submissionEvidence = readRepoText('docs/SUBMISSION_EVIDENCE.md');
  for (const expectedReference of [
    'http://127.0.0.1:8080/showcase',
    'examples/submission/api-call-log.jsonl',
    'examples/playbook/strategy-doctor-adaptive-playbook',
  ]) {
    assert.ok(
      submissionEvidence.includes(expectedReference),
      `docs/SUBMISSION_EVIDENCE.md should mention ${expectedReference}`,
    );
  }

  const playbookEvidence = readRepoText('docs/PLAYBOOK_EVIDENCE.md');
  assert.match(
    playbookEvidence,
    /examples\/playbook\/strategy-doctor-adaptive-playbook/,
  );
  assert.match(playbookEvidence, /GETAGENT_ACCESS_KEY/);
  assert.doesNotMatch(
    submissionEvidence + playbookEvidence,
    SECRET_LIKE_PATTERN,
  );
});

test('published strategy examples parse and produce complete offline scorecards', () => {
  for (const example of EXAMPLES) {
    const strategy = parseStrategy(
      JSON.parse(readRepoText(example.path)),
    );
    assert.equal(strategy.archetype, example.archetype);

    const scorecard = runCliJson(example.path);
    assert.equal(scorecard.scenarioSetId, 'tx42/ho100042');
    assert.equal(
      scorecard.prescription.patchedStrategy.archetype,
      example.archetype,
    );
    assert.deepEqual(
      Object.keys(scorecard.perStyle).sort(),
      EXPECTED_STYLES,
    );
    assert.deepEqual(
      scorecard.evaluations
        .map(evaluation => evaluation.dimension)
        .sort(),
      EXPECTED_DIMENSIONS,
    );
    assert.ok(Number.isFinite(scorecard.tradeoff.robustnessGain));
    assert.ok(Number.isFinite(scorecard.tradeoff.returnCost));
    assert.ok(scorecard.evaluations.every(evaluation => (
      Number.isFinite(evaluation.metrics.pnlPct)
      && Number.isFinite(evaluation.metrics.maxDrawdownPct)
      && Number.isInteger(evaluation.metrics.numTrades)
      && evaluation.metrics.equityCurve.length > 0
    )));
  }
});

test('submission sample inputs and outputs are reproducible reviewer artifacts', () => {
  const apiLog = readRepoText('examples/submission/api-call-log.jsonl')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as SubmissionApiLogEntry);
  assert.equal(apiLog.length, Object.keys(SUBMISSION_ARTIFACTS).length);
  assert.deepEqual(
    apiLog.map(item => item.status),
    Array.from(
      { length: Object.keys(SUBMISSION_ARTIFACTS).length },
      () => 200,
    ),
  );
  assert.ok(apiLog.every(item => (
    item.endpoint === 'POST /api/v1/diagnoses'
    && item.requestId.startsWith('req_submission_')
    && item.evaluations === EXPECTED_DIMENSIONS.length
    && Number.isFinite(item.latencyMs)
    && Number.isFinite(item.deploymentScore)
    && ['ready', 'watch', 'blocked'].includes(item.deploymentStatus)
  )));

  for (const [prefix, expectedArchetype] of Object.entries(
    SUBMISSION_ARTIFACTS,
  )) {
    const request = readRepoJson<DiagnoseRequest>(
      `examples/submission/${prefix}-diagnose-request.json`,
    );
    const scorecard = readRepoJson<Scorecard>(
      `examples/submission/${prefix}-scorecard.json`,
    );
    const view = readRepoJson<DiagnosisView>(
      `examples/submission/${prefix}-diagnosis-view.json`,
    );

    assert.equal(request.strategy.archetype, expectedArchetype);
    assert.equal(request.style, 'conservative');
    assert.equal(request.seed, 42);
    assert.equal(request.candidates, 6);
    assert.equal(scorecard.scenarioSetId, 'tx42/ho100042');
    assert.equal(view.scorecard.scenarioSetId, scorecard.scenarioSetId);
    assert.equal(
      view.scorecard.prescription.patchedStrategy.archetype,
      expectedArchetype,
    );
    assert.deepEqual(
      view.scorecard.evaluations
        .map(evaluation => evaluation.dimension)
        .sort(),
      EXPECTED_DIMENSIONS,
    );
    assert.equal(view.charts.riskRadar.length, EXPECTED_DIMENSIONS.length);
    assert.ok(Number.isFinite(view.deployment.score));
    assert.ok(['ready', 'watch', 'blocked'].includes(view.deployment.status));
    if (expectedArchetype !== 'breakout-confirmation') {
      assert.ok(view.charts.parameterChanges.length > 0);
    }
    assert.ok(Number.isFinite(view.summary.riskScore));
  }
});

test('Playbook package stays local-validatable and credential-free', () => {
  const basePath = 'examples/playbook/strategy-doctor-adaptive-playbook';
  const manifest = readRepoText(`${basePath}/manifest.yaml`);
  const readme = readRepoText(`${basePath}/README.md`);
  const strategy = readRepoText(`${basePath}/src/strategy.py`);

  assert.match(manifest, /name: strategy-doctor-risk-gated-btc/);
  assert.match(manifest, /trading_symbols:\s*\["BTCUSDT"\]/);
  assert.match(manifest, /signal_only/);
  assert.match(readme, /Strategy Doctor Risk-Gated BTC/);
  assert.match(strategy, /class EmaCrossStrategy\(Strategy\)/);
  assert.match(strategy, /def on_bar\(self, bar: Bar\)/);
  assert.doesNotMatch(manifest + readme + strategy, SECRET_LIKE_PATTERN);
});
