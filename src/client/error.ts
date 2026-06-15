import type { ApiErrorEnvelope } from '../platform/contracts.ts';

export class StrategyDoctorApiError extends Error {
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
    this.name = 'StrategyDoctorApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.field = field;
    this.retryable = retryable;
  }

  static fromEnvelope(
    status: number,
    envelope: ApiErrorEnvelope,
  ): StrategyDoctorApiError {
    return new StrategyDoctorApiError(
      status,
      envelope.error.code,
      envelope.error.message,
      envelope.requestId,
      envelope.error.field,
      envelope.error.retryable,
    );
  }

  static invalidResponse(status: number): StrategyDoctorApiError {
    return new StrategyDoctorApiError(
      status,
      'INVALID_RESPONSE',
      'Strategy Doctor returned an invalid response.',
    );
  }
}
