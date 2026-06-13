import type { MaCrossParams, MaCrossStrategy } from '../contracts.ts';

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

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${field} must be a finite number`);
  }
  return value;
}

function parseParams(value: unknown): MaCrossParams {
  const params = object(value, 'params');
  const fastMA = finiteNumber(params.fastMA, 'params.fastMA');
  const slowMA = finiteNumber(params.slowMA, 'params.slowMA');
  const leverage = finiteNumber(params.leverage, 'params.leverage');
  const stopLossPct = finiteNumber(params.stopLossPct, 'params.stopLossPct');
  const positionPct = finiteNumber(params.positionPct, 'params.positionPct');

  if (!Number.isInteger(fastMA) || fastMA < 2) {
    fail('params.fastMA must be an integer greater than or equal to 2');
  }
  if (!Number.isInteger(slowMA) || slowMA <= fastMA) {
    fail('params.slowMA must be an integer greater than params.fastMA');
  }
  if (leverage < 1) {
    fail('params.leverage must be greater than or equal to 1');
  }
  if (stopLossPct <= 0 || stopLossPct > 0.99) {
    fail('params.stopLossPct must be in (0, 0.99]');
  }
  if (positionPct <= 0 || positionPct > 1) {
    fail('params.positionPct must be in (0, 1]');
  }

  return { fastMA, slowMA, leverage, stopLossPct, positionPct };
}

export function parseStrategy(value: unknown): MaCrossStrategy {
  const strategy = object(value, 'strategy');
  if (strategy.archetype !== 'ma-cross') {
    fail('archetype must be ma-cross');
  }
  if (
    !Array.isArray(strategy.universe)
    || strategy.universe.length === 0
    || strategy.universe.some(
      symbol => typeof symbol !== 'string' || symbol.trim() === '',
    )
  ) {
    fail('universe must contain non-empty symbols');
  }

  return {
    id: nonEmptyString(strategy.id, 'id'),
    name: nonEmptyString(strategy.name, 'name'),
    archetype: strategy.archetype,
    params: parseParams(strategy.params),
    universe: [...strategy.universe],
    timeframe: nonEmptyString(strategy.timeframe, 'timeframe'),
  };
}
