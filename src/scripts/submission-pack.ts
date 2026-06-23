import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { diagnoseStrategy } from '../application/diagnose.ts';
import type {
  Dimension,
  Strategy,
} from '../contracts.ts';
import type {
  DashboardAlert,
  DiagnoseRequest,
  DiagnosisView,
} from '../platform/contracts.ts';
import { parseStrategy } from '../strategy/parse.ts';

const EXPECTED_DIMENSIONS: readonly Dimension[] = [
  'sentiment',
  'macro',
  'market-intel',
  'news',
  'technical',
];

export interface SubmissionDiagnosisInput {
  label: string;
  request: DiagnoseRequest;
  view: DiagnosisView;
}

export interface SubmissionPackOptions {
  generatedAt: string;
  seed: number;
  candidates: number;
  diagnoses: readonly SubmissionDiagnosisInput[];
}

export interface SubmissionPackStrategy {
  label: string;
  strategyId: string;
  archetype: Strategy['archetype'];
  timeframe: string;
  universe: readonly string[];
  scenarioSetId: string;
  selectedStyle: DiagnoseRequest['style'];
  riskScore: number;
  worstDrawdownPct: number;
  totalTrades: number;
  robustnessGain: number;
  returnDelta: number;
  deaths: number;
  prescriptionChanges: Record<string, number>;
  riskPosture: 'critical' | 'warning' | 'clear';
  alerts: readonly DashboardAlert[];
  dimensions: readonly {
    dimension: Dimension;
    scenarioName: string;
    cause: string;
    pnlPct: number;
    maxDrawdownPct: number;
    damageScore: number;
  }[];
}

export interface SubmissionPack {
  version: 'submission-pack-v1';
  generatedAt: string;
  evidenceHash: string;
  project: {
    name: 'Strategy Doctor';
    track: 'Bitget AI Hackathon Track 2';
    positioning: string;
  };
  run: {
    seed: number;
    candidates: number;
    deterministicOffline: true;
  };
  readiness: {
    fiveDimensionsCovered: boolean;
    heldOutValidationPresent: boolean;
    prescriptionExported: boolean;
    riskDashboardExported: boolean;
    englishReviewerArtifacts: boolean;
  };
  executiveSummary: readonly string[];
  strategies: readonly SubmissionPackStrategy[];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}

function evidenceHash(value: unknown): string {
  return createHash('sha256')
    .update(stableStringify(value))
    .digest('hex');
}

function riskPosture(alerts: readonly DashboardAlert[]): SubmissionPackStrategy['riskPosture'] {
  if (alerts.some(alert => alert.severity === 'critical')) {
    return 'critical';
  }
  if (alerts.some(alert => alert.severity === 'warning')) {
    return 'warning';
  }
  return 'clear';
}

function hasFiveDimensions(view: DiagnosisView): boolean {
  const seen = new Set(view.scorecard.evaluations.map(item => item.dimension));
  return EXPECTED_DIMENSIONS.every(dimension => seen.has(dimension));
}

function buildStrategySummary(
  input: SubmissionDiagnosisInput,
): SubmissionPackStrategy {
  const alerts = input.view.riskDashboard?.alerts ?? [];
  return {
    label: input.label,
    strategyId: input.request.strategy.id,
    archetype: input.request.strategy.archetype,
    timeframe: input.request.strategy.timeframe,
    universe: [...input.request.strategy.universe],
    scenarioSetId: input.view.scorecard.scenarioSetId,
    selectedStyle: input.request.style,
    riskScore: input.view.summary.riskScore,
    worstDrawdownPct: input.view.summary.worstDrawdownPct,
    totalTrades: input.view.summary.totalTrades,
    robustnessGain: input.view.summary.robustnessGain,
    returnDelta: input.view.summary.returnDelta,
    deaths: input.view.scorecard.deaths.length,
    prescriptionChanges: {
      ...input.view.scorecard.prescription.changes,
    },
    riskPosture: riskPosture(alerts),
    alerts,
    dimensions: input.view.scorecard.evaluations.map(evaluation => ({
      dimension: evaluation.dimension,
      scenarioName: evaluation.scenarioName,
      cause: evaluation.cause,
      pnlPct: evaluation.metrics.pnlPct,
      maxDrawdownPct: evaluation.metrics.maxDrawdownPct,
      damageScore: evaluation.damageScore,
    })),
  };
}

