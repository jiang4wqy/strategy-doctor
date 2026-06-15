# Developer Platform Integration And Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the parallel P1 lanes, connect their intentional boundaries, verify the real browser and developer workflows, and publish a secure temporary team preview.

**Architecture:** The integration branch consumes the frozen application service, parser, server, Web, and client modules. One default-services module performs dependency wiring; route modules remain testable through injection. The built React client is served by the same Fastify process, Playwright tests the actual process, and Cloudflare Quick Tunnel exposes only that protected local port.

**Tech Stack:** Node.js 24, Fastify, React/Vite build, Playwright, TypeScript client, Cloudflare `cloudflared`, GitHub Actions.

---

### Task 1: Merge And Verify The Four Parallel Lanes

**Files:**
- No production edits before merge.

- [ ] **Step 1: Confirm each lane starts from the foundation commit**

Run for every Wave 2 branch:

```powershell
$foundation = git rev-parse codex/p1-foundation
$lanes = @(
  'codex/p1-api',
  'codex/p1-natural-language',
  'codex/p1-web',
  'codex/p1-client-docs'
)
foreach ($lane in $lanes) {
  git merge-base --is-ancestor $foundation $lane
  if ($LASTEXITCODE -ne 0) {
    throw "$lane does not descend from $foundation"
  }
}
```

Expected: exit code 0 for API, natural-language, Web, and client/docs.

- [ ] **Step 2: Confirm ownership**

Run:

```powershell
git diff --name-only "$foundation..codex/p1-api"
git diff --name-only "$foundation..codex/p1-natural-language"
git diff --name-only "$foundation..codex/p1-web"
git diff --name-only "$foundation..codex/p1-client-docs"
```

Expected: each list stays within the master-plan ownership table. Reject and
correct out-of-scope changes before merging.

- [ ] **Step 3: Merge in dependency order**

```powershell
git merge --no-ff codex/p1-api
git merge --no-ff codex/p1-natural-language
git merge --no-ff codex/p1-client-docs
git merge --no-ff codex/p1-web
```

Do not resolve conflicts by selecting entire-file `ours` or `theirs`. Inspect
shared type imports and preserve both reviewed changes.

- [ ] **Step 4: Run the pre-wiring suite**

```powershell
node --test tests/server/*.test.ts tests/natural-language/*.test.ts tests/client/*.test.ts
npm.cmd run test:web
npm.cmd run typecheck
npm.cmd run build:web
git diff --check
```

Expected: all lane-local tests pass. The parse route may not yet be registered
in the complete server.

### Task 2: Register Natural-Language Parsing In The API

**Files:**
- Create: `src/server/routes/parse.ts`
- Create: `src/server/default-services.ts`
- Modify: `src/server/app.ts`
- Create: `tests/server/parse-route.test.ts`
- Create: `tests/server/default-services.test.ts`

- [ ] **Step 1: Write the failing parse-route tests**

Using an injected parser, assert:

```ts
POST /api/v1/strategies/parse without auth -> 401 AUTH_REQUIRED
POST /api/v1/strategies/parse with description > 2000 -> 400 INVALID_REQUEST
POST /api/v1/strategies/parse with Chinese RSI text -> StrategyDraft envelope
ambiguous description -> 400 AMBIGUOUS_DESCRIPTION
unsupported description -> 422 UNSUPPORTED_STRATEGY_DESCRIPTION
```

Assert 21 parse requests in one minute cause `RATE_LIMITED`.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/server/parse-route.test.ts tests/server/default-services.test.ts
```

- [ ] **Step 3: Define dependency ports**

In `src/server/default-services.ts`, export:

```ts
export interface ServerServices {
  capabilities(): readonly AnyStrategyDefinition[];
  parse(description: string): Promise<StrategyDraft>;
  diagnose(request: DiagnoseRequest): Promise<DiagnosisResult>;
}

export function createDefaultServices(): ServerServices
```

Wire:

```ts
strategyRegistry.listDefinitions()
parseStrategyDescription(description)
diagnoseStrategy(request)
```

The API app accepts `Partial<ServerServices>` overrides for tests.

- [ ] **Step 4: Implement and register the route**

Require authentication, JSON, same origin when Origin exists, 2,000-character
limit, and 20 requests/minute/IP. Return the common envelope. Register before
static assets.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/server/parse-route.test.ts tests/server/default-services.test.ts tests/server/*.test.ts
npm.cmd run typecheck:core
git add src/server/routes/parse.ts src/server/default-services.ts src/server/app.ts tests/server/parse-route.test.ts tests/server/default-services.test.ts
git commit -m "feat: connect natural-language parsing to the API"
```

### Task 3: Serve The Production Web Build Safely

**Files:**
- Modify: `src/server/app.ts`
- Modify: `src/server/start.ts`
- Create: `tests/server/static-assets.test.ts`

- [ ] **Step 1: Write failing static tests**

Create a temporary static root with `index.html` and `assets/app.js`. Assert:

