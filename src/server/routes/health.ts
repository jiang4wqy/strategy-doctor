import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../envelope.ts';
import { healthRouteSchema } from '../schema.ts';

export const registerHealthRoutes: FastifyPluginAsync = async app => {
  app.get('/api/v1/health', {
    schema: healthRouteSchema,
  }, async request => {
    return ok(request.id, {
      status: 'ok' as const,
      offline: true,
    });
  });
};
