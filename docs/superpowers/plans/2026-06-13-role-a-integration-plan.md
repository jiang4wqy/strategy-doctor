# Role A Integration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the A-owned contract, registry, parser, and MA adapter boundaries so the C and B branches can integrate without parser branching or reverse module dependencies.

**Architecture:** Keep `Strategy` as the closed two-archetype discriminated union and make `StrategyByArchetype` preserve that discrimination for both single and union archetype inputs. Route runtime parsing through one generic registry call. Keep all MA-specific decisions, mutation policy, jitter, and labels inside the MA adapter while leaving the existing C-owned prescription implementation untouched until C migrates it.

**Tech Stack:** Node.js 24 native TypeScript, strict TypeScript, `node:test`, GitHub Actions, no new dependencies.

**Execution status:** Tasks 1-5 completed on 2026-06-13. Full verification
passed and the golden JSON remained byte-for-byte identical.

---

### Task 1: Preserve The Strategy Discriminated Union

**Files:**
- Modify: `tests/contracts.test.ts`
- Modify: `src/contracts.ts`

- [ ] **Step 1: Add a type-narrowing regression test**

Import `StrategyArchetype` and `StrategyByArchetype`, then add:

```ts
function signalPeriod(
  strategy: StrategyByArchetype<StrategyArchetype>,
): number {
  return strategy.archetype === 'ma-cross'
    ? strategy.params.fastMA
    : strategy.params.rsiPeriod;
}

assert.equal(signalPeriod(movingAverage), 8);
assert.equal(signalPeriod(meanReversion), 14);
```

- [ ] **Step 2: Run typecheck and verify RED**

Run:

```powershell
npm.cmd run typecheck
```

Expected: FAIL because the current structural
`StrategyByArchetype<StrategyArchetype>` does not correlate `archetype` with
`params`.

- [ ] **Step 3: Implement the discriminated lookup**

Replace the structural alias with:

```ts
export type StrategyByArchetype<A extends StrategyArchetype> =
  Extract<Strategy, { archetype: A }>;
```

- [ ] **Step 4: Run the contract test and typecheck**

Run:

```powershell
node --test tests/contracts.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/contracts.ts tests/contracts.test.ts
git commit -m "refactor: preserve strategy union narrowing"
```

### Task 2: Remove Parser Archetype Branching

**Files:**
- Modify: `tests/strategy/registry.test.ts`
- Modify: `src/strategy/parse.ts`

- [ ] **Step 1: Add a union-archetype registry test**

Construct the existing MA registry and call it through a variable typed as
`StrategyArchetype`:

```ts
const archetype: StrategyArchetype = 'ma-cross';
const strategy = registry.parse(archetype, base, params);

assert.equal(strategy.archetype, 'ma-cross');
if (strategy.archetype === 'ma-cross') {
  assert.equal(strategy.params.fastMA, 2);
}
```

This protects the generic union return that `parseStrategy` needs.

- [ ] **Step 2: Run focused tests**

Run:

```powershell
node --test tests/strategy/registry.test.ts tests/strategy/parse.test.ts
npm.cmd run typecheck
```

Expected: PASS after Task 1. The test establishes the API before the parser
refactor.

- [ ] **Step 3: Replace the hardcoded parser branch**

Change:

```ts
return archetype === 'ma-cross'
  ? strategyRegistry.parse('ma-cross', base, strategy.params)
  : strategyRegistry.parse(
    'rsi-bollinger-mean-reversion',
    base,
    strategy.params,
  );
```

to:

```ts
return strategyRegistry.parse(archetype, base, strategy.params);
```

Keep the existing unsupported-adapter error translation.

- [ ] **Step 4: Run parser, registry, and type checks**

Run:

```powershell
node --test tests/strategy/registry.test.ts tests/strategy/parse.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/strategy/parse.ts tests/strategy/registry.test.ts
git commit -m "refactor: route parser through generic registry"
```

### Task 3: Make The MA Adapter Own Its Policy

**Files:**
- Create: `tests/architecture/strategy-boundaries.test.ts`
- Modify: `tests/strategy/registry.test.ts`
- Modify: `src/strategy/adapters/ma-cross.ts`

