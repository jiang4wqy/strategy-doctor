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
  OnChainDashboardView,
  PaperSignalRequest,
  PaperSignalView,
  PaperSandboxRequest,
  PaperSandboxListView,
  PaperSandboxSessionView,
  StrategyDraft,
} from '../platform/contracts.ts';
import {
  getFactorLibrary,
  getMultiFactorFramework,
  getNotebookCatalog,
} from '../research/factor-library.ts';
import type { ApiCallMonitorService } from '../research/api-monitor.ts';
import { createApiCallMonitorService } from '../research/api-monitor.ts';
import { trackPaperSignal } from '../research/paper-signal.ts';
import { createPaperSandboxService } from '../research/paper-sandbox.ts';
import { createOnChainDashboardService } from '../research/onchain-dashboard.ts';
import { strategyRegistry } from '../strategy/registry.ts';

export interface ServerServices {
  capabilities(): readonly AnyStrategyDefinition[];
  parse(description: string): Promise<StrategyDraft>;
  diagnose(request: DiagnoseRequest): Promise<DiagnosisResult>;
  factors(): FactorLibraryView;
  notebooks(): NotebookCatalogView;
  multiFactorFramework(): MultiFactorFrameworkView;
  paperSignal(request: PaperSignalRequest): PaperSignalView;
  apiCallMonitor(): import('../platform/contracts.ts').ApiCallTelemetry;
  apiCallMonitorService: ApiCallMonitorService;
  paperSandbox: PaperSandboxService;
  onChainDashboard(request: { symbol: string; timeframe: string }): OnChainDashboardView;
}

export interface PaperSandboxService {
  createSession(request: PaperSandboxRequest): PaperSandboxSessionView;
  listSessions(): PaperSandboxListView;
  getSession(sessionId: string): PaperSandboxSessionView;
  stepSession(
    sessionId: string,
    request: { steps?: number },
  ): PaperSandboxSessionView;
  closeSession(sessionId: string): { id: string; status: 'ended' | 'removed' };
}

export function createDefaultServices(): ServerServices {
  const apiCallMonitor = createApiCallMonitorService();
  const paperSandbox = createPaperSandboxService();
  const onChainDashboard = createOnChainDashboardService();
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
    apiCallMonitor: () => apiCallMonitor.getSnapshot(),
    apiCallMonitorService: apiCallMonitor,
    paperSandbox: {
      createSession: request => paperSandbox.createSession(request),
      listSessions: () => paperSandbox.listSessions(),
      getSession: request => paperSandbox.getSession(request),
      stepSession: (sessionId, request) => paperSandbox.stepSession(
        sessionId,
        request,
      ),
      closeSession: sessionId => paperSandbox.closeSession(sessionId),
    },
    onChainDashboard: request => onChainDashboard.getDashboard({
      symbol: request.symbol,
      timeframe: request.timeframe,
    }),
  };
}
