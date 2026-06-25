import type { FastifyPluginAsync } from 'fastify';
import type {
  ApiCallTelemetry,
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
  OnChainDashboardRequest,
  OnChainDashboardView,
  PaperSandboxCreateResponse,
  PaperSandboxListView,
  PaperSandboxRequest,
  PaperSandboxSessionView,
  PaperSignalRequest,
  PaperSignalView,
} from '../../platform/contracts.ts';
import { ok } from '../envelope.ts';
import {
  requireJsonMutation,
  requireSameOrigin,
} from '../guards.ts';
import { ApiRequestError } from '../errors.ts';

export interface ResearchRouteOptions {
  factors(): FactorLibraryView;
  notebooks(): NotebookCatalogView;
  multiFactorFramework(): MultiFactorFrameworkView;
  paperSignal(request: PaperSignalRequest): PaperSignalView;
  apiCallMonitor(): ApiCallTelemetry;
  paperSandbox: {
    createSession(request: PaperSandboxRequest): PaperSandboxSessionView;
    listSessions(): PaperSandboxListView;
    getSession(sessionId: string): PaperSandboxSessionView;
    stepSession(
      sessionId: string,
      request: { steps?: number },
    ): PaperSandboxSessionView;
    closeSession(sessionId: string): { id: string; status: 'ended' | 'removed' };
  };
  onChainDashboard(request: OnChainDashboardRequest): OnChainDashboardView;
}

function requestObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      'Request body must be an object.',
    );
  }
  return value as Record<string, unknown>;
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      `${field} must be a non-empty string.`,
      field,
    );
  }
  return value.trim();
}

function parseTimeframe(value: unknown): string {
  const timeframe = parseString(value, 'timeframe');
  if (!['1h', '4h', '1d', '12h'].includes(timeframe)) {
    throw new ApiRequestError(
      400,
      'UNSUPPORTED_TIMEFRAME',
      'timeframe must be one of 1h, 4h, 1d, 12h.',
      'timeframe',
    );
  }
  return timeframe;
}

function parseSessionId(params: unknown): string {
  if (
    params === null
    || typeof params !== 'object'
    || !('id' in params)
  ) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      'sessionId must be a non-empty string.',
      'sessionId',
    );
  }
  const rawId = (params as { id?: unknown }).id;
  if (typeof rawId !== 'string' || rawId.trim().length === 0) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      'sessionId must be a non-empty string.',
      'sessionId',
    );
  }
  return rawId;
}

function parseLimit(value: unknown, field: string, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      `${field} must be an integer from 1 to ${max}.`,
      field,
    );
  }
  return parsed;
}

function parseSandboxBody(
  value: unknown,
): { strategy: unknown; prices?: unknown; maxBars?: unknown } {
  const body = requestObject(value);
  if (!('strategy' in body) || body.strategy === undefined || body.strategy === null) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      'paper sandbox requires a strategy.',
      'strategy',
    );
  }
  return {
    strategy: body.strategy,
    prices: body.prices,
    maxBars: body.maxBars,
  };
}

export const registerResearchRoutes:
  FastifyPluginAsync<ResearchRouteOptions> = async (app, options) => {
    app.get('/api/v1/factors', {
      preHandler: app.requireAuth,
    }, async (request, reply) => {
      return reply.send(ok(request.id, options.factors()));
    });

    app.get('/api/v1/notebooks', {
      preHandler: app.requireAuth,
    }, async (request, reply) => {
      return reply.send(ok(request.id, options.notebooks()));
    });

    app.get('/api/v1/multi-factor-framework', {
      preHandler: app.requireAuth,
    }, async (request, reply) => {
      return reply.send(ok(request.id, options.multiFactorFramework()));
    });

    app.post('/api/v1/paper/signals', {
      preHandler: [
        app.requireAuth,
        requireJsonMutation,
        requireSameOrigin,
      ],
    }, async (request, reply) => {
      const body = requestObject(request.body);
      return reply.send(ok(
        request.id,
        options.paperSignal(body as unknown as PaperSignalRequest),
      ));
    });

    app.get('/api/v1/monitor/api-calls', {
      preHandler: [app.requireAuth],
    }, async (request, reply) => {
      const url = new URL(request.url, 'http://localhost');
      const limit = url.searchParams.get('limit');
      const monitor = options.apiCallMonitor();
      const clippedLimit = limit === null ? undefined : parseLimit(limit, 'limit', 500);
      const result = {
        ...monitor,
        topPaths: clippedLimit === undefined
          ? monitor.topPaths
          : monitor.topPaths.slice(0, clippedLimit),
        recent: clippedLimit === undefined
          ? monitor.recent
          : monitor.recent.slice(-clippedLimit),
      };
      return reply.send(ok(request.id, result));
    });

    app.get('/api/v1/paper/sandbox', {
      preHandler: [app.requireAuth],
    }, async (request, reply) => {
      return reply.send(ok(request.id, options.paperSandbox.listSessions()));
    });

    app.post('/api/v1/paper/sandbox', {
      preHandler: [
        app.requireAuth,
        requireJsonMutation,
        requireSameOrigin,
      ],
    }, async (request, reply) => {
      const parsed = parseSandboxBody(request.body);
      const requestPayload: PaperSandboxRequest = {
    strategy: parsed.strategy as PaperSandboxRequest['strategy'],
        ...(Array.isArray(parsed.prices)
          ? { prices: parsed.prices as unknown as number[] }
          : {}),
        ...(parsed.maxBars === undefined
          ? {}
          : { maxBars: parseLimit(parsed.maxBars, 'maxBars', 1000) }),
      };
      const response: PaperSandboxCreateResponse = {
        session: options.paperSandbox.createSession(requestPayload),
      };
      return reply.code(201).send(ok(request.id, response));
    });

    app.get('/api/v1/paper/sandbox/:id', {
      preHandler: [app.requireAuth],
    }, async (request, reply) => {
      const sessionId = parseSessionId(request.params);
      const session = options.paperSandbox.getSession(sessionId);
      return reply.send(ok(request.id, session));
    });

    app.post('/api/v1/paper/sandbox/:id/step', {
      preHandler: [
        app.requireAuth,
        requireSameOrigin,
      ],
    }, async (request, reply) => {
      const sessionId = parseSessionId(request.params);
      const body = request.body === undefined ? {} : requestObject(request.body);
      const requestPayload: { steps?: number } = {
        ...(body.steps === undefined ? {} : {
          steps: parseLimit(body.steps, 'steps', 100),
        }),
      };
      const session = options.paperSandbox.stepSession(sessionId, requestPayload);
      return reply.send(ok(request.id, session));
    });

    app.delete('/api/v1/paper/sandbox/:id', {
      preHandler: [app.requireAuth],
    }, async (request, reply) => {
      const sessionId = parseSessionId(request.params);
      const closed = options.paperSandbox.closeSession(sessionId);
      return reply.send(ok(request.id, closed));
    });

    app.get('/api/v1/onchain/dashboard', {
      preHandler: [app.requireAuth],
    }, async (request, reply) => {
      const url = new URL(request.url, 'http://localhost');
      const symbol = parseString(url.searchParams.get('symbol') ?? 'BTCUSDT', 'symbol').toUpperCase();
      const timeframe = parseTimeframe(url.searchParams.get('timeframe') ?? '1h');
      return reply.send(ok(
        request.id,
        options.onChainDashboard({
          symbol,
          timeframe,
        }),
      ));
    });
  };
