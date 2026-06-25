import type {
  ApiClient,
  ApiEnvelope,
  DiagnoseRequest,
  DiagnosisView,
  StrategyDraft,
  AnyStrategyDefinition,
} from './types.ts';

export class StrategyDoctorWebError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly field?: string;
  readonly retryable: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    field?: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'StrategyDoctorWebError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.field = field;
    this.retryable = retryable;
  }
}

export interface CreateApiClientOptions {
  fetch?: typeof globalThis.fetch;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
  };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

const DEFAULT_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 3000,
  factor: 2,
} as const;

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

function parseRetryAfterDelay(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }
  const trimmed = header.trim();
  if (!trimmed) {
    return undefined;
  }
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }
  return undefined;
}

function buildRetryDelay(
  attempt: number,
  options: {
    baseDelayMs: number;
    maxDelayMs: number;
    factor: number;
  },
  retryAfterMs: number | undefined,
): number {
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, options.maxDelayMs);
  }
  const exponential = options.baseDelayMs * Math.pow(options.factor, attempt - 1);
  const jitter = Math.random() * 200;
  return Math.min(exponential + jitter, options.maxDelayMs);
}

export function createApiClient(
  options: CreateApiClientOptions = {},
): ApiClient {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const retry = {
    ...DEFAULT_RETRY,
    ...options.retry,
  };

  async function request<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: unknown,
  ): Promise<ApiEnvelope<T>> {
    let attempt = 0;
    while (true) {
      const response = await fetchImplementation(`/api/v1${path}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined
          ? undefined
          : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new StrategyDoctorWebError(
          response.status,
          'INVALID_RESPONSE',
          'Strategy Doctor returned an invalid response.',
        );
      }

      const envelope = object(payload);
      if (!response.ok) {
        const error = object(envelope?.error);
        if (
          response.status === 429
          && ++attempt < retry.maxAttempts
          && error?.retryable === true
        ) {
          const delayMs = buildRetryDelay(
            attempt,
            retry,
            parseRetryAfterDelay(response.headers.get('retry-after')),
          );
          await sleep(delayMs);
          continue;
        }
        if (
          !envelope
          || typeof envelope.requestId !== 'string'
          || !error
          || typeof error.code !== 'string'
          || typeof error.message !== 'string'
        ) {
          throw new StrategyDoctorWebError(
            response.status,
            'INVALID_RESPONSE',
            'Strategy Doctor returned an invalid response.',
          );
        }
        throw new StrategyDoctorWebError(
          response.status,
          error.code,
          error.message,
          envelope.requestId,
          typeof error.field === 'string' ? error.field : undefined,
          error.retryable === true,
        );
      }
      if (
        envelope?.apiVersion !== 'v1'
        || typeof envelope.requestId !== 'string'
        || !Object.hasOwn(envelope, 'data')
      ) {
        throw new StrategyDoctorWebError(
          response.status,
          'INVALID_RESPONSE',
          'Strategy Doctor returned an invalid response.',
        );
      }
      return payload as ApiEnvelope<T>;
    }
  }

  return {
    async login(accessCode) {
      await request('/auth', 'POST', { accessCode });
    },
    async logout() {
      await request('/auth', 'DELETE');
    },
    capabilities() {
      return request<readonly AnyStrategyDefinition[]>(
        '/capabilities',
        'GET',
      );
    },
    parse(description) {
      return request<StrategyDraft>(
        '/strategies/parse',
        'POST',
        { description },
      );
    },
    diagnose(input: DiagnoseRequest) {
      return request<DiagnosisView>('/diagnoses', 'POST', input);
    },
  };
}
