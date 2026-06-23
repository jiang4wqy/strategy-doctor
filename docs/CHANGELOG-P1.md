# Strategy Doctor P1 Change Log

## Branch

- Current local branch: `codex/p1-mcp`
- Target PR base: `main`
- Language requirement: user-facing product and submission materials are in
  English.

## Changes since `final-polish`

### Judge and submission experience

- Added a public judge page at `/judge`.
- Added a tutorial and QA page at `/learn`.
- Added a Playbook diagnosis bridge at `/api/v1/playbook/diagnoses`.
- Added MCP support for diagnosing Playbook prompts or structured exports.
- Added reviewer-oriented submission pack output.

### Product workflow

- Added a protected workspace flow with back navigation.
- Added local diagnosis history.
- Added random strategy generation.
- Added post-result parameter editing.
- Added baseline comparison between the original run and a revised run.
- Expanded sample strategy prompts beyond the original BTC-only examples.

### Market and dataset controls

- Added strategy-level `backtest` controls:
  - `source`: `offline-synthetic` or `bitget-public`
  - `candleLimit`: 50 to 1000
  - optional `startDate`
  - optional `endDate`
- Added Web controls for symbol, timeframe, data source, candle limit, and date
  window.
- Added selectable symbols: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`,
  `DOGEUSDT`.
- Added selectable timeframes: `1h`, `4h`, `1d`.
- Fixed random strategy generation so it only emits parser-supported
  timeframes.

### Execution quality controls

- Added explicit strategy execution assumptions:
  - fee rate
  - slippage
- Added engine-level turnover accounting.
- Added fee drag and slippage drag metrics.
- Added drawdown curves alongside equity curves.
- Added Web summary cards for turnover and cost drag.
- Added execution-quality and drawdown chart data for professional reports.

### Bitget public data path

- Extended `BitgetBacktester` to pass candle limit and optional time-window
  controls to the candle source.
- Routed Web/API diagnoses to `BitgetBacktester` only when
  `strategy.backtest.source` is `bitget-public`.
- Kept deterministic offline data as the default judge and regression path.

### Documentation

- Updated API documentation with `strategy.backtest`.
- Updated the hackathon submission note.
- Added competitive gap analysis against Freqtrade, RQAlpha, Catalyst/Zipline,
  and Bitget public candle APIs.

## Verification

- `npm run verify`
  - 269 core tests discovered
  - 267 passed
  - 2 skipped
  - coverage: 94.38% lines, 86.98% branches, 97.16% functions
  - offline CLI demo completed
- `npm run test:web`
  - 13 Web test files passed
  - 24 Web tests passed
- Web production build completed.
- Playwright E2E completed:
  - judge page
  - learn page
  - MA workflow
  - RSI workflow
  - accessibility smoke test

## Known limits

- The system does not read private Bitget account strategies yet.
- Private Playbook or Bitget account inventory should be added only after the
  official read-only API contract is confirmed.
- Secrets must stay in environment variables and must never be committed.
- Multi-symbol portfolio diagnosis is still a P2 upgrade.
- Public-candle dataset fingerprinting is still a P2 upgrade.
