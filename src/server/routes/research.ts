import type { FastifyPluginAsync } from 'fastify';
import type {
  FactorLibraryView,
  MultiFactorFrameworkView,
  NotebookCatalogView,
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
  };
