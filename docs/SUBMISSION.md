# Hackathon Submission

## Project

- **Name:** Strategy Doctor
- **Track:** Bitget AI Hackathon Track 2 - Trading Infra
- **Repository:** https://github.com/jiang4wqy/strategy-doctor
- **Demo video:** To be recorded and uploaded before final submission.

## One-Line Pitch

Strategy Doctor is the diagnostic layer for trading agents: it finds the worst reproducible market failures, explains why they happen, proposes constrained repairs, and verifies the risk-return trade-off on independent held-out scenarios.

## Why It Fits Track 2

Track 2 rewards infrastructure that other builders and agents can use. Strategy Doctor fits because it provides:

1. **Agent-ready integration:** authenticated REST API, OpenAPI, TypeScript client, CLI, and MCP adapter.
2. **Low adoption cost:** a closed strategy capability registry, typed errors, examples, and deterministic offline defaults.
3. **A real infra gap:** stress testing, explanation, repair, and validation between strategy generation and deployment.
4. **Extensibility:** strategy adapters, shared backtest engine, and adapter-driven prescription policies.

## Problem

Trading agents can generate strategies faster than teams can audit them. Before deployment, builders need to know:

- which unseen market regime breaks the strategy;
- why it failed;
- which parameters should change;
- whether the patch improved robustness;
- what return cost the patch introduced;
- whether another agent can invoke the capability safely.

## Solution

Strategy Doctor provides a deterministic diagnosis pipeline:

1. Accept a registered strategy or parse a natural-language strategy description.
2. Validate the strategy through a closed capability registry.
3. Build seeded stress candidates across five dimensions.
4. Select the highest-damage scenario per dimension.
5. Produce evaluations, deaths/survivors, risk scores, narratives, charts, and dashboard alerts.
6. Apply adapter-specific constrained parameter mutation.
7. Validate the patched strategy on independent held-out scenarios.
8. Export JSON, Markdown, dashboard metrics, OpenAPI, and submission evidence.

## Product Surface

- Protected React diagnosis workspace.
- Natural-language strategy composer with confirmation boundary.
- Market, timeframe, dataset, candle-count, and date-window controls.
- Explicit fee and slippage assumptions with turnover and cost-drag reporting.
- Five-dimension charts and scenario timeline.
- Risk dashboard with trend score, defense score, cost efficiency, and alerts.
- Model-consistency metrics for parse/narration/prescription paths.
- REST API, TypeScript client, CLI, and MCP adapter.
- Deterministic submission evidence pack.

## Bitget Integration

- Public Bitget OHLCV access is available through `BitgetBacktester`.
- The Web workflow can route an explicit diagnosis to Bitget public candles for
  `USDT` markets while preserving the same stress scenarios and repair engine.
- Frozen public snapshots keep the default demo deterministic.
- The system does not use account, balance, position, order, or private trading endpoints.
- Private Bitget credentials are not required for the default Web/API/CLI demo.

## Demo Commands

```powershell
npm.cmd ci
npm.cmd run verify
.\scripts\start-showcase.ps1
.\scripts\build-submission-pack.ps1 -Seed 42 -Candidates 6
```

If PowerShell script execution is disabled:

```powershell
.\scripts\start-showcase.cmd
.\scripts\build-submission-pack.cmd -Seed 42 -Candidates 6
```

If npm is not in PATH:

```powershell
$Node='D:\tools\node-v24.14.0-win-x64\node.exe'
& $Node node_modules\vite\bin\vite.js build --config web/vite.config.ts
& $Node src/server/start.ts
```

## Evidence Pack

Generate:

```powershell
.\scripts\build-submission-pack.ps1 -Seed 42 -Candidates 6
```

Attach or reference:

```text
artifacts/submission-pack/strategy-doctor-submission-pack.json
artifacts/submission-pack/strategy-doctor-submission-pack.md
```

The pack includes:

- run controls and deterministic evidence hash;
- five-dimension coverage for both strategies;
- risk dashboard posture and alerts;
- prescription changes;
- held-out robustness and return deltas;
- local reproduction steps.

## Reliability And Security

- Same code, examples, frozen snapshots, seed, and candidates produce reproducible diagnosis behavior.
- Coverage thresholds remain enforced: 90% lines, 80% branches, 95% functions.
- Browser sessions use signed HttpOnly cookies.
- Agents use Bearer keys.
- Auth rate limits are enabled by default and can be disabled only for trusted local demos.
- API mutations require JSON and same-origin browser requests.
- Diagnosis concurrency is limited.
- No secrets, caches, `node_modules`, or generated artifacts should be committed.

## Scope

Included:

- `ma-cross`
- `rsi-bollinger-mean-reversion`
- one symbol per diagnosis
- `1h`, `4h`, and `1d` timeframes
- offline deterministic diagnosis
- optional public Bitget candle diagnosis
- user-selectable candle limit and date window
- explicit fee/slippage execution assumptions
- equity, drawdown, turnover, and cost-drag chart data

Not included:

- arbitrary strategy DSL execution
- real trading
- account access
- balance or position reads
- order placement
- return guarantees

## Final Checklist

- [x] Five-dimensional deterministic diagnosis.
- [x] Two strategy adapters.
- [x] Shared generic risk engine.
- [x] Adapter-driven prescriptions.
- [x] Independent held-out validation.
- [x] Protected Web workspace.
- [x] REST API, OpenAPI, TypeScript client, CLI, and MCP adapter.
- [x] Risk dashboard exports.
- [x] Model-consistency metrics.
- [x] Submission evidence pack.
- [x] One-command local showcase script.
- [x] Market, timeframe, dataset, and date-window controls.
- [x] Fee/slippage, turnover, drawdown-curve, and cost-drag evidence.
- [ ] Record and upload demo video.
- [ ] Add the demo video URL to the submission form.
- [ ] Submit before the official deadline.
