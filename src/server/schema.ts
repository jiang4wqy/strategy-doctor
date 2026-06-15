import type { FastifySchema } from 'fastify';

const apiError = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message', 'retryable'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    field: { type: 'string' },
    retryable: { type: 'boolean' },
  },
} as const;

export const errorEnvelopeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['apiVersion', 'requestId', 'error'],
  properties: {
    apiVersion: { const: 'v1' },
    requestId: { type: 'string' },
    error: apiError,
  },
} as const;

export const healthRouteSchema: FastifySchema = {
  tags: ['system'],
  summary: 'Check service health',
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['apiVersion', 'requestId', 'data'],
      properties: {
        apiVersion: { const: 'v1' },
        requestId: { type: 'string' },
        data: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'offline'],
          properties: {
            status: { const: 'ok' },
            offline: { const: true },
          },
        },
      },
    },
  },
};

export const capabilitiesRouteSchema: FastifySchema = {
  tags: ['strategies'],
  summary: 'List supported strategy capabilities',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
};

export const diagnosisRouteSchema: FastifySchema = {
  tags: ['diagnosis'],
  summary: 'Diagnose a confirmed strategy',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['strategy'],
    properties: {
      strategy: { type: 'object', additionalProperties: true },
      style: {
        type: 'string',
        enum: ['conservative', 'aggressive', 'trend'],
      },
      seed: { type: 'integer' },
      candidates: { type: 'integer' },
    },
  },
};

export const authRouteSchema: FastifySchema = {
  tags: ['authentication'],
  summary: 'Create a browser session',
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['accessCode'],
    properties: {
      accessCode: { type: 'string', minLength: 1 },
    },
  },
};
