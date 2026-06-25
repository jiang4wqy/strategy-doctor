import type {
  AnyStrategyDefinition,
  ApiCallTelemetry,
  ApiEnvelope,
  ApiErrorEnvelope,
  DiagnoseRequest,
  DiagnosisView,
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
  OnChainDashboardView,
  PaperSandboxCreateResponse,
  PaperSandboxListView,
  PaperSignalRequest,
  PaperSignalView,
  PaperSandboxSessionView,
  PaperSandboxStatus,
  PlaybookDiagnosisView,
  StrategyDraft,
} from '../platform/contracts.ts';
import type { StyleName } from '../contracts.ts';
import { StrategyDoctorApiError } from './error.ts';

export { StrategyDoctorApiError } from './error.ts';
export type * from './types.ts';

export interface StrategyDoctorOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StrategyDoctorClient {
  capabilities(
    options?: RequestOptions,
  ): Promise<readonly AnyStrategyDefinition[]>;
  parseStrategy(
    input: { description: string },
    options?: RequestOptions,
  ): Promise<StrategyDraft>;
  diagnose(
    input: DiagnoseRequest,
    options?: RequestOptions,
  ): Promise<DiagnosisView>;
  diagnosePlaybook(
    input: {
      playbook: unknown;
      style?: StyleName;
      seed?: number;
      candidates?: number;
    },
    options?: RequestOptions,
  ): Promise<PlaybookDiagnosisView>;
  factors(options?: RequestOptions): Promise<FactorLibraryView>;
  notebooks(options?: RequestOptions): Promise<NotebookCatalogView>;
  multiFactorFramework(
    options?: RequestOptions,
  ): Promise<MultiFactorFrameworkView>;
  paperSignal(
    input: PaperSignalRequest,
    options?: RequestOptions,
  ): Promise<PaperSignalView>;
  apiCallMonitor(
    limit?: number,
    options?: RequestOptions,
  ): Promise<ApiCallTelemetry>;
  createPaperSandbox(
    input: {
      strategy: DiagnoseRequest['strategy'];
      prices?: number[];
      maxBars?: number;
    },
    options?: RequestOptions,
  ): Promise<PaperSandboxCreateResponse>;
  listPaperSandboxes(options?: RequestOptions): Promise<PaperSandboxListView>;
  getPaperSandbox(
    sessionId: string,
    options?: RequestOptions,
  ): Promise<PaperSandboxSessionView>;
  stepPaperSandbox(
    sessionId: string,
    body: { steps?: number },
    options?: RequestOptions,
  ): Promise<PaperSandboxSessionView>;
  closePaperSandbox(
    sessionId: string,
    options?: RequestOptions,
  ): Promise<PaperSandboxStatus>;
  onChainDashboard(
    input: { symbol: string; timeframe: string },
    options?: RequestOptions,
  ): Promise<OnChainDashboardView>;
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('base URL must be a valid HTTP(S) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('base URL must use HTTP or HTTPS');
  }
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/+$/, '');
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function errorEnvelope(value: unknown): ApiErrorEnvelope | undefined {
  const envelope = object(value);
  const error = object(envelope?.error);
  if (
    envelope?.apiVersion !== 'v1'
    || typeof envelope.requestId !== 'string'
    || !error
    || typeof error.code !== 'string'
    || typeof error.message !== 'string'
    || typeof error.retryable !== 'boolean'
  ) {
    return undefined;
  }
  return value as ApiErrorEnvelope;
}

function successEnvelope<T>(value: unknown): ApiEnvelope<T> | undefined {
  const envelope = object(value);
  if (
    envelope?.apiVersion !== 'v1'
    || typeof envelope.requestId !== 'string'
    || !Object.hasOwn(envelope, 'data')
  ) {
    return undefined;
  }
  return value as ApiEnvelope<T>;
}

