import type {
  BacktestAdapter,
  MaCrossParams,
  MaCrossStrategy,
  Metrics,
  Scenario,
  Strategy,
} from '../contracts.ts';
import { maCrossAdapter } from '../strategy/adapters/ma-cross.ts';
import {
  getStrategyAdapter,
  type AnyStrategyAdapter,
} from '../strategy/registry.ts';
import { runStrategyOnPrices } from './engine.ts';
import { generatePath } from './path.ts';

export function runOnPrices(params: MaCrossParams, prices: number[]): Metrics {
  const strategy: MaCrossStrategy = {
    id: 'ma-cross-compatibility',
    name: 'MA cross compatibility wrapper',
    archetype: 'ma-cross',
    params,
    universe: [],
    timeframe: '',
  };
  return runStrategyOnPrices(strategy, prices, maCrossAdapter);
}

export class MockBacktester implements BacktestAdapter {
  async run(strategy: Strategy, scenario: Scenario): Promise<Metrics> {
    const adapter = getStrategyAdapter(
      strategy.archetype,
    ) as AnyStrategyAdapter;
    return runStrategyOnPrices(
      strategy,
      generatePath(scenario.shock),
      adapter,
    );
  }
}
