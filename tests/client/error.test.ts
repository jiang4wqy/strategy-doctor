import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StrategyDoctorApiError,
} from '../../src/client/error.ts';

test('StrategyDoctorApiError preserves an API error envelope', () => {
  const error = StrategyDoctorApiError.fromEnvelope(429, {
    apiVersion: 'v1',
    requestId: 'req-rate',
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests.',
      retryable: true,
    },
  });

  assert.equal(error.status, 429);
  assert.equal(error.code, 'RATE_LIMITED');
  assert.equal(error.requestId, 'req-rate');
  assert.equal(error.retryable, true);
  assert.equal(error.message, 'Too many requests.');
});

test('StrategyDoctorApiError hides non-JSON upstream response bodies', () => {
  const error = StrategyDoctorApiError.invalidResponse(502);

  assert.equal(error.status, 502);
  assert.equal(error.code, 'INVALID_RESPONSE');
  assert.equal(error.message, 'Strategy Doctor returned an invalid response.');
  assert.doesNotMatch(error.message, /html|upstream|body/i);
});
