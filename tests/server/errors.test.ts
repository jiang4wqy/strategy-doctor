import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StrategyValidationError } from '../../src/contracts.ts';
import {
  ApiRequestError,
  ServerBusyError,
  toApiError,
} from '../../src/server/errors.ts';
import { fail, ok } from '../../src/server/envelope.ts';

test('toApiError preserves stable strategy validation details', () => {
  const mapped = toApiError(new StrategyValidationError(
    'MULTI_SYMBOL_UNSUPPORTED',
    'exactly one symbol is required',
    'strategy.universe',
  ));

  assert.deepEqual(mapped, {
    statusCode: 400,
    error: {
      code: 'MULTI_SYMBOL_UNSUPPORTED',
      message: 'exactly one symbol is required',
      field: 'strategy.universe',
      retryable: false,
    },
  });
});

test('toApiError maps explicit request and capacity failures', () => {
  assert.deepEqual(toApiError(new ApiRequestError(
    422,
    'UNSUPPORTED_STRATEGY_DESCRIPTION',
    'Only registered strategies are supported.',
    'description',
  )), {
    statusCode: 422,
    error: {
      code: 'UNSUPPORTED_STRATEGY_DESCRIPTION',
      message: 'Only registered strategies are supported.',
      field: 'description',
      retryable: false,
    },
  });
  assert.deepEqual(toApiError(new ServerBusyError()), {
    statusCode: 503,
    error: {
      code: 'SERVER_BUSY',
      message: 'The diagnosis service is at capacity.',
      retryable: true,
    },
  });
});

test('toApiError hides unknown internal details', () => {
  const mapped = toApiError(new Error('private stack detail'));

  assert.deepEqual(mapped, {
    statusCode: 500,
    error: {
      code: 'DIAGNOSIS_FAILED',
      message: 'Diagnosis failed.',
      retryable: false,
    },
  });
});

test('envelope helpers preserve API version and request ID', () => {
  assert.deepEqual(ok('req_ok', { healthy: true }), {
    apiVersion: 'v1',
    requestId: 'req_ok',
    data: { healthy: true },
  });
  assert.deepEqual(fail('req_fail', {
    code: 'INVALID_REQUEST',
    message: 'Invalid request.',
    retryable: false,
  }), {
    apiVersion: 'v1',
    requestId: 'req_fail',
    error: {
      code: 'INVALID_REQUEST',
      message: 'Invalid request.',
      retryable: false,
    },
  });
});
