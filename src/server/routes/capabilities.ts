import type { FastifyPluginAsync } from 'fastify';
import type { AnyStrategyDefinition } from '../../contracts.ts';
import { ok } from '../envelope.ts';

export interface CapabilityRouteOptions {
  capabilities(): readonly AnyStrategyDefinition[];
}

export const registerCapabilityRoutes:
  FastifyPluginAsync<CapabilityRouteOptions> = async (app, options) => {
    app.get('/api/v1/capabilities', {
      preHandler: app.requireAuth,
    }, async request => {
      return ok(request.id, options.capabilities());
    });
  };
