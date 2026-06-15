# React Reference Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reference Web client that turns a natural-language strategy description into a confirmed structured request and a visual diagnosis workspace.

**Architecture:** The React application is a thin client of `/api/v1/*`. It keeps API calls in one module, stores only recent reports in browser `localStorage`, and renders chart-ready data returned by the server without recomputing diagnosis semantics. During parallel development, Mock Service Worker is not added; tests inject a small `ApiClient` interface and deterministic fixtures so the Web lane does not depend on unfinished server files.

**Tech Stack:** React, TypeScript, Vite, Apache ECharts modular imports, Vitest, Testing Library, browser `fetch`.

---

### Task 1: Scaffold The Web Application And API Boundary

**Files:**
- Create: `web/index.html`
- Create: `web/vite.config.ts`
- Create: `web/vitest.config.ts`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/api/types.ts`
- Create: `web/src/api/client.ts`
- Create: `web/src/test/fixtures.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/api/client.test.ts`

- [ ] **Step 1: Write failing client tests**

Test an injected `fetch`:

```ts
const client = createApiClient({
  fetch: async () => new Response(JSON.stringify({
    apiVersion: 'v1',
    requestId: 'req-1',
    data: capabilityFixture,
  }), { status: 200 }),
});

assert.deepEqual((await client.capabilities()).data, capabilityFixture);
```

Also assert:

```ts
await assert.rejects(
  () => client.diagnose(requestFixture),
  (error: unknown) => (
    error instanceof StrategyDoctorWebError
    && error.code === 'RATE_LIMITED'
    && error.requestId === 'req-2'
  ),
);
```

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test:web -- --run web/src/api/client.test.ts
```

- [ ] **Step 3: Add the Web API boundary**

Import the stable JSON boundary with `import type` from
`../../../src/platform/contracts.ts`. Define only the browser client interface:

```ts
export interface ApiClient {
  login(accessCode: string): Promise<void>;
  logout(): Promise<void>;
  capabilities(): Promise<ApiEnvelope<readonly AnyStrategyDefinition[]>>;
  parse(description: string): Promise<ApiEnvelope<StrategyDraft>>;
  diagnose(request: DiagnoseRequest): Promise<ApiEnvelope<DiagnosisView>>;
}
```

Copy property names exactly; do not add Web-only diagnosis fields or parameter
metadata.

- [ ] **Step 4: Implement `createApiClient`**

Use relative `/api/v1` URLs and:

```ts
credentials: 'same-origin'
```

for every request. Mutation endpoints send JSON content type. Parse the common
success/error envelope and throw `StrategyDoctorWebError`.

- [ ] **Step 5: Configure Vite and Vitest**

Set Vite `root` to the `web` directory, output to `web/dist`, and proxy
`/api` to `http://127.0.0.1:8080`. Vitest uses `jsdom` and
`web/src/test/setup.ts`.

- [ ] **Step 6: Add the minimal root component**

Render:

```tsx
<main>
  <h1>Strategy Doctor</h1>
  <p>Adversarial diagnosis for trading strategies.</p>
</main>
```

- [ ] **Step 7: Verify GREEN and commit**

```powershell
npm.cmd run test:web -- --run web/src/api/client.test.ts
npm.cmd run typecheck:web
npm.cmd run build:web
git add web
git commit -m "feat: scaffold the React API client"
```

### Task 2: Add Access-Code Login And Application State

**Files:**
- Create: `web/src/state/app-state.ts`
- Create: `web/src/state/app-state.test.ts`
- Create: `web/src/components/LoginScreen.tsx`
- Create: `web/src/components/LoginScreen.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing state tests**

Assert the reducer transitions:

```ts
signedOut -> describing -> confirming -> diagnosing -> result
```

and that parse or diagnosis errors remain visible without discarding the
current description/draft.

- [ ] **Step 2: Write failing login tests**

Render with a fake client. Enter an access code, submit, assert
`client.login('team-code')`, and verify the description workspace appears.
Rejected login displays the API message and keeps the form usable.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:web -- --run web/src/state/app-state.test.ts web/src/components/LoginScreen.test.tsx
```

- [ ] **Step 4: Implement the reducer**

Use a discriminated state:

```ts
type AppState =
  | { status: 'signedOut'; error?: string }
  | { status: 'describing'; description: string; capabilities: readonly AnyStrategyDefinition[]; error?: string }
  | { status: 'confirming'; description: string; capabilities: readonly AnyStrategyDefinition[]; draft: StrategyDraft; error?: string }
  | { status: 'diagnosing'; description: string; capabilities: readonly AnyStrategyDefinition[]; request: DiagnoseRequest }
  | { status: 'result'; description: string; capabilities: readonly AnyStrategyDefinition[]; request: DiagnoseRequest; requestId: string; view: DiagnosisView; error?: string };
```