```text
GET / -> index.html
GET /assets/app.js -> JavaScript asset
GET /history -> index.html SPA fallback
GET /api/v1/unknown -> JSON 404, never index.html
```

Assert assets are served only after API routes are registered.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/server/static-assets.test.ts
```

- [ ] **Step 3: Implement static serving**

Pass `staticRoot` into `buildServer`. If `index.html` exists, register
`@fastify/static`. Add a not-found handler:

```ts
if (request.url.startsWith('/api/')) {
  return reply.code(404).send(apiNotFound(request.id));
}
return reply.type('text/html').sendFile('index.html');
```

If the build is missing, API-only mode remains available and `/` returns a
clear JSON message telling the operator to run `npm.cmd run build:web`.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
node --test tests/server/static-assets.test.ts tests/server/app.test.ts
npm.cmd run build:web
npm.cmd run typecheck
git add src/server/app.ts src/server/start.ts tests/server/static-assets.test.ts
git commit -m "feat: serve the React client from Fastify"
```

### Task 4: Test The TypeScript Client Against A Real Server

**Files:**
- Create: `tests/integration/client-server.test.ts`

- [ ] **Step 1: Write the real-server integration test**

Build the Fastify app with deterministic services, listen on
`127.0.0.1` port `0`, construct the client with the returned address, and run:

```ts
const capabilities = await client.capabilities();
const draft = await client.parseStrategy({
  description: 'BTC 4h RSI and Bollinger mean reversion',
});
const view = await client.diagnose({
  strategy: draft.strategy,
  style: 'conservative',
  seed: 42,
  candidates: 6,
});
```

Assert two capabilities, the expected RSI archetype, five evaluations, and
non-empty chart data. Close the server in `t.after`.

- [ ] **Step 2: Run and fix only boundary mismatches**

```powershell
node --test tests/integration/client-server.test.ts
```

Expected: PASS. If it fails, correct transport property names or envelope
handling. Do not duplicate server logic inside the client.

- [ ] **Step 3: Commit**

```powershell
git add tests/integration/client-server.test.ts
git commit -m "test: exercise the client against the real API"
```

### Task 5: Add Browser End-To-End Acceptance

**Files:**
- Create: `tests/e2e/playwright.config.ts`
- Create: `tests/e2e/fixtures.ts`
- Create: `tests/e2e/rsi-workflow.spec.ts`
- Create: `tests/e2e/ma-workflow.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`

- [ ] **Step 1: Configure the Web server**

Use:

```ts
webServer: {
  command: 'npm.cmd run web',
  url: 'http://127.0.0.1:8080/api/v1/health',
  reuseExistingServer: !process.env.CI,
  env: {
    DOCTOR_WEB_ACCESS_CODE: 'e2e-code',
    DOCTOR_SESSION_SECRET: 'e2e-session-secret-at-least-32-characters',
    DOCTOR_API_KEYS: 'e2e-api-key',
    DOCTOR_HOST: '127.0.0.1',
    DOCTOR_PORT: '8080'
  }
}
```

Run Chromium only in P1.

- [ ] **Step 2: Write the RSI workflow**

The browser:

1. enters `e2e-code`;
2. submits a Chinese RSI/Bollinger description;
3. verifies assumptions and editable parameters;
4. clicks `Confirm and diagnose`;
5. verifies five evaluations, prescription text, and all four chart regions;
6. verifies the developer panel request ID;
7. reloads and reopens the result from local history.

- [ ] **Step 3: Write the MA short workflow**

Login, submit an English moving-average description, confirm the archetype and
fast/slow periods, diagnose, and verify the result strategy archetype.

- [ ] **Step 4: Install the browser and verify**

Add an accessibility test with `@axe-core/playwright`. Scan the login page and
the populated diagnosis workspace. Fail on `serious` or `critical` violations
and attach the JSON results to the Playwright report.

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Expected: both workflows pass.

- [ ] **Step 5: Commit**

```powershell
git add tests/e2e
git commit -m "test: accept the browser diagnosis workflows"
```

### Task 6: Update CI And Public Documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `docs/SETUP.md`
- Modify: `docs/DEMO.md`
- Modify: `docs/SUBMISSION.md`
- Modify: `docs/API.md`

- [ ] **Step 1: Extend CI**

CI runs:

```powershell
npm.cmd ci
npm.cmd run test:coverage
npm.cmd run test:web
npm.cmd run typecheck
npm.cmd run build:web
npm.cmd run demo
```

Playwright runs in a separate job after `npx playwright install --with-deps
chromium`. Keep live Bitget and Anthropic calls disabled.

- [ ] **Step 2: Write four quick starts**

README provides:

```text
CLI: npm.cmd run demo
Web: set access/session variables, then npm.cmd run web
REST: PowerShell request with Bearer key
TypeScript: node examples/agent-client.ts
```

State clearly that public API/Web uses offline `MockBacktester`, not account
data or orders.

- [ ] **Step 3: Document local and team sharing**

