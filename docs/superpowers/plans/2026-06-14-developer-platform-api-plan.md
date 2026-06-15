# Developer Platform API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the frozen diagnosis application service through an authenticated, documented, rate-limited Fastify REST API.

**Architecture:** Build a Fastify application factory with injected environment and diagnosis dependencies so tests use `app.inject()` without opening ports. Separate configuration, authentication, common envelopes, request guards, and routes into focused plugins. This lane implements health, auth, capabilities, diagnosis, OpenAPI, and static serving; the final parse route is registered after the parallel natural-language lane merges.

**Tech Stack:** Fastify, `@fastify/cookie`, `@fastify/static`, `@fastify/swagger`, `@fastify/rate-limit`, Node crypto, `node:test`.

---

### Task 1: Define Server Configuration And Error Envelopes

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/errors.ts`
- Create: `src/server/envelope.ts`
- Create: `tests/server/config.test.ts`
- Create: `tests/server/errors.test.ts`

- [ ] **Step 1: Write failing configuration tests**

Test:

```ts
const config = parseServerConfig({
  DOCTOR_WEB_ACCESS_CODE: 'team-code',
  DOCTOR_SESSION_SECRET: 'a'.repeat(32),
  DOCTOR_API_KEYS: 'agent-one, agent-two ',
  DOCTOR_HOST: '127.0.0.1',
  DOCTOR_PORT: '8080',
});

assert.deepEqual(config.apiKeys, ['agent-one', 'agent-two']);
assert.equal(config.port, 8080);
assert.throws(
  () => parseServerConfig({ DOCTOR_HOST: '0.0.0.0' }),
  /access code.*session secret/i,
);
```

- [ ] **Step 2: Write failing error-envelope tests**

Test:

```ts
const error = toApiError(
  new StrategyValidationError(
    'MULTI_SYMBOL_UNSUPPORTED',
    'exactly one symbol is required',
    'strategy.universe',
  ),
);
assert.deepEqual(error, {
  code: 'MULTI_SYMBOL_UNSUPPORTED',
  message: 'exactly one symbol is required',
  field: 'strategy.universe',
  retryable: false,
});
```

- [ ] **Step 3: Verify RED**

```powershell
node --test tests/server/config.test.ts tests/server/errors.test.ts
```

- [ ] **Step 4: Implement strict environment parsing**

Export:

```ts
export interface ServerConfig {
  host: string;
  port: number;
  accessCode?: string;
  sessionSecret?: string;
  apiKeys: readonly string[];
  sessionTtlSeconds: number;
  bodyLimit: number;
  staticRoot: string;
}

export function parseServerConfig(
  env: Record<string, string | undefined>,
): ServerConfig
```

Defaults are `127.0.0.1`, `8080`, 12 hours, and 32 KiB. Refuse non-loopback
hosts unless both access code and a session secret of at least 32 characters
are configured.

- [ ] **Step 5: Implement common envelopes**

Import `ApiEnvelope`, `ApiErrorEnvelope`, and `ApiError` from
`src/platform/contracts.ts`. Export only envelope construction helpers:

```ts
export const ok = <T>(requestId: string, data: T): ApiEnvelope<T> => ({
  apiVersion: 'v1',
  requestId,
  data,
});
```

Map stable codes from the design. Unknown errors become `DIAGNOSIS_FAILED`,
HTTP 500, `retryable: false`, without stack traces.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
node --test tests/server/config.test.ts tests/server/errors.test.ts
npm.cmd run typecheck:core
git add src/server/config.ts src/server/errors.ts src/server/envelope.ts tests/server/config.test.ts tests/server/errors.test.ts
git commit -m "feat: define API configuration and error envelopes"
```

### Task 2: Add Cookie And Bearer Authentication

**Files:**
- Create: `src/server/auth.ts`
- Create: `tests/server/auth.test.ts`

- [ ] **Step 1: Write failing authentication tests**

Build a Fastify fixture with `registerAuth`. Verify:

```ts
assert.equal((await app.inject({ method: 'GET', url: '/protected' })).statusCode, 401);
```

Login with the configured access code, capture the signed HttpOnly cookie, and
verify it accesses `/protected`. Verify an invalid code returns
`AUTH_INVALID`, logout expires the cookie, a configured Bearer key succeeds,
and an unknown key returns `AUTH_INVALID`.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/server/auth.test.ts
```

- [ ] **Step 3: Implement timing-safe comparison**

Use buffers of equal length before calling `timingSafeEqual`. Return `false`
for missing or unequal-length values.

- [ ] **Step 4: Implement the auth plugin**

Export:

```ts
export async function registerAuth(
  app: FastifyInstance,
  config: ServerConfig,
): Promise<void>
```

Register signed cookies when `sessionSecret` exists. The login route sets
`doctor_session` to an expiry timestamp with:

```ts
{
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  signed: true,
  maxAge: config.sessionTtlSeconds,
  secure: request.protocol === 'https',
}
```

Decorate the app with `requireAuth`. It accepts a non-expired signed cookie or
an exact Bearer key from `config.apiKeys`.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/server/auth.test.ts
npm.cmd run typecheck:core
git add src/server/auth.ts tests/server/auth.test.ts
git commit -m "feat: authenticate Web sessions and API keys"
```

### Task 3: Add Request Guards And Diagnosis Concurrency

**Files:**
- Create: `src/server/guards.ts`
- Create: `src/server/concurrency.ts`
- Create: `tests/server/guards.test.ts`
- Create: `tests/server/concurrency.test.ts`

- [ ] **Step 1: Write failing guard tests**

Verify mutation requests reject:

