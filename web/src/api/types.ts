import type {
  AnyStrategyDefinition,
  ApiEnvelope,
  DiagnoseRequest,
  DiagnosisView,
  StoredDiagnosis,
  StrategyDraft,
} from '../../../src/platform/contracts.ts';

export type {
  AnyStrategyDefinition,
  ApiEnvelope,
  DiagnoseRequest,
  DiagnosisView,
  StoredDiagnosis,
  StrategyDraft,
};

export interface ApiClient {
  login(accessCode: string): Promise<void>;
  logout(): Promise<void>;
  capabilities(): Promise<ApiEnvelope<readonly AnyStrategyDefinition[]>>;
  parse(description: string): Promise<ApiEnvelope<StrategyDraft>>;
  diagnose(request: DiagnoseRequest): Promise<ApiEnvelope<DiagnosisView>>;
}
