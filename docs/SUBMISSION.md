# Hackathon Submission

## Project

**Name:** Strategy Doctor
**Track:** Track 2 - Trading Infra
**Repository:** https://github.com/jiang4wqy/strategy-doctor
**Demo video:** 待录制并上传后填写

## One-line pitch

Strategy Doctor is the diagnostic layer for trading Agents: it discovers a strategy's worst reproducible market failures, explains the causes, proposes constrained parameter fixes, and validates the risk-return tradeoff on independent held-out scenarios.

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

# Web/API
$env:DOCTOR_WEB_ACCESS_CODE='demo-code-change-me'
$env:DOCTOR_SESSION_SECRET='demo-session-secret-at-least-32-chars'
$env:DOCTOR_API_KEYS='demo-private-agent-key'
npm.cmd run web

# REST
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='demo-private-agent-key'
.\examples\agent-curl.ps1

# TypeScript
node examples/agent-client.ts
```

## Product surface

- Protected React diagnosis workspace
- Natural-language strategy draft with explicit confirmation boundary
- Five-dimension visual diagnosis and local result history
- REST endpoints for capability discovery, parsing, and diagnosis
- OpenAPI 3.0 document
- Native TypeScript Client and copy-ready examples
- Existing deterministic CLI

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

## Scope

- Two registered strategies: `ma-cross` and `rsi-bollinger-mean-reversion`
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

See [DEMO.md](DEMO.md) for the three-minute Web-first script and [API.md](API.md) for developer integration.

## Checklist

- [x] Five-dimensional deterministic diagnosis
- [x] Two strategy adapters
- [x] Prescription and independent held-out validation
- [x] Protected Web workspace
- [x] REST API and TypeScript Client
- [x] Capability discovery, OpenAPI, and examples
- [x] Automated core, Web, integration, and browser gates
- [x] Temporary team-sharing instructions
- [x] Three-minute demo script
- [ ] Record and upload demo video
- [ ] Fill video URL
- [ ] Submit before 2026-06-24

## P1.1

The next integration surface is a thin MCP adapter exposing:

- `list_strategy_capabilities`
- `parse_strategy_description`
- `diagnose_strategy`

It will call the existing REST Client rather than duplicate diagnosis logic.