export function createStrategyDoctor(
  options: StrategyDoctorOptions,
): StrategyDoctorClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  if (options.apiKey.trim() === '') {
    throw new Error('API key must be a non-empty string');
  }
  const fetchImplementation = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body: unknown,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const response = await fetchImplementation(
      `${baseUrl}/api/v1${path}`,
      {
        method,
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          ...(method === 'POST'
            ? { 'content-type': 'application/json' }
            : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
        signal: requestOptions.signal,
      },
    );

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw StrategyDoctorApiError.invalidResponse(response.status);
    }
    if (!response.ok) {
      const envelope = errorEnvelope(payload);
      if (!envelope) {
        throw StrategyDoctorApiError.invalidResponse(response.status);
      }
      throw StrategyDoctorApiError.fromEnvelope(response.status, envelope);
    }
    const envelope = successEnvelope<T>(payload);
    if (!envelope) {
      throw StrategyDoctorApiError.invalidResponse(response.status);
    }
    return envelope.data;
  }

  return Object.freeze({
    capabilities(requestOptions?: RequestOptions) {
      return request<readonly AnyStrategyDefinition[]>(
        '/capabilities',
        'GET',
        undefined,
        requestOptions,
      );
    },
    parseStrategy(
      input: { description: string },
      requestOptions?: RequestOptions,
    ) {
      return request<StrategyDraft>(
        '/strategies/parse',
        'POST',
        input,
        requestOptions,
      );
    },
    diagnose(input: DiagnoseRequest, requestOptions?: RequestOptions) {
      return request<DiagnosisView>(
        '/diagnoses',
        'POST',
        input,
        requestOptions,
      );
    },
    diagnosePlaybook(
      input: {
        playbook: unknown;
        style?: StyleName;
        seed?: number;
        candidates?: number;
      },
      requestOptions?: RequestOptions,
    ) {
      return request<PlaybookDiagnosisView>(
        '/playbook/diagnoses',
        'POST',
        input,
        requestOptions,
      );
    },
    factors(requestOptions?: RequestOptions) {
      return request<FactorLibraryView>(
        '/factors',
        'GET',
        undefined,
        requestOptions,
      );
    },
    notebooks(requestOptions?: RequestOptions) {
      return request<NotebookCatalogView>(
        '/notebooks',
        'GET',
        undefined,
        requestOptions,
      );
    },
    multiFactorFramework(requestOptions?: RequestOptions) {
      return request<MultiFactorFrameworkView>(
        '/multi-factor-framework',
        'GET',
        undefined,
        requestOptions,
      );
    },
    paperSignal(input: PaperSignalRequest, requestOptions?: RequestOptions) {
      return request<PaperSignalView>(
        '/paper/signals',
        'POST',
        input,
        requestOptions,
      );
    },
    apiCallMonitor(limit?: number, requestOptions?: RequestOptions) {
      const query = limit === undefined ? '' : `?limit=${encodeURIComponent(
        String(limit),
      )}`;
      return request<ApiCallTelemetry>(
        `/monitor/api-calls${query}`,
        'GET',
        undefined,
        requestOptions,
      );
    },
    createPaperSandbox(
      input: {
        strategy: DiagnoseRequest['strategy'];
        prices?: number[];
        maxBars?: number;
      },
      requestOptions?: RequestOptions,
    ) {
      return request<PaperSandboxCreateResponse>(
        '/paper/sandbox',
        'POST',
        input,
        requestOptions,
      );
    },
    listPaperSandboxes(requestOptions?: RequestOptions) {
      return request<PaperSandboxListView>(
        '/paper/sandbox',
        'GET',
        undefined,
        requestOptions,
      );
    },
    getPaperSandbox(sessionId: string, requestOptions?: RequestOptions) {
      return request<PaperSandboxSessionView>(
        `/paper/sandbox/${encodeURIComponent(sessionId)}`,
        'GET',
        undefined,
        requestOptions,
      );
    },
    stepPaperSandbox(
      sessionId: string,
      body: { steps?: number },
      requestOptions?: RequestOptions,
    ) {
      return request<PaperSandboxSessionView>(
        `/paper/sandbox/${encodeURIComponent(sessionId)}/step`,
        'POST',
        body,
        requestOptions,
      );
    },
    closePaperSandbox(sessionId: string, requestOptions?: RequestOptions) {
      return request<PaperSandboxStatus>(
        `/paper/sandbox/${encodeURIComponent(sessionId)}`,
        'DELETE',
        undefined,
        requestOptions,
      );
    },
    onChainDashboard(
      input: { symbol: string; timeframe: string },
      requestOptions?: RequestOptions,
    ) {
      const query = new URLSearchParams({
        symbol: input.symbol.toUpperCase(),
        timeframe: input.timeframe,
      }).toString();
      return request<OnChainDashboardView>(
        `/onchain/dashboard?${query}`,
        'GET',
        undefined,
        requestOptions,
      );
    },
  });
}
