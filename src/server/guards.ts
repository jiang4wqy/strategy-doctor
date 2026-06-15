import type {
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { ApiRequestError } from './errors.ts';

export async function requireJsonMutation(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const contentType = request.headers['content-type']
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    throw new ApiRequestError(
      415,
      'INVALID_REQUEST',
      'Mutation requests require application/json.',
      'content-type',
    );
  }
}

export async function requireSameOrigin(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const origin = request.headers.origin;
  if (!origin) {
    return;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new ApiRequestError(
      403,
      'INVALID_REQUEST',
      'The Origin header is invalid.',
      'origin',
    );
  }
  const requestHost = request.headers.host?.toLowerCase();
  if (!requestHost || originHost !== requestHost) {
    throw new ApiRequestError(
      403,
      'INVALID_REQUEST',
      'Cross-origin mutation requests are not allowed.',
      'origin',
    );
  }
}
