import { describe, expect, it } from 'vitest';
import {
  createApiClient,
  StrategyDoctorWebError,
} from './client.ts';

describe('Web API client', () => {
  it('returns common success envelopes with same-origin credentials', async () => {
    let request: RequestInit | undefined;
    const client = createApiClient({
      fetch: async (_input, init) => {
        request = init;
        return new Response(JSON.stringify({
          apiVersion: 'v1',
          requestId: 'req-1',
          data: [],
        }), { status: 200 });
      },
    });

    const response = await client.capabilities();

    expect(response.data).toEqual([]);
    expect(request?.credentials).toBe('same-origin');
  });

  it('throws stable Web errors from API envelopes', async () => {
    const client = createApiClient({
      fetch: async () => new Response(JSON.stringify({
        apiVersion: 'v1',
        requestId: 'req-2',
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests.',
          retryable: true,
        },
      }), { status: 429 }),
    });

    await expect(client.diagnose({} as never)).rejects.toMatchObject({
      constructor: StrategyDoctorWebError,
      code: 'RATE_LIMITED',
      requestId: 'req-2',
      retryable: true,
    });
  });
});
