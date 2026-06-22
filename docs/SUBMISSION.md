# Hackathon Submission

## Project

**Name:** Strategy Doctor
**Track:** Track 2 - Trading Infra
**Repository:** https://github.com/jiang4wqy/strategy-doctor
**Demo video:** 待录制并上传后填写

## One-line pitch

Strategy Doctor is the pre-publication risk doctor for trading Agents: before a generated strategy reaches Playbook sandbox or live execution, it proves how the strategy fails, repairs only failure-related parameters, and validates the risk-return tradeoff on independent held-out scenarios.

## Core thesis

The next bottleneck in Agentic Trading is not idea generation. Agents can already
produce strategies quickly. The missing infrastructure is an auditable layer that
answers whether a generated strategy deserves to be deployed at all.

Strategy Doctor makes that deployment decision explicit. It treats each strategy
as a bounded capability, attacks it with deterministic market stress, explains
the death causes, applies constrained parameter repair, and reports the held-out
cost of becoming safer. This is why the project is Track 2 infrastructure rather
than another trading bot.

## 为什么属于 Track 2

Track 2 关注产品能力、其他开发者能否直接接入、上手成本，以及是否解决 Agent 开发中的真实痛点。Strategy Doctor 对应这四点：

1. **直接 Agent 集成**：提供受认证 REST API 和 TypeScript Client，而不要求调用者嵌入诊断源码。
2. **低接入成本**：`/api/v1/capabilities`、`/api/v1/openapi.json`、PowerShell 示例和 TypeScript 示例形成完整上手路径。
3. **解决缺失层**：它不是又一个策略生成器，而是生成与执行之间的压力测试、解释和验证基础设施。
4. **可扩展契约**：封闭 capability definitions、`StrategyAdapter` registry 和稳定 envelope 允许增加新策略；后续薄 MCP adapter 只需复用 REST Client。

## Problem

Trading Agents can generate strategies, but commonly lack a trustworthy way to answer:

- Which unseen market regime breaks this strategy?
- Why did it fail?
- Which parameter should change?
- Did the patch improve robustness without hiding the return cost?
- Can another Agent discover and invoke this capability safely?
- Is the result backed by reproducible API usage records instead of screenshots?

## Solution

1. Accept a registered strategy directly or parse a natural-language description into a confirmable draft.
2. Convert five audited market snapshots into deterministic stress families.
3. Generate seeded candidates and select the highest-damage scenario per dimension.
4. Produce five evaluations, three style scores, failure narratives, and chart-ready data.
5. Mutate only death-related parameters.
6. Validate the patch on a separate held-out root seed.
7. Return a stable API envelope with request ID, typed errors, capabilities, and OpenAPI.

## Developer experience

Four supported entry points:

```powershell
# CLI
npm.cmd run demo

# Explicit four-strategy CLI regression
node src/cli.ts examples/trend-follower.json --style conservative --seed 42 --candidates 6
node src/cli.ts examples/rsi-bollinger.json --style conservative --seed 42 --candidates 6
node src/cli.ts examples/breakout-confirmation.json --style conservative --seed 42 --candidates 6
node src/cli.ts examples/atr-trend-breakout.json --style conservative --seed 42 --candidates 6

# Web/API
$env:DOCTOR_WEB_ACCESS_CODE='demo-code-change-me'
$env:DOCTOR_SESSION_SECRET='demo-session-secret-at-least-32-chars'
$env:DOCTOR_API_KEYS='demo-private-agent-key'
npm.cmd run web

# REST
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='demo-private-agent-key'
.\examples\agent-curl.ps1

# API verification
npm.cmd run api:check
npm.cmd run healthcheck

# TypeScript
node examples/agent-client.ts
```

## Product surface

- Protected React diagnosis workspace
- Strategy template workbench for MA, RSI/Bollinger, confirmed breakout, and ATR trend breakout
- No-login `/developer` page for API keys, OpenAPI, healthcheck, and usage record reproduction
- Natural-language strategy draft with explicit confirmation boundary
- Judge-ready verdict, Before/After repair comparison, five-dimension visual diagnosis, and local result history
- Playbook readiness score with explicit deployment gates
- REST endpoints for capability discovery, parsing, and diagnosis
- OpenAPI 3.0 document
- Native TypeScript Client and copy-ready examples
- Existing deterministic CLI

