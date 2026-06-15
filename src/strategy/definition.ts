import type {
  StrategyArchetype,
  StrategyDefinition,
} from '../contracts.ts';

export function freezeStrategyDefinition<A extends StrategyArchetype>(
  definition: StrategyDefinition<A>,
): StrategyDefinition<A> {
  const parameters = Object.freeze(
    definition.parameters.map(parameter => Object.freeze({ ...parameter })),
  );
  const example = Object.freeze({
    ...definition.example,
    params: Object.freeze({ ...definition.example.params }),
    universe: Object.freeze([...definition.example.universe]),
  });

  return Object.freeze({
    ...definition,
    parameters,
    example,
  }) as StrategyDefinition<A>;
}