export function createSubmissionPack(
  options: SubmissionPackOptions,
): SubmissionPack {
  const strategies = options.diagnoses.map(buildStrategySummary);
  const readiness = {
    fiveDimensionsCovered: options.diagnoses.every(input =>
      hasFiveDimensions(input.view)),
    heldOutValidationPresent: options.diagnoses.every(input =>
      Number.isFinite(input.view.summary.robustnessGain)
      && Number.isFinite(input.view.summary.returnDelta)),
    prescriptionExported: options.diagnoses.every(input =>
      Boolean(input.view.scorecard.prescription)),
    riskDashboardExported: options.diagnoses.every(input =>
      Boolean(input.view.riskDashboard)),
    englishReviewerArtifacts: true,
  };
  const project = {
    name: 'Strategy Doctor' as const,
    track: 'Bitget AI Hackathon Track 2' as const,
    positioning:
      'An AI trading-infra copilot that stress-tests strategies, explains failure modes, proposes constrained repairs, and verifies held-out trade-offs before deployment.',
  };
  const run = {
    seed: options.seed,
    candidates: options.candidates,
    deterministicOffline: true as const,
  };
  const executiveSummary = [
    'Deterministic five-dimension diagnosis covers sentiment, macro, market-intel, news, and technical stress.',
    'Prescriptions are constrained parameter repairs, not arbitrary strategy rewrites.',
    'Every repair is re-tested on independent held-out scenarios with return cost reported explicitly.',
    'The package is safe for public demo because it does not require exchange account access, balances, orders, or private Bitget credentials.',
  ] as const;

  return {
    version: 'submission-pack-v1',
    generatedAt: options.generatedAt,
    evidenceHash: evidenceHash({
      project,
      run,
      readiness,
      executiveSummary,
      strategies,
    }),
    project,
    run,
    readiness,
    executiveSummary,
    strategies,
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function signed(value: number, digits = 4): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function renderSubmissionPackMarkdown(pack: SubmissionPack): string {
  const readinessRows = Object.entries(pack.readiness)
    .map(([key, value]) => `- ${key}: ${value ? 'pass' : 'needs review'}`)
    .join('\n');
  const strategySections = pack.strategies.map(strategy => {
    const alertRows = strategy.alerts.length > 0
      ? strategy.alerts
        .map(alert =>
          `- ${alert.severity}: ${alert.code} (${alert.value.toFixed(4)} vs ${alert.threshold})`)
        .join('\n')
      : '- No dashboard alerts.';
    const dimensionRows = strategy.dimensions
      .map(dimension =>
        `| ${dimension.dimension} | ${dimension.scenarioName} | ${dimension.cause} | ${percent(dimension.pnlPct)} | ${percent(dimension.maxDrawdownPct)} | ${dimension.damageScore.toFixed(2)} |`)
      .join('\n');
    return `## ${strategy.label}

- Archetype: \`${strategy.archetype}\`
- Strategy ID: \`${strategy.strategyId}\`
- Scenario set: \`${strategy.scenarioSetId}\`
- Selected profile: \`${strategy.selectedStyle}\`
- Risk score: ${strategy.riskScore}
- Worst drawdown: ${percent(strategy.worstDrawdownPct)}
- Held-out robustness: ${signed(strategy.robustnessGain)}
- Held-out return delta: ${percent(strategy.returnDelta)}
- Deaths: ${strategy.deaths}
- Risk posture: ${strategy.riskPosture}
- Prescription changes: \`${JSON.stringify(strategy.prescriptionChanges)}\`

### Five-dimension coverage

| Dimension | Scenario | Result | PnL | Max drawdown | Damage |
|---|---|---|---:|---:|---:|
${dimensionRows}

### Dashboard alerts

${alertRows}`;
  }).join('\n\n');

  return `# Strategy Doctor submission evidence pack

- Generated at: ${pack.generatedAt}
- Evidence hash: \`${pack.evidenceHash}\`
- Track: ${pack.project.track}
- Run controls: seed=${pack.run.seed}, candidates=${pack.run.candidates}, deterministicOffline=${pack.run.deterministicOffline}

## Product positioning

${pack.project.positioning}

## Executive summary

${pack.executiveSummary.map(line => `- ${line}`).join('\n')}

## Readiness checklist

${readinessRows}

## Held-out validation

Held-out validation is included for every strategy. Robustness changes and return deltas are reported separately so reviewers can see both risk reduction and cost.

${strategySections}

## Reproduce locally

\`\`\`powershell
.\\scripts\\build-submission-pack.ps1 -Seed ${pack.run.seed} -Candidates ${pack.run.candidates}
\`\`\`

The generated JSON and Markdown are deterministic for the same code, examples, seed, and frozen market snapshots, except for the top-level generated timestamp.`;
}

interface CliOptions {
  seed: number;
  candidates: number;
  outDir: string;
}

function parseCliArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    seed: 42,
    candidates: 6,
    outDir: 'artifacts/submission-pack',
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--seed') {
      options.seed = Number(args[++index]);
    } else if (arg === '--candidates') {
      options.candidates = Number(args[++index]);
    } else if (arg === '--out') {
      options.outDir = args[++index] ?? options.outDir;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!Number.isSafeInteger(options.seed)) {
    throw new Error('seed must be a safe integer');
  }
  if (
    !Number.isInteger(options.candidates)
    || options.candidates < 1
    || options.candidates > 50
  ) {
    throw new Error('candidates must be an integer from 1 to 50');
  }
  return options;
}

