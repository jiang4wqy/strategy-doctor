import type {
  StrategyAdapter,
  StrategyArchetype,
  StrategyBase,
  StrategyByArchetype,
} from '../contracts.ts';
import { maCrossAdapter } from './adapters/ma-cross.ts';

export type AnyStrategyAdapter = {
  [A in StrategyArchetype]: StrategyAdapter<A>;
}[StrategyArchetype];

export interface StrategyRegistry {
  get<A extends StrategyArchetype>(archetype: A): StrategyAdapter<A>;
  parse<A extends StrategyArchetype>(
    archetype: A,
    base: StrategyBase,
    value: unknown,
  ): StrategyByArchetype<A>;
}

export function createStrategyRegistry(
  registered: readonly AnyStrategyAdapter[],
): StrategyRegistry {
  const adapters = new Map<StrategyArchetype, AnyStrategyAdapter>();
  for (const adapter of registered) {
    if (adapters.has(adapter.archetype)) {
      throw new Error(`duplicate strategy archetype: ${adapter.archetype}`);
    }
    adapters.set(adapter.archetype, adapter);
  }

  const registry: StrategyRegistry = {
    get<A extends StrategyArchetype>(
      archetype: A,
    ): StrategyAdapter<A> {
      const adapter = adapters.get(archetype);
      if (!adapter) {
        throw new Error(`unsupported strategy archetype: ${archetype}`);
      }
      return adapter as StrategyAdapter<A>;
    },
    parse<A extends StrategyArchetype>(
      archetype: A,
      base: StrategyBase,
      value: unknown,
    ): StrategyByArchetype<A> {
      const adapter = registry.get(archetype);
      return {
        ...base,
        archetype,
        params: adapter.parseParams(value),
      };
    },
  };
  return Object.freeze(registry);
}

export const strategyRegistry = createStrategyRegistry([maCrossAdapter]);

export function getStrategyAdapter<A extends StrategyArchetype>(
  archetype: A,
): StrategyAdapter<A> {
  return strategyRegistry.get(archetype);
}
