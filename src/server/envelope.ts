import type {
  ApiEnvelope,
  ApiError,
  ApiErrorEnvelope,
} from '../platform/contracts.ts';

export function ok<T>(
  requestId: string,
  data: T,
): ApiEnvelope<T> {
  return {
    apiVersion: 'v1',
    requestId,
    data,
  };
}

export function fail(
  requestId: string,
  error: ApiError,
): ApiErrorEnvelope {
  return {
    apiVersion: 'v1',
    requestId,
    error,
  };
}