Do not introduce a global state library.

- [ ] **Step 5: Implement login**

The form has a password input, submit button, loading state, and inline error.
On success call `client.capabilities()` once and enter `describing`.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:web -- --run web/src/state/app-state.test.ts web/src/components/LoginScreen.test.tsx
npm.cmd run typecheck:web
git add web/src/state web/src/components/LoginScreen.tsx web/src/components/LoginScreen.test.tsx web/src/App.tsx
git commit -m "feat: add protected Web application state"
```

### Task 3: Add Description Parsing And Parameter Confirmation

**Files:**
- Create: `web/src/components/StrategyComposer.tsx`
- Create: `web/src/components/StrategyComposer.test.tsx`
- Create: `web/src/components/StrategyConfirmation.tsx`
- Create: `web/src/components/StrategyConfirmation.test.tsx`
- Create: `web/src/components/ParameterField.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing composer tests**

Enter a Chinese description, submit, and assert:

```ts
client.parse('BTC 四小时 RSI 10 配合布林带 14')
```

Verify unsupported responses show the stable message and do not start a
diagnosis.

- [ ] **Step 2: Write failing confirmation tests**

Render an RSI draft with assumptions. Assert:

- assumptions and warnings are visible;
- every field is populated from the draft;
- editing `leverage` changes the structured strategy;
- invalid values show field errors;
- clicking `Confirm and diagnose` calls `client.diagnose` only after explicit
  confirmation.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:web -- --run web/src/components/StrategyComposer.test.tsx web/src/components/StrategyConfirmation.test.tsx
```

- [ ] **Step 4: Implement the composer**

Use a textarea with a 2,000-character maximum and one example for each
supported archetype. Keep the text after parse failure so the user can correct
it.

- [ ] **Step 5: Implement metadata-driven confirmation**

Render fields from the capability definition for
`draft.strategy.archetype`. Do not hardcode MA/RSI parameter arrays in the
component. Validate edited strategies client-side using capability min/max
bounds, then send:

```ts
{
  strategy,
  style: selectedStyle,
  seed: 42,
  candidates: 6,
}
```

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:web -- --run web/src/components/StrategyComposer.test.tsx web/src/components/StrategyConfirmation.test.tsx
npm.cmd run typecheck:web
git add web/src/components web/src/App.tsx
git commit -m "feat: confirm parsed strategy parameters"
```

### Task 4: Add Modular ECharts Components

**Files:**
- Create: `web/src/charts/echarts.ts`
- Create: `web/src/charts/use-chart.ts`
- Create: `web/src/charts/EquityComparisonChart.tsx`
- Create: `web/src/charts/RiskRadarChart.tsx`
- Create: `web/src/charts/ScenarioTimelineChart.tsx`
- Create: `web/src/charts/ParameterChangeChart.tsx`
- Create: `web/src/charts/charts.test.tsx`

- [ ] **Step 1: Write failing chart-option tests**

Mock `echarts.init`. Render every component and assert:

```ts
setOption({ series: expect.any(Array) }, { notMerge: true })
```

Verify:

- equity chart defaults to `charts.defaultHeldOutDimension`;
- a dimension selector switches original/patched series;
- radar has five named dimensions;
- timeline order follows server order;
- parameter chart contains only changed fields;
- `resize()` runs after a ResizeObserver callback;
- `dispose()` runs on unmount.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test:web -- --run web/src/charts/charts.test.tsx
```

- [ ] **Step 3: Register only required ECharts modules**

Register:

```ts
LineChart
RadarChart
BarChart
GridComponent
TooltipComponent
LegendComponent
DatasetComponent
CanvasRenderer
```

Do not import the complete `echarts` bundle.

- [ ] **Step 4: Implement the chart hook**

`useChart` initializes once, updates with `notMerge: true`, observes resize,
and disposes on unmount.

- [ ] **Step 5: Implement four chart families**

Charts consume `DiagnosisView.charts` directly. They may format labels and
percentages, but they must not recalculate risk, sorting, or parameter
selection.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:web -- --run web/src/charts/charts.test.tsx
npm.cmd run typecheck:web
git add web/src/charts
git commit -m "feat: visualize diagnosis chart data"
```

### Task 5: Build The Diagnosis Workspace And Exports

**Files:**
- Create: `web/src/components/SummaryCards.tsx`
- Create: `web/src/components/ScenarioTable.tsx`
- Create: `web/src/components/DeveloperPanel.tsx`
- Create: `web/src/components/DiagnosisWorkspace.tsx`
- Create: `web/src/components/DiagnosisWorkspace.test.tsx`
- Create: `web/src/export/report.ts`
- Create: `web/src/export/report.test.ts`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing workspace tests**

