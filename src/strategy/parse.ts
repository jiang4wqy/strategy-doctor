import type {
  Strategy,
  StrategyArchetype,
  StrategyBase,
} from '../contracts.ts';
import {
  StrategyValidationError,
  type StrategyValidationCode,
} from '../contracts.ts';
import { strategyRegistry } from './registry.ts';

function fail(
  message: string,
  code: StrategyValidationCode = 'INVALID_REQUEST',
  field?: string,
): never {
  throw new StrategyValidationError(code, message, field);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${field} must be a non-empty string`);
  }
  return value;
}

function parseArchetype(value: unknown): StrategyArchetype {
  if (
    value !== 'ma-cross'
    && value !== 'rsi-bollinger-mean-reversion'
    && value !== 'breakout-confirmation'
  ) {
    fail(
      `unsupported strategy archetype: ${String(value)}`,
      'UNSUPPORTED_ARCHETYPE',
      'strategy.archetype',
    );
  }
  return value;
}

export function parseStrategy(value: unknown): Strategy {
  const strategy = object(value, 'strategy');
  const archetype = parseArchetype(strategy.archetype);
  if (!Array.isArray(strategy.universe) || strategy.universe.length === 0) {
    fail(
      'universe must contain exactly one symbol',
      'INVALID_REQUEST',
      'strategy.universe',
    );
  }
  if (strategy.universe.length > 1) {
    fail(
      'exactly one symbol is supported',
      'MULTI_SYMBOL_UNSUPPORTED',
      'strategy.universe',
    );
  }
  const rawSymbol = strategy.universe[0];
  if (typeof rawSymbol !== 'string' || rawSymbol.trim() === '') {
    fail(
      'universe must contain a non-empty symbol',
      'INVALID_REQUEST',
      'strategy.universe.0',
    );
  }
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol.endsWith('USDT')) {
    fail(
      'symbol must end in USDT',
      'UNSUPPORTED_SYMBOL',
      'strategy.universe.0',
    );
  }
  const timeframe = nonEmptyString(
    strategy.timeframe,
    'timeframe',
  ).trim().toLowerCase();
  if (!['1h', '4h', '1d'].includes(timeframe)) {
    fail(
      'timeframe must be one of 1h, 4h, or 1d',
      'UNSUPPORTED_TIMEFRAME',
      'strategy.timeframe',
    );
  }

  const base: StrategyBase = {
    id: nonEmptyString(strategy.id, 'id'),
    name: nonEmptyString(strategy.name, 'name'),
    universe: [symbol],
    timeframe,
  };

  try {
    return strategyRegistry.parse(archetype, base, strategy.params);
  } catch (error) {
    if (error instanceof StrategyValidationError) {
      throw error;
    }
    throw error;
  }
}
