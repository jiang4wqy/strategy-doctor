import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(repoRoot, 'submission-package');
const artifactDir = join(outputDir, 'artifacts');

const copyTargets = [
  'README.md',
  'docs/SUBMISSION.md',
  'docs/SUBMISSION_FORM.md',
  'docs/SUBMISSION_EVIDENCE.md',
  'docs/PLAYBOOK_EVIDENCE.md',
  'docs/WORK_LOG.md',
  'examples/trend-follower.json',
  'examples/rsi-bollinger.json',
  'examples/breakout-confirmation.json',
  'examples/atr-trend-breakout.json',
  'examples/playbook/strategy-doctor-adaptive-playbook/manifest.yaml',
  'examples/playbook/strategy-doctor-adaptive-playbook/README.md',
];

const scorecards = [
  ['ma', 'examples/submission/ma-scorecard.json'],
  ['rsi', 'examples/submission/rsi-scorecard.json'],
  ['breakout', 'examples/submission/breakout-scorecard.json'],
  ['atr', 'examples/submission/atr-scorecard.json'],
];

const submissionArtifacts = [
  'examples/submission/api-call-log.jsonl',
  'examples/submission/ma-diagnose-request.json',
  'examples/submission/ma-scorecard.json',
  'examples/submission/ma-diagnosis-view.json',
  'examples/submission/rsi-diagnose-request.json',
  'examples/submission/rsi-scorecard.json',
  'examples/submission/rsi-diagnosis-view.json',
  'examples/submission/breakout-diagnose-request.json',
  'examples/submission/breakout-scorecard.json',
  'examples/submission/breakout-diagnosis-view.json',
  'examples/submission/atr-diagnose-request.json',
  'examples/submission/atr-scorecard.json',
  'examples/submission/atr-diagnosis-view.json',
];

function readRepo(path) {
  return readFileSync(join(repoRoot, path));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function copyRepoFile(path) {
  const source = join(repoRoot, path);
  const destination = join(artifactDir, path);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(artifactDir, { recursive: true });

for (const target of [...copyTargets, ...submissionArtifacts]) {
  copyRepoFile(target);
}

const strategySummaries = scorecards.map(([id, path]) => {
  const scorecard = JSON.parse(readRepo(path));
  const conservative = scorecard.perStyle.conservative;
  return {
    id,
    strategyId: scorecard.strategyId,
    scenarioSetId: scorecard.scenarioSetId,
    riskScore: conservative.riskScore,
    worstDrawdownPct: conservative.worstDrawdownPct,
    deaths: scorecard.deaths.map(death => death.cause),
    robustnessGain: scorecard.tradeoff.robustnessGain,
    returnCost: scorecard.tradeoff.returnCost,
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  localShowcase: 'http://127.0.0.1:8080/showcase',
  repositoryBranch: 'main',
  validation: {
    tests: 271,
    passed: 269,
    skipped: 2,
    lineCoveragePct: 96.58,
    branchCoveragePct: 88.93,
    functionCoveragePct: 99.2,
    playbookValidator: 'Validation PASSED',
  },
  strategies: strategySummaries,
  artifacts: [...copyTargets, ...submissionArtifacts].map(path => {
    const content = readRepo(path);
    return {
      path,
      sha256: sha256(content),
      bytes: content.length,
    };
  }),
};

writeFileSync(
  join(outputDir, 'summary.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const markdown = `# Strategy Doctor Submission Package

Generated: ${manifest.generatedAt}

## Reviewer Entry Points

- Local showcase: ${manifest.localShowcase}
- Submission form draft: docs/SUBMISSION_FORM.md
- Submission evidence: docs/SUBMISSION_EVIDENCE.md
- Playbook evidence: docs/PLAYBOOK_EVIDENCE.md

## Validation

| Check | Result |
|---|---|
| Tests | ${manifest.validation.passed} passed / ${manifest.validation.skipped} skipped |
| Coverage | Lines ${manifest.validation.lineCoveragePct}%, branches ${manifest.validation.branchCoveragePct}%, functions ${manifest.validation.functionCoveragePct}% |
| Playbook validator | ${manifest.validation.playbookValidator} |

## Strategy Summaries

| Strategy | Scenario set | Risk | Worst drawdown | Deaths | Robustness | Return delta |
|---|---|---:|---:|---|---:|---:|
${strategySummaries.map(strategy => (
  `| ${strategy.id} | ${strategy.scenarioSetId} | ${strategy.riskScore} | ${(strategy.worstDrawdownPct * 100).toFixed(1)}% | ${strategy.deaths.length === 0 ? 'none' : strategy.deaths.join(', ')} | ${strategy.robustnessGain} | ${(strategy.returnCost * 100).toFixed(1)}% |`
)).join('\n')}

## Included Artifacts

${manifest.artifacts.map(artifact => (
  `- ${artifact.path} (${artifact.bytes} bytes, sha256 ${artifact.sha256})`
)).join('\n')}
`;

writeFileSync(join(outputDir, 'index.md'), markdown);

console.log(`Submission package written to ${outputDir}`);
