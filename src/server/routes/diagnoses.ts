import type { FastifyPluginAsync } from 'fastify';
import type { StyleName } from '../../contracts.ts';
import type {
  DiagnoseRequest,
  DiagnosisResult,
} from '../../platform/contracts.ts';
import { parseStrategy } from '../../strategy/parse.ts';
import { DiagnosisLimiter } from '../concurrency.ts';
import { ok } from '../envelope.ts';
import { ApiRequestError } from '../errors.ts';
import {
  requireJsonMutation,
  requireSameOrigin,
} from '../guards.ts';
import { diagnosisRouteSchema } from '../schema.ts';

const STYLES = new Set<StyleName>([
  'conservative',
  'aggressive',
  'trend',
]);

export interface DiagnosisRouteOptions {
  diagnose(request: DiagnoseRequest): Promise<DiagnosisResult>;
  limiter: DiagnosisLimiter;
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

function parseStyle(value: unknown): StyleName {
  if (value === undefined) {
    return 'conservative';
  }
  if (typeof value !== 'string' || !STYLES.has(value as StyleName)) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      'Style must be conservative, aggressive, or trend.',
      'style',
    );
  }
  return value as StyleName;
}

function parseSafeInteger(
  value: unknown,
  fallback: number,
  field: 'seed' | 'candidates',
  minimum?: number,
  maximum?: number,
): number {
  const parsed = value === undefined ? fallback : value;
  if (
    typeof parsed !== 'number'
    || !Number.isSafeInteger(parsed)
    || (minimum !== undefined && parsed < minimum)
    || (maximum !== undefined && parsed > maximum)
  ) {
    const bounds = minimum === undefined
      ? 'a safe integer'
      : `an integer from ${minimum} to ${maximum}`;
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      `${field} must be ${bounds}.`,
      field,
    );
  }
  return parsed;
}

export const registerDiagnosisRoutes:
  FastifyPluginAsync<DiagnosisRouteOptions> = async (app, options) => {
    app.post('/api/v1/diagnoses', {
      config: {
        rateLimit: {
          max: 6,
          timeWindow: '1 minute',
        },
      },
      preHandler: [
        app.requireAuth,
        requireJsonMutation,
        requireSameOrigin,
      ],
      schema: diagnosisRouteSchema,
    }, async (request, reply) => {
      const body = requestObject(request.body);
      const seed = parseSafeInteger(body.seed, 42, 'seed');
      if (!Number.isSafeInteger(seed + 100_000)) {
        throw new ApiRequestError(
          400,
          'INVALID_REQUEST',
          'seed and held-out seed must be safe integers.',
          'seed',
        );
      }
      const parsedRequest: DiagnoseRequest = {
        strategy: parseStrategy(body.strategy),
        style: parseStyle(body.style),
        seed,
        candidates: parseSafeInteger(
          body.candidates,
          6,
          'candidates',
          1,
          50,
        ),
      };
      const result = await options.limiter.run(
        () => options.diagnose(parsedRequest),
      );
      return reply.send(ok(request.id, result.view));
    });
  };
