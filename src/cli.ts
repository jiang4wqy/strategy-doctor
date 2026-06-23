import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BitgetBacktester } from './backtest/bitget.ts';
import { MockBacktester } from './backtest/mock.ts';
import type { BacktestAdapter } from './contracts.ts';
import { diagnoseStrategy } from './application/diagnose.ts';
import { createAnthropicNarrator } from './redteam/narrate.ts';
import { renderScorecard } from './report/render.ts';
import { parseStrategy } from './strategy/parse.ts';
import { parseCliArgs, type BacktestMode } from './cli/args.ts';

const HELP = `Strategy Doctor

Usage:
  node src/cli.ts <strategy.json> [options]

Options:
  --style conservative|aggressive|trend  Prescription profile (default: conservative)
  --seed <integer>                      Treatment seed (default: 42)
  --candidates <1-50>                   Candidates per dimension (default: 6)
 --backtest mock|bitget                Backtest source (default: mock)
  --format markdown|json                Output format (default: markdown)
  --output <path>                       Write the report to a file
  --trace                               Emit stage-by-stage diagnosis traces to stderr
  --help                                Show this help
`;

function backtester(mode: BacktestMode): BacktestAdapter {
  return mode === 'bitget'
    ? new BitgetBacktester()
    : new MockBacktester();
}

export async function runCli(args: string[]): Promise<void> {
  const options = parseCliArgs(args);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }

  const strategy = parseStrategy(
    JSON.parse(readFileSync(options.strategyPath!, 'utf8')),
  );
  const adapter = backtester(options.backtest);
  const onTrace = options.trace
    ? (entry: string) => {
      process.stderr.write(`${entry}\n`);
    }
    : undefined;
  const { scorecard } = await diagnoseStrategy({
    strategy,
    style: options.style,
    seed: options.seed,
    candidates: options.candidates,
  }, {
    backtest: adapter,
    narrator: createAnthropicNarrator(),
    onTrace,
  });
  const report = options.format === 'json'
    ? JSON.stringify(scorecard, null, 2)
    : renderScorecard(scorecard, strategy);

  if (options.outputPath) {
    writeFileSync(options.outputPath, `${report}\n`, 'utf8');
    process.stdout.write(`Strategy Doctor report written to ${options.outputPath}\n`);
  } else {
    process.stdout.write(`${report}\n`);
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Strategy Doctor failed: ${message}`);
    process.exitCode = 1;
  });
}
