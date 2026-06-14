# Natural-Language Strategy Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Chinese or English descriptions into a validated draft for one of the two registered strategies, with deterministic local rules and an optional constrained Anthropic fallback.

**Architecture:** A pure rule parser recognizes only the capability definitions frozen by the foundation branch, extracts supported market and parameter fields, applies adapter-owned defaults, and records every assumption. A coordinator calls Anthropic only when local parsing cannot produce an acceptable draft, validates AI JSON through `parseStrategy`, and falls back to the local result on every remote failure. Parsing never triggers diagnosis.

**Tech Stack:** Node.js 24 native TypeScript, native `fetch`, `node:test`, existing strategy registry and runtime parser.

---

### Task 1: Define Draft Contracts And Deterministic Defaults

**Files:**
- Create: `src/natural-language/errors.ts`
- Create: `src/natural-language/defaults.ts`
- Create: `tests/natural-language/defaults.test.ts`

- [ ] **Step 1: Write failing default tests**

Assert:

```ts
const strategy = buildDefaultStrategy(
  'rsi-bollinger-mean-reversion',
  { symbol: 'BTCUSDT', timeframe: '4h' },
);
assert.equal(strategy.params.rsiPeriod, 10);
assert.equal(strategy.params.bollingerPeriod, 14);
assert.equal(strategy.params.trendFilterPeriod, 30);
assert.deepEqual(strategy.universe, ['BTCUSDT']);
```

Also assert every default parameter comes from
`strategyRegistry.getDefinition(archetype)` rather than a local constant table.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/natural-language/defaults.test.ts
```

- [ ] **Step 3: Define the parser error**

Import `StrategyDraft`, `DraftAssumption`, and `DraftWarning` from
`src/platform/contracts.ts`. Create only the parser-specific error:

```ts
export class DescriptionParseError extends Error {
  constructor(
    readonly code:
      | 'AMBIGUOUS_DESCRIPTION'
      | 'UNSUPPORTED_STRATEGY_DESCRIPTION',
    message: string,
    readonly aiFallbackAllowed = false,
  ) {
    super(message);
    this.name = 'DescriptionParseError';
  }
}
```

- [ ] **Step 4: Build defaults from capability definitions**

Export:

```ts
export function buildDefaultStrategy(
  archetype: StrategyArchetype,
  market?: { symbol?: string; timeframe?: string },
): Strategy
```

Use `BTCUSDT` and `4h` only when the description omitted those fields. Use the
definition example identity with a generated deterministic ID based on the
archetype, not time or randomness.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/natural-language/defaults.test.ts
npm.cmd run typecheck:core
git add src/natural-language/errors.ts src/natural-language/defaults.ts tests/natural-language/defaults.test.ts
git commit -m "feat: define natural-language strategy drafts"
```

### Task 2: Implement The Chinese And English Rule Parser

**Files:**
- Create: `src/natural-language/rules.ts`
- Create: `tests/natural-language/rules.test.ts`

- [ ] **Step 1: Write failing MA recognition tests**

Use descriptions:

```text
BTCUSDT 1h moving average crossover, fast MA 8, slow MA 30, 5x leverage,
10% stop loss, 60% position.

BTC 一小时均线交叉，快线 8，慢线 30，5 倍杠杆，止损 10%，仓位 60%。
```

Assert both produce `ma-cross` and equal numeric parameters.

- [ ] **Step 2: Write failing RSI/Bollinger tests**

Use:

```text
BTC 4h RSI 10 with Bollinger period 14 and 1.75 standard deviations,
oversold 30, overbought 70, trend filter 30 with 5% threshold.

BTC 四小时 RSI 10 配合布林带 14、1.75 倍标准差，超卖 30、超买 70，
趋势过滤周期 30，偏离阈值 5%。
```

Assert both map to `rsi-bollinger-mean-reversion`.

- [ ] **Step 3: Write failing ambiguity and unsupported tests**

Assert these stable failures:

```ts
assert.throws(
  () => parseWithRules('combine MA crossover and RSI Bollinger'),
  (error: unknown) => (
    error instanceof DescriptionParseError
    && error.code === 'AMBIGUOUS_DESCRIPTION'
  ),
);

assert.throws(
  () => parseWithRules('write and execute a custom grid trading bot'),
  (error: unknown) => (
    error instanceof DescriptionParseError
    && error.code === 'UNSUPPORTED_STRATEGY_DESCRIPTION'
  ),
);
```

- [ ] **Step 4: Verify RED**

```powershell
node --test tests/natural-language/rules.test.ts
```

- [ ] **Step 5: Implement recognition**

Use normalized lowercase text and keyword groups:

```ts
const MA_TERMS = [
  'ma', 'moving average', 'crossover', 'trend following',
  '均线', '交叉', '趋势跟随',
];
const RSI_TERMS = ['rsi', 'relative strength', '相对强弱'];
const BOLLINGER_TERMS = [
  'bollinger', 'mean reversion', 'overbought', 'oversold',
  '布林', '均值回归', '超买', '超卖',
];
```

