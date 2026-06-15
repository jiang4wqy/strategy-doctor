import type { StrategyDefinition } from '../src/contracts.ts';

type MaParameter =
  StrategyDefinition<'ma-cross'>['parameters'][number];

const invalidMaParameter: MaParameter = {
  // @ts-expect-error MA capability metadata cannot declare RSI parameters.
  key: 'rsiPeriod',
  label: 'RSI period',
  description: 'Invalid cross-strategy metadata.',
  kind: 'integer',
  minimum: 2,
  defaultValue: 14,
};

void invalidMaParameter;
