import type {
  StrategyArchetype,
  StrategyByArchetype,
} from '../contracts.ts';
import { parseStrategy } from '../strategy/parse.ts';
import { strategyRegistry } from '../strategy/registry.ts';

export interface DraftMarket {
  symbol?: string;
  timeframe?: string;
}

export function buildDefaultStrategy<A extends StrategyArchetype>(
  archetype: A,
  market: DraftMarket = {},
): StrategyByArchetype<A> {
  const definition = strategyRegistry.getDefinition(archetype);
  const params = Object.fromEntries(
    definition.parameters.map(parameter => [
      parameter.key,
      parameter.defaultValue,
    ]),
  );

  return parseStrategy({
    id: `natural-${archetype}`,
    name: definition.example.name,
    archetype,
    params,
    universe: [market.symbol ?? 'BTCUSDT'],
    timeframe: market.timeframe ?? '4h',
  }) as StrategyByArchetype<A>;
}
