import type { FastifyPluginAsync } from 'fastify';
import { ok } from '../envelope.ts';

export const registerHealthRoutes: FastifyPluginAsync = async app => {
  app.get('/api/v1/health', async request => {
    return ok(request.id, {
      status: 'ok' as const,
      offline: true,
    });
  });
};