## Verifiable usage record

The official Track 2 checklist accepts API logs, sample input/output files, or
developer integration records. Strategy Doctor includes all three lightweight
forms:

- `examples/submission/api-call-log.jsonl`: 8 real REST calls generated against
  the local Web/API service, including health, capabilities, OpenAPI, natural
  language parse, and four diagnosis calls.
- `examples/submission/*-diagnose-request.json`: reproducible diagnosis inputs.
- `examples/submission/*-scorecard.json`: full deterministic scorecards.
- `examples/submission/*-diagnosis-view.json`: chart-ready Web/API outputs.

Refresh the usage record with:

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='demo-private-agent-key'
npm.cmd run healthcheck
npm.cmd run submission:usage-record
```

## Bitget integration

- Five official analyst domains are structural stress inputs.
- Public market-data MCP can refresh snapshots.
- `BitgetBacktester` can read public Bitget OHLCV without an API key.
- No account, balance, position, order, or trading endpoint is used.

The public P1 Web/API intentionally uses offline `MockBacktester`. This keeps the developer workflow deterministic and prevents a public preview from accepting exchange credentials.

## Reliability and security

- Same seed and frozen snapshots produce identical output.
- Runtime validation rejects unsupported archetypes, symbols, timeframes, and invalid parameter relationships.
- Browser sessions use signed HttpOnly cookies; Agents use Bearer keys.
- Rate limits, body limits, same-origin checks, and diagnosis concurrency limits protect the preview service.
- Anthropic and live Bitget calls are disabled in CI and opt-in locally.
- CI enforces 90% lines, 80% branches, and 95% functions, plus Web tests, typechecking, build, demo, and Playwright acceptance.
- Deployment readiness blocks Playbook publication when liquidation, excess drawdown, poor survival rate, negative held-out robustness, or unacceptable return cost appears.

## Scope

- Four registered strategies: `ma-cross`, `rsi-bollinger-mean-reversion`, `breakout-confirmation`, and `atr-trend-breakout`
- One symbol per diagnosis
- Supported timeframes: `1h`, `4h`, `1d`
- No arbitrary strategy DSL or dynamic code execution
- No real trading or performance guarantee
- Browser history remains local; no database in P1
- Quick Tunnel is temporary demo infrastructure, not production hosting

The project deliberately prefers a closed, validated capability registry over claiming unsupported arbitrary-strategy generation.

## Demo

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run web
```

Open the no-login public showcase at:

```text
http://127.0.0.1:8080/showcase
http://127.0.0.1:8080/developer
```

See [DEMO.md](DEMO.md) for the three-minute Web-first script,
[API.md](API.md) for developer integration, [SUBMISSION_EVIDENCE.md](SUBMISSION_EVIDENCE.md)
for reproducible artifacts, [DEPLOYMENT.md](DEPLOYMENT.md) for preview access
and server sharing, and [PLAYBOOK_EVIDENCE.md](PLAYBOOK_EVIDENCE.md) for the
Bitget Playbook bridge.

## Checklist

- [x] Five-dimensional deterministic diagnosis
- [x] Four strategy adapters
- [x] Prescription and independent held-out validation
- [x] Protected Web workspace
- [x] REST API and TypeScript Client
- [x] Capability discovery, OpenAPI, and examples
- [x] Automated core, Web, integration, and browser gates
- [x] Temporary team-sharing instructions
- [x] Three-minute demo script
- [x] No-login public showcase route
- [x] No-login developer/API route
- [x] Reproducible sample input/output artifacts
- [x] `.env.example`, healthcheck, and deployment templates
- [x] Submission-grade API usage record with timestamps, request IDs, and latency
- [x] Four-strategy submission artifacts including ATR trend breakout
- [x] Validated GetAgent Playbook package
- [ ] Record and upload demo video
- [ ] Fill video URL
- [ ] Fill public showcase URL
- [ ] Fill published Playbook URL after managed run
- [ ] Submit before 2026-06-24

## Deferred backlog

Kept out of the current documentation/evidence pass until the local submission
materials are stable:

- Push the two local `main` commits after GitHub credentials are available.
- Replace local `/showcase` with a public deployment URL.
- Record and upload the three-minute demo video if the protected workspace is
shown.
- Publish the Playbook package after a managed sandbox run with a private
Playbook key.
