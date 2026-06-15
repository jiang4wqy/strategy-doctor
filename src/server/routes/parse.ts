import type { FastifyPluginAsync } from 'fastify';
import type { StrategyDraft } from '../../platform/contracts.ts';
import { ok } from '../envelope.ts';
import { ApiRequestError } from '../errors.ts';
import {
  requireJsonMutation,
  requireSameOrigin,
} from '../guards.ts';
import { parseRouteSchema } from '../schema.ts';

export interface ParseRouteOptions {
  parse(description: string): Promise<StrategyDraft>;
}

function parseDescription(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      'Request body must be an object.',
    );
  }
  const description = (body as { description?: unknown }).description;
  if (
    typeof description !== 'string'
    || description.trim().length < 1
    || description.length > 2000
  ) {
    throw new ApiRequestError(
      400,
      'INVALID_REQUEST',
      'description must contain from 1 to 2000 characters.',
      'description',
    );
  }
  return description;
}

export const registerParseRoutes:
  FastifyPluginAsync<ParseRouteOptions> = async (app, options) => {
    app.post('/api/v1/strategies/parse', {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
      preHandler: [
        app.requireAuth,
        requireJsonMutation,
        requireSameOrigin,
      ],
      schema: parseRouteSchema,
    }, async request => {
      const description = parseDescription(request.body);
      return ok(request.id, await options.parse(description));
    });
  };