```ts
{ headers: { 'content-type': 'text/plain' } }
{ headers: { origin: 'https://untrusted.example' } }
```

Accept no Origin header for Agent calls and accept an Origin whose host matches
the request host.

- [ ] **Step 2: Write failing concurrency tests**

Use a deferred diagnosis promise. Start two diagnoses, then assert the third
returns HTTP 503 with `SERVER_BUSY`. Resolve one promise and assert the next
request succeeds.

- [ ] **Step 3: Verify RED**

```powershell
node --test tests/server/guards.test.ts tests/server/concurrency.test.ts
```

- [ ] **Step 4: Implement request guards**

Export pre-handler functions for JSON content type and same-origin mutation
checks. Do not require Origin for CLI/Agent requests.

- [ ] **Step 5: Implement a two-slot limiter**

Export:

```ts
export class DiagnosisLimiter {
  constructor(private readonly maximum = 2) {}
  async run<T>(operation: () => Promise<T>): Promise<T>
}
```

Throw `ServerBusyError` before invoking the third active operation. Always
release the slot in `finally`.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
node --test tests/server/guards.test.ts tests/server/concurrency.test.ts
npm.cmd run typecheck:core
git add src/server/guards.ts src/server/concurrency.ts tests/server/guards.test.ts tests/server/concurrency.test.ts
git commit -m "feat: guard API mutations and diagnosis capacity"
```

### Task 4: Add Health, Capability, And Diagnosis Routes

**Files:**
- Create: `src/server/routes/health.ts`
- Create: `src/server/routes/capabilities.ts`
- Create: `src/server/routes/diagnoses.ts`
- Create: `tests/server/routes.test.ts`

- [ ] **Step 1: Write failing route tests**

Using an injected `diagnose` function, assert:

```ts
GET /api/v1/health -> 200 without authentication
GET /api/v1/capabilities -> 401 without authentication
GET /api/v1/capabilities -> two definitions with Bearer auth
POST /api/v1/diagnoses -> DiagnosisView envelope
POST /api/v1/diagnoses with two symbols -> MULTI_SYMBOL_UNSUPPORTED
```

Also assert the diagnosis response exposes `returnDelta` while the embedded
legacy Scorecard still exposes `tradeoff.returnCost`.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/server/routes.test.ts
```

- [ ] **Step 3: Implement route plugins**

Each route module exports one Fastify plugin. Diagnosis uses:

```ts
const parsedRequest: DiagnoseRequest = {
  strategy: parseStrategy(request.body.strategy),
  style: parseStyle(request.body.style),
  seed: parseSafeInteger(request.body.seed, 42),
  candidates: parseCandidateCount(request.body.candidates, 6),
};
```

Run it through the two-slot limiter and return `result.view` in the common
envelope.

- [ ] **Step 4: Add route-specific limits**

Apply:

```text
auth: 5 requests / 15 minutes / IP
diagnosis: 6 requests / minute / IP
```

Map plugin rate-limit responses to the stable `RATE_LIMITED` envelope.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/server/routes.test.ts
npm.cmd run typecheck:core
git add src/server/routes tests/server/routes.test.ts
git commit -m "feat: expose capability and diagnosis routes"
```

### Task 5: Build The Fastify Application And OpenAPI

**Files:**
- Create: `src/server/schema.ts`
- Create: `src/server/app.ts`
- Create: `src/server/start.ts`
- Create: `tests/server/app.test.ts`

- [ ] **Step 1: Write failing application tests**

Assert:

```ts
const app = await buildServer({ env, diagnose });
const openapi = await app.inject({
  method: 'GET',
  url: '/api/v1/openapi.json',
  headers: { authorization: 'Bearer test-key' },
});
assert.equal(openapi.statusCode, 200);
assert.ok(openapi.json().paths['/api/v1/diagnoses']);
```

Verify a 33 KiB request returns 413 in the common error shape, unknown routes
return JSON, request IDs exist, and the app does not log request bodies.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/server/app.test.ts
```

- [ ] **Step 3: Add JSON schemas**

Define reusable JSON schemas for strategy definitions, diagnosis requests,
DiagnosisView, envelopes, and errors. Route response schemas must omit unknown
properties rather than returning internal state.

- [ ] **Step 4: Implement `buildServer`**

Export:

```ts
export interface BuildServerOptions {
  env?: Record<string, string | undefined>;
  diagnose?: typeof diagnoseStrategy;
  logger?: boolean;
}

export async function buildServer(
  options: BuildServerOptions = {},
): Promise<FastifyInstance>
```

Configure:

```ts
Fastify({
  bodyLimit: config.bodyLimit,
  logger: options.logger ?? false,
  trustProxy: address => isLoopbackAddress(address),
  genReqId: () => `req_${randomUUID()}`,
});
```

Register official cookie, rate-limit, Swagger, and static plugins. Static
serving points to `web/dist` only if the directory exists. Register health,
auth, capabilities, and diagnoses. Leave a clearly named
`registerParseRoute` integration call for Wave 3; do not create a fake parser.

- [ ] **Step 5: Implement startup**

`src/server/start.ts` loads `process.env`, builds with logging enabled, listens
on configured host/port, writes the local URL, and exits non-zero on startup
failure. It never prints secrets.

- [ ] **Step 6: Verify the API lane**

```powershell
node --test tests/server/*.test.ts
npm.cmd run typecheck:core
git diff --check
```

Expected: all API tests pass without opening a network port.

- [ ] **Step 7: Commit**

```powershell
git add src/server tests/server
git commit -m "feat: assemble documented Fastify API"
```