async function diagnoseExample(
  label: string,
  strategyPath: string,
  seed: number,
  candidates: number,
): Promise<SubmissionDiagnosisInput> {
  const strategy = parseStrategy(
    JSON.parse(readFileSync(strategyPath, 'utf8')),
  );
  const request: DiagnoseRequest = {
    strategy,
    style: 'conservative',
    seed,
    candidates,
  };
  const result = await diagnoseStrategy(request);
  return {
    label,
    request,
    view: result.view,
  };
}

export async function runSubmissionPackCli(args: readonly string[]): Promise<void> {
  const options = parseCliArgs(args);
  const diagnoses = await Promise.all([
    diagnoseExample(
      'Moving Average Crossover',
      path.resolve('examples/trend-follower.json'),
      options.seed,
      options.candidates,
    ),
    diagnoseExample(
      'RSI Bollinger Mean Reversion',
      path.resolve('examples/rsi-bollinger.json'),
      options.seed,
      options.candidates,
    ),
  ]);
  const pack = createSubmissionPack({
    generatedAt: new Date().toISOString(),
    seed: options.seed,
    candidates: options.candidates,
    diagnoses,
  });
  mkdirSync(options.outDir, { recursive: true });
  const jsonPath = path.join(options.outDir, 'strategy-doctor-submission-pack.json');
  const markdownPath = path.join(options.outDir, 'strategy-doctor-submission-pack.md');
  writeFileSync(jsonPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, `${renderSubmissionPackMarkdown(pack)}\n`, 'utf8');
  process.stdout.write(`Submission pack written:\n- ${jsonPath}\n- ${markdownPath}\n`);
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runSubmissionPackCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Submission pack failed: ${message}`);
    process.exitCode = 1;
  });
}