- [ ] **Step 1: Write the failing architecture test**

Add:

```ts
test('strategy adapters do not import prescription implementation modules', () => {
  const adapterPath = fileURLToPath(
    new URL('../../src/strategy/adapters/ma-cross.ts', import.meta.url),
  );
  const source = readFileSync(adapterPath, 'utf8');

  assert.doesNotMatch(source, /prescribe\//);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/architecture/strategy-boundaries.test.ts
```

Expected: FAIL because `ma-cross.ts` imports
`../../prescribe/mutations.ts`.

- [ ] **Step 3: Expand adapter policy behavior tests**

In `tests/strategy/registry.test.ts`, assert:

- liquidation halves leverage and tightens stop loss;
- drawdown reduces position size;
- stop-loss bleed slows both MA periods;
- combined causes preserve rationale order;
- selected-field jitter is deterministic and preserves all parser invariants.

- [ ] **Step 4: Implement policy inside the adapter**

Add private `targetedPatch` and `jitterParams` functions to
`src/strategy/adapters/ma-cross.ts` using the exact existing formulas:

```ts
patch.leverage = Math.max(1, Math.round(params.leverage / 2));
patch.stopLossPct = Math.min(
  params.stopLossPct,
  Number((0.8 / patch.leverage / 2).toFixed(3)),
);
patch.positionPct = Number((params.positionPct * 0.7).toFixed(2));
patch.fastMA = Math.round(params.fastMA * 1.5);
patch.slowMA = Math.round(params.slowMA * 1.5);
```

Jitter remains the existing deterministic `0.8 + random() * 0.4` range and
preserves parser bounds.

Do not modify `src/prescribe/**`; C owns the later consumer migration.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
node --test tests/architecture/strategy-boundaries.test.ts tests/strategy/registry.test.ts tests/prescribe/mutations.test.ts
npm.cmd run typecheck
```

Expected: PASS, including the unchanged legacy prescription tests.

- [ ] **Step 6: Commit**

```powershell
git add src/strategy/adapters/ma-cross.ts tests/strategy/registry.test.ts tests/architecture/strategy-boundaries.test.ts
git commit -m "refactor: make ma adapter own strategy policy"
```

### Task 4: Record The A Handoff

**Files:**
- Modify: `handoff.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Document A completion**

Record that A has completed:

- the discriminated contract;
- immutable registry;
- generic registry-backed parser;
- self-contained MA adapter policy;
- MA compatibility evidence.

Record that A still waits for:

- C: shared engine and adapter-driven prescription consumer;
- B: indicators and RSI/Bollinger adapter;
- D: dual-strategy CLI acceptance and materials.

- [ ] **Step 2: Clarify cross-branch integration**

State that B must not edit `registry.ts`; after B's adapter PR is ready, A owns
the small registration commit. State that C owns migration of
`prescribe/evolve.ts` to call adapter policy.

- [ ] **Step 3: Check documentation consistency**

Run:

```powershell
rg -n "integration branch|feat/multi-strategy-integration|A.*尚未|MA adapter.*尚未" CONTRIBUTING.md handoff.md
git diff --check
```

Expected: no stale active-workflow statements and no whitespace errors.

- [ ] **Step 4: Commit**

```powershell
git add CONTRIBUTING.md handoff.md docs/superpowers/plans/2026-06-13-role-a-integration-plan.md
git commit -m "docs: record role a integration handoff"
```

### Task 5: Verify Compatibility And Publish

**Files:**
- No production changes.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm.cmd run verify
git diff --check
git status --short
```

Expected:

- 0 failed tests;
- coverage thresholds pass;
- TypeScript passes;
- offline demo passes;
- clean worktree.

- [ ] **Step 2: Verify the golden JSON**

Generate seed 42 JSON with six candidates and compare it byte-for-byte with
`examples/demo-scorecard.json`. Both SHA-256 hashes must equal:

```text
60745EB1377E3B2160311C8101E72E1731329AA3DF173D75C4672616DD455E90
```

- [ ] **Step 3: Push the A branch**

```powershell
git push origin feat/ma-adapter-integration
```

Expected: the remote A branch advances; `main` remains unchanged.