Assert a result renders:

- risk score, worst drawdown, total trades, robustness gain, return delta;
- four chart component regions;
- all treatment evaluations;
- prescription rationale;
- confirmed Strategy JSON;
- a curl request;
- a TypeScript client example;
- OpenAPI link and request ID.

- [ ] **Step 2: Write failing export tests**

Assert `exportDiagnosisJson` includes request and view, and
`renderDiagnosisMarkdown` contains summary, five dimensions, prescription, and
held-out trade-off without claiming guaranteed improvement.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:web -- --run web/src/components/DiagnosisWorkspace.test.tsx web/src/export/report.test.ts
```

- [ ] **Step 4: Implement the workspace**

Use semantic sections and buttons. Keep detailed evaluations collapsible. The
developer panel constructs examples from the confirmed request, never from the
original description.

- [ ] **Step 5: Implement browser downloads**

Create Blob URLs for JSON and Markdown, click a temporary anchor, revoke the
URL immediately, and use filenames:

```text
strategy-doctor-<strategy-id>.json
strategy-doctor-<strategy-id>.md
```

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:web -- --run web/src/components/DiagnosisWorkspace.test.tsx web/src/export/report.test.ts
npm.cmd run typecheck:web
git add web/src/components web/src/export web/src/App.tsx
git commit -m "feat: present and export diagnosis results"
```

### Task 6: Add Local-Only History

**Files:**
- Create: `web/src/history/storage.ts`
- Create: `web/src/history/storage.test.ts`
- Create: `web/src/components/HistoryPanel.tsx`
- Create: `web/src/components/HistoryPanel.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing storage tests**

Assert:

```ts
saveDiagnosis(record)
loadDiagnoses()
deleteDiagnosis(record.id)
```

preserve newest-first order and never retain more than ten records. Simulate a
quota error, verify the oldest record is removed, and verify a second failure
returns `{ saved: false }` without throwing.

- [ ] **Step 2: Write failing history UI tests**

Save a result, reload the component, reopen it, export it, delete it, and assert
that no API method is called during history operations.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:web -- --run web/src/history/storage.test.ts web/src/components/HistoryPanel.test.tsx
```

- [ ] **Step 4: Implement storage**

Use one key:

```ts
const HISTORY_KEY = 'strategy-doctor:diagnoses:v1';
```

Parse defensively. Invalid data returns an empty list. Save the full
`StoredDiagnosis` contract from the design.

- [ ] **Step 5: Integrate history**

After a diagnosis succeeds, save its `requestId` with the record locally. Show
a non-blocking warning when the record could not be persisted. Reopening
history transitions directly to `result` and restores the developer panel's
request ID.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:web -- --run web/src/history/storage.test.ts web/src/components/HistoryPanel.test.tsx
npm.cmd run typecheck:web
git add web/src/history web/src/components/HistoryPanel.tsx web/src/components/HistoryPanel.test.tsx web/src/App.tsx
git commit -m "feat: keep diagnosis history in the browser"
```

### Task 7: Apply The Approved Responsive Visual Direction

**Files:**
- Create: `web/src/styles/tokens.css`
- Create: `web/src/styles/global.css`
- Create: `web/src/styles/layout.css`
- Modify: `web/src/main.tsx`
- Modify: `web/src/App.tsx`
- Modify: Web components requiring class names
- Create: `web/src/App.test.tsx`

- [ ] **Step 1: Write the acceptance component test**

Complete login, parse, confirmation, and diagnosis using a fake client. Assert
the visible sequence and that all major workspace regions have accessible
names.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test:web -- --run web/src/App.test.tsx
```

- [ ] **Step 3: Add design tokens**

Use CSS custom properties for dark navy surfaces, cool neutral text, green
improvement, amber warning, red risk, spacing, radius, and chart panel borders.
Do not add a CSS framework.

- [ ] **Step 4: Implement responsive layout**

Desktop uses a fixed-width left confirmation rail and flexible results area.
At 960px stack confirmation above results. At 640px use one column, reduce
card density, and keep charts at a minimum height of 280px.

- [ ] **Step 5: Add accessibility behavior**

Use visible focus states, form labels, `aria-live` for async errors, textual
values beside color indicators, and buttons with explicit names.

- [ ] **Step 6: Verify the full Web lane**

```powershell
npm.cmd run test:web
npm.cmd run typecheck:web
npm.cmd run build:web
git diff --check
```

- [ ] **Step 7: Commit**

```powershell
git add web
git commit -m "feat: finish the responsive diagnosis workspace"
```
