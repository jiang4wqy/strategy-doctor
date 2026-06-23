import { diagnoseStrategy } from '../application/diagnose.ts';
import { BitgetBacktester } from '../backtest/bitget.ts';
import type { AnyStrategyDefinition } from '../contracts.ts';
import {
  parseStrategyDescription,
} from '../natural-language/parse.ts';
import type {
  DiagnoseRequest,
  DiagnosisResult,
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
  PaperSignalRequest,
  PaperSignalView,
  StrategyDraft,
} from '../platform/contracts.ts';
import {
  getFactorLibrary,
  getMultiFactorFramework,
  getNotebookCatalog,
} from '../research/factor-library.ts';
import { trackPaperSignal } from '../research/paper-signal.ts';
import { strategyRegistry } from '../strategy/registry.ts';

export interface ServerServices {
  capabilities(): readonly AnyStrategyDefinition[];
  parse(description: string): Promise<StrategyDraft>;
  diagnose(request: DiagnoseRequest): Promise<DiagnosisResult>;
  factors(): FactorLibraryView;
  notebooks(): NotebookCatalogView;
  multiFactorFramework(): MultiFactorFrameworkView;
  paperSignal(request: PaperSignalRequest): PaperSignalView;
}

export function createDefaultServices(): ServerServices {
  return {
    capabilities: () => strategyRegistry.listDefinitions(),
    parse: description => parseStrategyDescription(description),
    diagnose: request => request.strategy.backtest?.source === 'bitget-public'
      ? diagnoseStrategy(request, { backtest: new BitgetBacktester() })
      : diagnoseStrategy(request),
    factors: getFactorLibrary,
    notebooks: getNotebookCatalog,
    multiFactorFramework: getMultiFactorFramework,
    paperSignal: request => trackPaperSignal(request),
  };
}
