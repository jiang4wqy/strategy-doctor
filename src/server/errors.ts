import {
  StrategyValidationError,
} from '../contracts.ts';
import {
  DescriptionParseError,
} from '../natural-language/errors.ts';
import type {
  ApiError,
  ApiErrorCode,
} from '../platform/contracts.ts';

export interface MappedApiError {
  statusCode: number;
  error: ApiError;
}

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly field?: string;
  readonly retryable: boolean;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    field?: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
    this.retryable = retryable;
  }
}

export class ServerBusyError extends ApiRequestError {
  constructor() {
    super(
      503,
      'SERVER_BUSY',
      'The diagnosis service is at capacity.',
      undefined,
      true,
    );
    this.name = 'ServerBusyError';
  }
}

function validationStatus(error: StrategyValidationError): number {
  return error.code === 'UNSUPPORTED_ARCHETYPE' ? 422 : 400;
}

export function toApiError(error: unknown): MappedApiError {
  if (error instanceof ApiRequestError) {
    return {
      statusCode: error.statusCode,
      error: {
        code: error.code,
        message: error.message,
        ...(error.field ? { field: error.field } : {}),
        retryable: error.retryable,
      },
    };
  }
  if (error instanceof StrategyValidationError) {
    return {
      statusCode: validationStatus(error),
      error: {
        code: error.code,
        message: error.message.replace(/^invalid strategy:\s*/i, ''),
        ...(error.field ? { field: error.field } : {}),
        retryable: false,
      },
    };
  }
  if (error instanceof DescriptionParseError) {
    return {
      statusCode: error.code === 'AMBIGUOUS_DESCRIPTION' ? 400 : 422,
      error: {
        code: error.code,
        message: error.message,
        retryable: false,
      },
    };
  }
  return {
    statusCode: 500,
    error: {
      code: 'DIAGNOSIS_FAILED',
      message: 'Diagnosis failed.',
      retryable: false,
    },
  };
}
