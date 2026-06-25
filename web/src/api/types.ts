import type {
  AnyStrategyDefinition,
  ApiCallTelemetry,
  ApiEnvelope,
  DiagnoseRequest,
  DiagnosisView,
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
  OnChainDashboardView,
  PaperSandboxCreateResponse,
  PaperSandboxListView,
  PaperSandboxSessionView,
  PaperSandboxStatus,
  PaperSignalRequest,
  PaperSignalView,
  StoredDiagnosis,
  StrategyDraft,
} from '../../../src/platform/contracts.ts';

export type {
  AnyStrategyDefinition,
  ApiCallTelemetry,
  ApiEnvelope,
  DiagnoseRequest,
  DiagnosisView,
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
  OnChainDashboardView,
  PaperSandboxCreateResponse,
  PaperSandboxListView,
  PaperSandboxSessionView,
  PaperSandboxStatus,
  PaperSignalRequest,
  PaperSignalView,
  StoredDiagnosis,
  StrategyDraft,
};

export interface ApiClient {
  login(accessCode: string): Promise<void>;
  logout(): Promise<void>;
  capabilities(): Promise<ApiEnvelope<readonly AnyStrategyDefinition[]>>;
  parse(description: string): Promise<ApiEnvelope<StrategyDraft>>;
  diagnose(request: DiagnoseRequest): Promise<ApiEnvelope<DiagnosisView>>;

  factors?: () => Promise<ApiEnvelope<FactorLibraryView>>;
  notebooks?: () => Promise<ApiEnvelope<NotebookCatalogView>>;
  multiFactorFramework?: () => Promise<ApiEnvelope<MultiFactorFrameworkView>>;
  paperSignal?: (input: PaperSignalRequest) => Promise<ApiEnvelope<PaperSignalView>>;

  apiCallMonitor(limit?: number): Promise<ApiEnvelope<ApiCallTelemetry>>;
  createPaperSandbox(input: {
    strategy: DiagnoseRequest['strategy'];
    prices?: number[];
    maxBars?: number;
  }): Promise<ApiEnvelope<PaperSandboxCreateResponse>>;
  listPaperSandboxes(): Promise<ApiEnvelope<PaperSandboxListView>>;
  getPaperSandbox(sessionId: string): Promise<ApiEnvelope<PaperSandboxSessionView>>;
  stepPaperSandbox(
    sessionId: string,
    options?: { steps?: number },
  ): Promise<ApiEnvelope<PaperSandboxSessionView>>;
  closePaperSandbox(sessionId: string): Promise<ApiEnvelope<PaperSandboxStatus>>;
  onChainDashboard(input: {
    symbol: string;
    timeframe: string;
  }): Promise<ApiEnvelope<OnChainDashboardView>>;
}
