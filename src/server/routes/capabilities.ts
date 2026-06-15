import type { FastifyPluginAsync } from 'fastify';
import type { AnyStrategyDefinition } from '../../contracts.ts';
import { ok } from '../envelope.ts';
import { capabilitiesRouteSchema } from '../schema.ts';

export interface CapabilityRouteOptions {
  capabilities(): readonly AnyStrategyDefinition[];
}

export const registerCapabilityRoutes:
  FastifyPluginAsync<CapabilityRouteOptions> = async (app, options) => {
    app.get('/api/v1/capabilities', {
      preHandler: app.requireAuth,
      schema: capabilitiesRouteSchema,
    }, async request => {
      return ok(request.id, options.capabilities());
    });
  };
