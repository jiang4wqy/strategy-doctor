import type {
  Strategy,
  StrategyArchetype,
  StrategyBase,
} from '../contracts.ts';
import { strategyRegistry } from './registry.ts';

function fail(message: string): never {
  throw new Error(`invalid strategy: ${message}`);
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
  ) {
    fail(`unsupported strategy archetype: ${String(value)}`);
  }
  return value;
}

export function parseStrategy(value: unknown): Strategy {
  const strategy = object(value, 'strategy');
  const archetype = parseArchetype(strategy.archetype);
  if (
    !Array.isArray(strategy.universe)
    || strategy.universe.length === 0
    || strategy.universe.some(
      symbol => typeof symbol !== 'string' || symbol.trim() === '',
    )
  ) {
    fail('universe must contain non-empty symbols');
  }

  const base: StrategyBase = {
    id: nonEmptyString(strategy.id, 'id'),
    name: nonEmptyString(strategy.name, 'name'),
    universe: [...strategy.universe],
    timeframe: nonEmptyString(strategy.timeframe, 'timeframe'),
  };

  try {
    return strategyRegistry.parse(archetype, base, strategy.params);
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith('unsupported strategy archetype:')
    ) {
      fail(error.message);
    }
    throw error;
  }
}