Add:

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-preview-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-this-with-a-random-32-char-secret'
$env:DOCTOR_API_KEYS='replace-this-with-a-private-agent-key'
$env:DOCTOR_HOST='127.0.0.1'
npm.cmd run web
cloudflared tunnel --url http://localhost:8080
```

Explain:

- the terminal and server must remain running;
- the generated `trycloudflare.com` URL changes after restart;
- the access code and API key must be shared privately;
- Quick Tunnel is for demo/testing, not permanent production;
- no Bitget private credential is required or accepted.

- [ ] **Step 4: Update submission positioning**

Connect the deliverable to Track 2:

- direct Agent integration through REST and TypeScript;
- low onboarding through capabilities/OpenAPI/examples;
- a real missing diagnostic layer rather than another generator;
- extensibility through closed capability definitions and the forthcoming thin
  MCP adapter.

- [ ] **Step 5: Verify docs and commit**

```powershell
rg -n "npm.cmd run web|cloudflared tunnel|api/v1/openapi.json|MockBacktester|TypeScript" README.md docs
git diff --check
git add .github/workflows/ci.yml README.md docs/SETUP.md docs/DEMO.md docs/SUBMISSION.md docs/API.md
git commit -m "docs: publish the developer platform workflow"
```

### Task 7: Final P1 Verification And Handoff

**Files:**
- Create: `src/scripts/measure-platform.ts`
- Modify: `handoff.md`

- [ ] **Step 1: Add the repeatable local latency measurement**

Build the Fastify app without listening on a port, authenticate with a test
Bearer key, perform one warmup, then use `performance.now()` around five
`app.inject()` calls for parsing and five for diagnosis. Print:

```ts
{
  samples: 5,
  parseMs: { mean: number, minimum: number, maximum: number },
  diagnosisMs: { mean: number, minimum: number, maximum: number },
}
```

Use the same Chinese RSI description and seed-42 diagnosis as the browser
acceptance. Close the app in `finally`.

- [ ] **Step 2: Run the complete gate**

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run test:web
npm.cmd run build:web
npm.cmd run test:e2e
node src/scripts/measure-platform.ts
Get-ChildItem web/dist -Recurse -File |
  Measure-Object -Property Length -Sum
git diff --check
git status --short
```

- [ ] **Step 3: Verify the MA golden bytes**

Run the MA JSON CLI and compare its UTF-8 bytes with
`examples/demo-scorecard.json`. Expected SHA-256 remains:

```text
60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90
```

Do not update the golden file if the hash differs; investigate the regression.

- [ ] **Step 4: Perform a manual tunnel smoke**

Start `npm.cmd run web`, create the Quick Tunnel, open the generated URL,
login, run one diagnosis, and verify the API key path separately with
`examples/agent-curl.ps1`. Record the temporary URL only in the handoff, not in
permanent README examples.

- [ ] **Step 5: Record exact results**

Update `handoff.md` with:

- branch and commit;
- test counts and coverage;
- Web test and Playwright counts;
- bundle size;
- login and diagnosis accessibility audit results;
- measured local parse and diagnosis latency from five repeated API calls;
- measured time from clean install to first CLI and first Web diagnosis;
- changed files by lane;
- environment variables;
- count of required and optional environment variables;
- known Quick Tunnel and Mock limitations;
- merge order and remaining P1.1 MCP task.

- [ ] **Step 6: Commit**

```powershell
git add src/scripts/measure-platform.ts handoff.md
git commit -m "docs: hand off the P1 developer platform"
```

### Task 8: Implement The Thin P1.1 MCP Adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools.ts`
- Create: `tests/mcp/tools.test.ts`
- Create: `tests/mcp/stdio-smoke.test.ts`
- Modify: `docs/API.md`

- [ ] **Step 1: Create the MCP branch after P1 merges**

```powershell
git switch -c codex/p1-mcp
npm.cmd install @modelcontextprotocol/sdk zod
```

- [ ] **Step 2: Write failing tool tests**

Inject a fake `StrategyDoctorClient` and verify three tools:

```text
list_strategy_capabilities
parse_strategy_description
diagnose_strategy
```

Assert each delegates to the REST client and returns JSON text. Invalid tool
arguments fail schema validation before any HTTP call.

- [ ] **Step 3: Verify RED**

```powershell
node --test tests/mcp/tools.test.ts tests/mcp/stdio-smoke.test.ts
```

- [ ] **Step 4: Implement the stdio server**

The MCP server imports `createStrategyDoctor` from `src/client/index.ts`. It
must not import `src/application/**`, strategy adapters, or backtest modules.
Read base URL and API key from:

```text
STRATEGY_DOCTOR_URL
STRATEGY_DOCTOR_API_KEY
```

- [ ] **Step 5: Add the script and documentation**

Add:

```json
"mcp": "node src/mcp/server.ts"
```

Document a minimal MCP configuration and the same temporary URL/API-key
limitations.

- [ ] **Step 6: Verify and commit**

```powershell
node --test tests/mcp/*.test.ts
npm.cmd run typecheck
git diff --check
git add package.json package-lock.json src/mcp tests/mcp docs/API.md
git commit -m "feat: expose Strategy Doctor through MCP"
```
