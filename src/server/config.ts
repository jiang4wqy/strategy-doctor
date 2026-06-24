import path from 'node:path';

export interface ServerConfig {
  host: string;
  port: number;
  accessCode?: string;
  sessionSecret?: string;
  apiKeys: readonly string[];
  sessionTtlSeconds: number;
  bodyLimit: number;
  staticRoot: string;
  authRateLimit: AuthRateLimitConfig;
}

export interface AuthRateLimitConfig {
  enabled: boolean;
  max: number;
  timeWindow: string;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  label: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed)
    || parsed < 1
    || parsed > maximum
  ) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function trimmedString(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function isEnabledFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (value ?? '').trim().toLowerCase(),
  );
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]'
    || normalized.startsWith('127.');
}

export function parseServerConfig(
  env: Record<string, string | undefined>,
): ServerConfig {
  const host = trimmedString(env.DOCTOR_HOST ?? env.HOST, '127.0.0.1');
  const accessCode = env.DOCTOR_WEB_ACCESS_CODE?.trim() || undefined;
  const sessionSecret = env.DOCTOR_SESSION_SECRET?.trim() || undefined;

  if (sessionSecret !== undefined && sessionSecret.length < 32) {
    throw new Error('session secret must contain at least 32 characters');
  }
  if (!isLoopbackHost(host) && (!accessCode || !sessionSecret)) {
    throw new Error(
      'non-loopback binding requires an access code and session secret',
    );
  }

  const apiKeys = Object.freeze([
    ...new Set(
      (env.DOCTOR_API_KEYS ?? '')
        .split(',')
        .map(key => key.trim())
        .filter(Boolean),
    ),
  ]);

  return Object.freeze({
    host,
    port: positiveInteger(
      env.DOCTOR_PORT ?? env.PORT,
      8080,
      'port',
      65_535,
    ),
    accessCode,
    sessionSecret,
    apiKeys,
    sessionTtlSeconds: positiveInteger(
      env.DOCTOR_SESSION_TTL_SECONDS,
      12 * 60 * 60,
      'session TTL',
    ),
    bodyLimit: positiveInteger(
      env.DOCTOR_BODY_LIMIT,
      32 * 1024,
      'body limit',
    ),
    staticRoot: path.resolve(env.DOCTOR_STATIC_ROOT ?? 'web/dist'),
    authRateLimit: Object.freeze({
      enabled: !isEnabledFlag(env.DOCTOR_AUTH_RATE_LIMIT_DISABLED),
      max: positiveInteger(
        env.DOCTOR_AUTH_RATE_LIMIT_MAX,
        5,
        'auth rate limit max',
      ),
      timeWindow: trimmedString(
        env.DOCTOR_AUTH_RATE_LIMIT_WINDOW,
        '15 minutes',
      ),
    }),
  });
}
