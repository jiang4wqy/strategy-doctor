import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import type {
  DiagnoseRequest,
  DiagnosisResult,
} from '../platform/contracts.ts';
import { registerAuth } from './auth.ts';
import {
  isLoopbackHost,
  parseServerConfig,
} from './config.ts';
import { DiagnosisLimiter } from './concurrency.ts';
import {
  createDefaultServices,
  type ServerServices,
} from './default-services.ts';
import { fail } from './envelope.ts';
import { toApiError } from './errors.ts';
import { registerCapabilityRoutes } from './routes/capabilities.ts';
import { registerDiagnosisRoutes } from './routes/diagnoses.ts';
import { registerHealthRoutes } from './routes/health.ts';
import { registerParseRoutes } from './routes/parse.ts';
import { registerPlaybookRoutes } from './routes/playbook.ts';
import { registerResearchRoutes } from './routes/research.ts';

export interface BuildServerOptions {
  env?: Record<string, string | undefined>;
  services?: Partial<ServerServices>;
  diagnose?: (request: DiagnoseRequest) => Promise<DiagnosisResult>;
  staticRoot?: string;
  logger?: boolean;
}

function requestError(error: unknown) {
  const fastifyError = error as {
    code?: string;
    statusCode?: number;
    validation?: unknown;
  };
  if (fastifyError.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return {
      statusCode: 413,
      error: {
        code: 'INVALID_REQUEST' as const,
        message: 'Request body exceeds the configured limit.',
        field: 'body',
        retryable: false,
      },
    };
  }
  if (fastifyError.validation) {
    return {
      statusCode: 400,
      error: {
        code: 'INVALID_REQUEST' as const,
        message: 'Request body does not match the API schema.',
        retryable: false,
      },
    };
  }
  if (fastifyError.statusCode === 429) {
    return {
      statusCode: 429,
      error: {
        code: 'RATE_LIMITED' as const,
        message: 'Too many requests.',
        retryable: true,
      },
    };
  }
  return toApiError(error);
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const config = parseServerConfig(options.env ?? process.env);
  const staticRoot = options.staticRoot ?? config.staticRoot;
  const hasWebBuild = existsSync(path.join(staticRoot, 'index.html'));
  const defaults = createDefaultServices();
  const services: ServerServices = {
    capabilities: options.services?.capabilities ?? defaults.capabilities,
    parse: options.services?.parse ?? defaults.parse,
    diagnose: options.diagnose
      ?? options.services?.diagnose
      ?? defaults.diagnose,
    factors: options.services?.factors ?? defaults.factors,
    notebooks: options.services?.notebooks ?? defaults.notebooks,
    multiFactorFramework: options.services?.multiFactorFramework
      ?? defaults.multiFactorFramework,
    paperSignal: options.services?.paperSignal ?? defaults.paperSignal,
  };
  const app = Fastify({
    bodyLimit: config.bodyLimit,
    logger: options.logger ?? false,
    trustProxy: address => isLoopbackHost(address),
    genReqId: () => `req_${randomUUID()}`,
  });

  app.setErrorHandler((error, request, reply) => {
    const mapped = requestError(error);
    return reply
      .code(mapped.statusCode)
      .send(fail(request.id, mapped.error));
  });

  await app.register(rateLimit, {
    global: false,
  });
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Strategy Doctor API',
        version: '1.0.0',
        description:
          'Deterministic adversarial diagnosis for registered strategies.',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'doctor_session',
          },
        },
      },
    },
  });

  await registerAuth(app, config);
  await app.register(registerHealthRoutes);
  await app.register(registerCapabilityRoutes, {
    capabilities: services.capabilities,
  });
  await app.register(registerParseRoutes, {
    parse: services.parse,
  });
  await app.register(registerDiagnosisRoutes, {
    diagnose: services.diagnose,
    limiter: new DiagnosisLimiter(2),
  });
  await app.register(registerPlaybookRoutes, {
    parse: services.parse,
    diagnose: services.diagnose,
    limiter: new DiagnosisLimiter(2),
  });
  await app.register(registerResearchRoutes, {
    factors: services.factors,
    notebooks: services.notebooks,
    multiFactorFramework: services.multiFactorFramework,
    paperSignal: services.paperSignal,
  });

  app.get('/api/v1/openapi.json', {
    preHandler: app.requireAuth,
    schema: { hide: true },
  }, async (_request, reply) => {
    return reply.send(app.swagger());
  });

  if (hasWebBuild) {
    await app.register(staticPlugin, {
      root: staticRoot,
      wildcard: false,
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const isApiRequest = request.url.startsWith('/api/');
    const isPageRequest = request.method === 'GET'
      || request.method === 'HEAD';
    if (!isApiRequest && isPageRequest && hasWebBuild) {
      return reply.type('text/html').sendFile('index.html');
    }
    const message = !isApiRequest && isPageRequest
      ? 'Web client build is missing. Run npm.cmd run build:web.'
      : `Route not found: ${request.method} ${request.url}`;
    return reply.code(404).send(fail(request.id, {
      code: 'INVALID_REQUEST',
      message,
      retryable: false,
    }));
  });

  return app;
}
