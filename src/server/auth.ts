import { timingSafeEqual } from 'node:crypto';
import cookie from '@fastify/cookie';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type { ServerConfig } from './config.ts';
import { fail, ok } from './envelope.ts';
import { authRouteSchema } from './schema.ts';

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void>;
  }
}

const SESSION_COOKIE = 'doctor_session';

function timingSafeMatch(
  candidate: string | undefined,
  expected: string | undefined,
): boolean {
  if (candidate === undefined || expected === undefined) {
    return false;
  }
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

function bearerCredential(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length);
}

function validBearer(
  request: FastifyRequest,
  config: ServerConfig,
): boolean {
  const credential = bearerCredential(request);
  return config.apiKeys.some(key => timingSafeMatch(credential, key));
}

function validSession(request: FastifyRequest): boolean {
  const cookieValue = request.cookies[SESSION_COOKIE];
  if (!cookieValue) {
    return false;
  }
  const unsigned = request.unsignCookie(cookieValue);
  if (!unsigned.valid || unsigned.value === null) {
    return false;
  }
  const expiresAt = Number(unsigned.value);
  return Number.isSafeInteger(expiresAt) && expiresAt > Date.now();
}

async function sendAuthFailure(
  request: FastifyRequest,
  reply: FastifyReply,
  code: 'AUTH_REQUIRED' | 'AUTH_INVALID',
): Promise<void> {
  const message = code === 'AUTH_REQUIRED'
    ? 'Authentication is required.'
    : 'Authentication credentials are invalid.';
  await reply.code(401).send(fail(request.id, {
    code,
    message,
    retryable: false,
  }));
}

export async function registerAuth(
  app: FastifyInstance,
  config: ServerConfig,
): Promise<void> {
  await app.register(cookie, config.sessionSecret
    ? { secret: config.sessionSecret }
    : {});
  const authRateLimit = config.authRateLimit.enabled
    ? {
      max: config.authRateLimit.max,
      timeWindow: config.authRateLimit.timeWindow,
    }
    : undefined;

  app.decorate('requireAuth', async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (validBearer(request, config) || validSession(request)) {
      return;
    }
    const credentialsPresent = Boolean(
      request.headers.authorization || request.cookies[SESSION_COOKIE],
    );
    await sendAuthFailure(
      request,
      reply,
      credentialsPresent ? 'AUTH_INVALID' : 'AUTH_REQUIRED',
    );
  });

  app.post('/api/v1/auth', {
    ...(authRateLimit ? {
      config: {
        rateLimit: authRateLimit,
      },
    } : {}),
    schema: authRouteSchema,
  }, async (request, reply) => {
    const body = request.body as { accessCode?: unknown } | undefined;
    const accessCode = typeof body?.accessCode === 'string'
      ? body.accessCode
      : undefined;
    if (
      !config.sessionSecret
      || !timingSafeMatch(accessCode, config.accessCode)
    ) {
      await sendAuthFailure(request, reply, 'AUTH_INVALID');
      return;
    }

    const expiresAt = Date.now() + config.sessionTtlSeconds * 1000;
    reply.setCookie(SESSION_COOKIE, String(expiresAt), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      signed: true,
      maxAge: config.sessionTtlSeconds,
      secure: request.protocol === 'https',
    });
    return reply.send(ok(request.id, {
      authenticated: true,
      expiresAt: new Date(expiresAt).toISOString(),
    }));
  });

  app.delete('/api/v1/auth', async (request, reply) => {
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
    });
    return reply.send(ok(request.id, { authenticated: false }));
  });
}
