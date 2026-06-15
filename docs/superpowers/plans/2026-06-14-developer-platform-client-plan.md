# TypeScript Client And Developer Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a small typed client and copy-ready developer examples that reach Strategy Doctor without reading server internals.

**Architecture:** The client wraps native `fetch`, common API envelopes, Bearer authentication, and the three developer-facing operations: capabilities, parse, and diagnose. It has no React or Fastify dependency. This lane writes a standalone API guide draft; the integration owner incorporates the final quick-start content into README after all endpoint behavior is merged.

**Tech Stack:** Node.js 24 native TypeScript, native `fetch`, `node:test`, Markdown.

---

### Task 1: Define Client Types And Error Handling

**Files:**
- Create: `src/client/types.ts`
- Create: `src/client/error.ts`
- Create: `tests/client/error.test.ts`

- [ ] **Step 1: Write failing error tests**

Test:

```ts
const error = StrategyDoctorApiError.fromEnvelope(429, {
  apiVersion: 'v1',
  requestId: 'req-rate',
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests.',
    retryable: true,
  },
});

assert.equal(error.status, 429);
assert.equal(error.code, 'RATE_LIMITED');
assert.equal(error.requestId, 'req-rate');
assert.equal(error.retryable, true);
```

Also assert a non-JSON 502 response becomes code `INVALID_RESPONSE`, retains
status 502, and does not expose the full response body.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/client/error.test.ts
```

- [ ] **Step 3: Define the public client boundary**

Re-export stable JSON types from the foundation modules rather than redefining
domain behavior:

```ts
export type {
  ApiEnvelope,
  ApiErrorEnvelope,
  DiagnoseRequest,
  DiagnosisView,
  StrategyDraft,
  AnyStrategyDefinition,
} from '../platform/contracts.ts';
```

- [ ] **Step 4: Implement the typed error**

Export:

```ts
export class StrategyDoctorApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly field?: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'StrategyDoctorApiError';
  }
}
```

Add `fromEnvelope`. Do not add automatic retries in P1.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/client/error.test.ts
npm.cmd run typecheck:core
git add src/client/types.ts src/client/error.ts tests/client/error.test.ts
git commit -m "feat: define TypeScript client errors"
```

### Task 2: Implement The Native Fetch Client

**Files:**
- Create: `src/client/index.ts`
- Create: `tests/client/client.test.ts`

- [ ] **Step 1: Write failing success tests**

Use a fetch recorder and assert:

```ts
const doctor = createStrategyDoctor({
  baseUrl: 'https://doctor.example/',
  apiKey: 'agent-key',
  fetch: recorder.fetch,
});

await doctor.capabilities();
await doctor.parseStrategy({ description: 'BTC 4h RSI Bollinger' });
await doctor.diagnose(requestFixture);
```

Recorded requests must be:

```text
GET  https://doctor.example/api/v1/capabilities
POST https://doctor.example/api/v1/strategies/parse
POST https://doctor.example/api/v1/diagnoses
```

Every request sends `Authorization: Bearer agent-key`; POST requests send JSON.

- [ ] **Step 2: Write failing failure tests**

Assert:

- non-2xx API envelopes throw `StrategyDoctorApiError`;
- malformed success JSON throws `INVALID_RESPONSE`;
- a caller-provided AbortSignal reaches fetch;
- the client never logs the API key;
- `baseUrl` strips trailing slashes and rejects non-HTTP(S) schemes.

- [ ] **Step 3: Verify RED**

```powershell
node --test tests/client/client.test.ts
```

- [ ] **Step 4: Implement the client**

Export:

```ts
export interface StrategyDoctorOptions {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StrategyDoctorClient {
  capabilities(options?: RequestOptions):
    Promise<readonly AnyStrategyDefinition[]>;
  parseStrategy(
    input: { description: string },
    options?: RequestOptions,
  ): Promise<StrategyDraft>;
  diagnose(
    input: DiagnoseRequest,
    options?: RequestOptions,
  ): Promise<DiagnosisView>;
}

export function createStrategyDoctor(
  options: StrategyDoctorOptions,
): StrategyDoctorClient
```

One private `request<T>` function handles fetch, envelopes, and errors.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/client/client.test.ts
npm.cmd run typecheck:core
git add src/client/index.ts tests/client/client.test.ts
git commit -m "feat: add native TypeScript API client"
```

### Task 3: Add Copy-Ready Agent Examples

**Files:**
- Create: `examples/agent-client.ts`
- Create: `examples/agent-curl.ps1`
- Create: `tests/client/examples.test.ts`

- [ ] **Step 1: Write failing example tests**

Read the example files and assert:

- `agent-client.ts` uses `createStrategyDoctor`;
- it reads `STRATEGY_DOCTOR_URL` and `STRATEGY_DOCTOR_API_KEY`;
- its executable integration block is at most 15 non-blank, non-comment lines;
- neither example includes a real secret;
- both examples diagnose a supported strategy.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/client/examples.test.ts
```

- [ ] **Step 3: Add the TypeScript example**

Use:

```ts
import { createStrategyDoctor } from '../src/client/index.ts';

const doctor = createStrategyDoctor({
  baseUrl: process.env.STRATEGY_DOCTOR_URL!,
  apiKey: process.env.STRATEGY_DOCTOR_API_KEY!,
});
const draft = await doctor.parseStrategy({
  description: 'BTC 4h RSI and Bollinger mean reversion',
});
const result = await doctor.diagnose({
  strategy: draft.strategy,
  style: 'conservative',
  seed: 42,
  candidates: 6,
});
console.log(result.summary);
```

- [ ] **Step 4: Add the PowerShell curl example**

Use `$env:STRATEGY_DOCTOR_URL` and `$env:STRATEGY_DOCTOR_API_KEY`, first fetch
capabilities, then submit a complete MA diagnosis request with
`Invoke-RestMethod`.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/client/examples.test.ts
npm.cmd run typecheck:core
git add examples/agent-client.ts examples/agent-curl.ps1 tests/client/examples.test.ts
git commit -m "docs: add copy-ready Agent API examples"
```

### Task 4: Draft The Standalone API Guide

**Files:**
- Create: `docs/API.md`

- [ ] **Step 1: Document the contract**

Include:

1. Authentication with Bearer keys.
2. `GET /api/v1/capabilities`.
3. `POST /api/v1/strategies/parse`.
4. Explicit confirmation boundary.
5. `POST /api/v1/diagnoses`.
6. Common envelope and stable errors.
7. Deterministic seed behavior.
8. Offline Mock limitation.
9. `returnDelta` versus legacy `returnCost`.
10. OpenAPI URL.

- [ ] **Step 2: Add four five-minute paths**

Provide exact commands for:

```text
Web user
REST/PowerShell developer
TypeScript developer
Existing CLI user
```

Mark Web/server startup commands as requiring the final integration branch.

- [ ] **Step 3: Verify documentation references**

```powershell
rg -n "api/v1/capabilities|api/v1/strategies/parse|api/v1/diagnoses|returnDelta|offline" docs/API.md
node --test tests/client/*.test.ts
npm.cmd run typecheck:core
git diff --check
```

- [ ] **Step 4: Commit**

```powershell
git add docs/API.md
git commit -m "docs: explain the developer API contract"
```
