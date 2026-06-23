import { diagnoseStrategy } from '../application/diagnose.ts';
import { BitgetBacktester } from '../backtest/bitget.ts';
import type { AnyStrategyDefinition } from '../contracts.ts';
import {
  parseStrategyDescription,
} from '../natural-language/parse.ts';
import type {
  DiagnoseRequest,
  DiagnosisResult,
  StrategyDraft,
} from '../platform/contracts.ts';
import { strategyRegistry } from '../strategy/registry.ts';

export interface ServerServices {
  capabilities(): readonly AnyStrategyDefinition[];
  parse(description: string): Promise<StrategyDraft>;
  diagnose(request: DiagnoseRequest): Promise<DiagnosisResult>;
}

export function createDefaultServices(): ServerServices {
  return {
    capabilities: () => strategyRegistry.listDefinitions(),
    parse: description => parseStrategyDescription(description),
    diagnose: request => request.strategy.backtest?.source === 'bitget-public'
      ? diagnoseStrategy(request, { backtest: new BitgetBacktester() })
      : diagnoseStrategy(request),
  };
}
