import { describe, expect, it } from 'vitest';
import type {
  AnyStrategyDefinition,
  DiagnoseRequest,
  DiagnosisView,
  StrategyDraft,
} from '../api/types.ts';
import {
  appReducer,
  initialAppState,
} from './app-state.ts';

const capabilities = [] as readonly AnyStrategyDefinition[];
const draft = { strategy: { id: 'draft' } } as StrategyDraft;
const request = { strategy: { id: 'request' } } as DiagnoseRequest;
const view = { summary: { riskScore: 42 } } as DiagnosisView;

describe('appReducer', () => {
  it('moves through the complete diagnosis workflow', () => {
    const describing = appReducer(initialAppState, {
      type: 'authenticated',
      capabilities,
    });
    expect(describing.status).toBe('describing');

    const confirming = appReducer(describing, {
      type: 'parsed',
      description: 'BTC RSI Bollinger',
      draft,
    });
    expect(confirming.status).toBe('confirming');

    const diagnosing = appReducer(confirming, {
      type: 'diagnosisStarted',
      request,
    });
    expect(diagnosing.status).toBe('diagnosing');

    const result = appReducer(diagnosing, {
      type: 'diagnosed',
      requestId: 'req-result',
      view,
    });
    expect(result.status).toBe('result');
  });

  it('keeps the current workflow data when an error occurs', () => {
    const describing = appReducer(initialAppState, {
      type: 'authenticated',
      capabilities,
    });
    const changed = appReducer(describing, {
      type: 'descriptionChanged',
      description: 'keep this text',
    });
    const failed = appReducer(changed, {
      type: 'failed',
      message: 'Unsupported strategy.',
    });

    expect(failed).toMatchObject({
      status: 'describing',
      description: 'keep this text',
      error: 'Unsupported strategy.',
    });
  });
});
