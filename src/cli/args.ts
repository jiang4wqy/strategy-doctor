import type { StyleName } from '../contracts.ts';

export type BacktestMode = 'mock' | 'bitget';
export type OutputFormat = 'markdown' | 'json';

export interface CliOptions {
  strategyPath?: string;
  style: StyleName;
  seed: number;
  candidates: number;
  backtest: BacktestMode;
  format: OutputFormat;
  outputPath?: string;
  help: boolean;
  trace: boolean;
}

const STYLE_NAMES = new Set<StyleName>([
  'conservative',
  'aggressive',
  'trend',
]);
const BACKTEST_MODES = new Set<BacktestMode>(['mock', 'bitget']);
const OUTPUT_FORMATS = new Set<OutputFormat>(['markdown', 'json']);

function valueAfter(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`argument ${flag} requires a value`);
  }
  return value;
}

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    style: 'conservative',
    seed: 42,
    candidates: 6,
    backtest: 'mock',
    format: 'markdown',
    help: false,
    trace: false,
  };
  if (args.includes('--help')) {
    options.help = true;
    return options;
  }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument.startsWith('--')) {
      if (options.strategyPath) {
        throw new Error(`unexpected strategy argument: ${argument}`);
      }
      options.strategyPath = argument;
      continue;
    }

    if (argument === '--trace') {
      options.trace = true;
      continue;
    }

    const value = valueAfter(args, index, argument);
    index++;
    switch (argument) {
      case '--style':
        if (!STYLE_NAMES.has(value as StyleName)) {
          throw new Error(`unknown style: ${value}`);
        }
        options.style = value as StyleName;
        break;
      case '--seed': {
        const seed = Number(value);
        if (!Number.isSafeInteger(seed)) {
          throw new Error(`seed must be a safe integer: ${value}`);
        }
        options.seed = seed;
        break;
      }
      case '--candidates': {
        const candidates = Number(value);
        if (!Number.isInteger(candidates) || candidates < 1 || candidates > 50) {
          throw new Error('candidate count must be an integer from 1 to 50');
        }
        options.candidates = candidates;
        break;
      }
      case '--backtest':
        if (!BACKTEST_MODES.has(value as BacktestMode)) {
          throw new Error(`unknown backtest mode: ${value}`);
        }
        options.backtest = value as BacktestMode;
        break;
      case '--format':
        if (!OUTPUT_FORMATS.has(value as OutputFormat)) {
          throw new Error(`unknown output format: ${value}`);
        }
        options.format = value as OutputFormat;
        break;
      case '--output':
        options.outputPath = value;
        break;
      default:
        throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (!options.strategyPath) {
    throw new Error('strategy argument is required');
  }
  if (!Number.isSafeInteger(options.seed + 100_000)) {
    throw new Error('held-out seed exceeds the safe integer range');
  }
  return options;
}