RSI/Bollinger requires one RSI term and one Bollinger group term. If both
archetypes match, throw ambiguity. Reject descriptions requesting custom code,
grid, martingale, arbitrage, or unsupported execution logic with
`aiFallbackAllowed: false`. An otherwise unrecognized description uses
`UNSUPPORTED_STRATEGY_DESCRIPTION` with `aiFallbackAllowed: true`.

- [ ] **Step 6: Implement extraction**

Extract:

- `BTCUSDT` or `BTC` into `BTCUSDT`;
- `1h`, `4h`, `1d`, `一小时`, `四小时`, `日线`;
- `x leverage` or `倍杠杆`;
- stop-loss and position percentages divided by 100;
- MA fast/slow periods;
- RSI, overbought, oversold, Bollinger period/std-dev, trend period/threshold.

Start with `buildDefaultStrategy`, apply explicit fields, and call
`parseStrategy` on the final object.

- [ ] **Step 7: Record assumptions and confidence**

Every non-explicit field becomes an assumption. Confidence is calculated from
the recognition strength and explicit extracted fields:

```ts
const recognitionConfidence = archetype === 'ma-cross'
  ? (matchedMaTerms >= 2 ? 0.78 : 0.68)
  : 0.80;
const confidence = Math.min(
  0.98,
  recognitionConfidence + explicitFieldCount * 0.02,
);
```

Return a `LOW_CONFIDENCE` warning only when confidence is below `0.75`.

- [ ] **Step 8: Verify GREEN and commit**

```powershell
node --test tests/natural-language/rules.test.ts
npm.cmd run typecheck:core
git add src/natural-language/rules.ts tests/natural-language/rules.test.ts
git commit -m "feat: parse supported strategies from local language rules"
```

### Task 3: Add The Constrained Anthropic Fallback

**Files:**
- Create: `src/natural-language/anthropic.ts`
- Create: `tests/natural-language/anthropic.test.ts`

- [ ] **Step 1: Write failing disabled and success tests**

Assert disabled configuration never calls fetch. For success, mock a Messages
API response whose first text block contains JSON for one supported strategy.
Assert the request contains only the two capability definitions and asks for
JSON without source code.

- [ ] **Step 2: Write failing safety tests**

Assert malformed JSON, unknown archetype, invalid parameters, HTTP 503, and an
abort timeout return `undefined`, never an unvalidated strategy.

- [ ] **Step 3: Verify RED**

```powershell
node --test tests/natural-language/anthropic.test.ts
```

- [ ] **Step 4: Implement the fallback**

Export:

```ts
export interface AnthropicParserOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export async function parseWithAnthropic(
  description: string,
  options?: AnthropicParserOptions,
): Promise<StrategyDraft | undefined>
```

Enable only when:

```text
DOCTOR_NL_AI_ENABLED=1
ANTHROPIC_API_KEY is present
DOCTOR_NL_MODEL is present
```

Use a 3-second default timeout. Require the model JSON to contain:

```ts
{
  strategy: unknown;
  explicitFields: string[];
}
```

Pass `strategy` through `parseStrategy`. For each field absent from
`explicitFields`, require the value to equal its registered default and add a
default assumption. Reject responses that smuggle a non-default value into a
non-explicit field. Never evaluate generated code.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
node --test tests/natural-language/anthropic.test.ts
npm.cmd run typecheck:core
git add src/natural-language/anthropic.ts tests/natural-language/anthropic.test.ts
git commit -m "feat: add constrained Anthropic strategy parsing"
```

### Task 4: Coordinate Local-First Parsing And Failure Fallback

**Files:**
- Create: `src/natural-language/parse.ts`
- Create: `tests/natural-language/parse.test.ts`

- [ ] **Step 1: Write failing coordinator tests**

Assert:

1. A valid local MA description returns `source: 'rules'` without calling AI.
2. An unrecognized local description with `aiFallbackAllowed: true` calls AI
   when enabled and returns a validated AI draft.
3. A request for grid, martingale, arbitrage, or custom executable code never
   calls AI and preserves the local structured error.
4. If a low-confidence local draft triggers AI and AI fails, the local draft
   is returned with an `AI_FALLBACK_FAILED` warning.
5. Descriptions longer than 2,000 characters fail before either parser runs.
6. Parsing does not import or call `diagnoseStrategy`.

- [ ] **Step 2: Verify RED**

```powershell
node --test tests/natural-language/parse.test.ts
```

- [ ] **Step 3: Implement the coordinator**

Export:

```ts
export interface ParseDescriptionOptions extends AnthropicParserOptions {
  rules?: typeof parseWithRules;
  anthropic?: typeof parseWithAnthropic;
}

export async function parseStrategyDescription(
  description: string,
  options: ParseDescriptionOptions = {},
): Promise<StrategyDraft>
```

Trim input, require 1-2,000 characters, use local rules first, and call AI only
after a local failure whose `aiFallbackAllowed` is true or confidence below
`0.75`. If AI fails and a local draft exists, return it with a warning;
otherwise preserve the original local error code.

- [ ] **Step 4: Verify the complete lane**

```powershell
node --test tests/natural-language/*.test.ts
npm.cmd run typecheck:core
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add src/natural-language/parse.ts tests/natural-language/parse.test.ts
git commit -m "feat: coordinate local-first strategy parsing"
```
