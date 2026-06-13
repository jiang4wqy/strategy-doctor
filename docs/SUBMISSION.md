# Hackathon Submission

## Project

**Name:** Strategy Doctor
**Track:** Track 2 - Trading Infra
**Repository:** https://github.com/jiang4wqy/strategy-doctor
**Demo video:** 待录制并上传后填写

## One-line pitch

Strategy Doctor red-teams trading strategies across five Bitget analyst dimensions, finds their worst reproducible failure scenarios, prescribes targeted parameter fixes, and reports the honest robustness-versus-return result on an independent held-out set.

## Problem

Trading tools create strategies but rarely explain which unseen regime can break them, why they fail, which parameter should change, or whether a patch generalizes.

## Solution

1. Convert five audited snapshots into stress families.
2. Generate six deterministic candidates per dimension.
3. Select the highest damage scenario.
4. Produce five evaluations, three style scores, and failure narratives.
5. Mutate only death-related parameters.
6. Validate on a separate held-out root seed.

## Bitget integration

- Five official analyst domains are structural inputs.
- Public market-data MCP refreshes snapshots.
- `BitgetBacktester` uses public Bitget OHLCV without an API key.
- No account, balance, position, order, or trading endpoint is used.

## Reliability

- Offline Mock is the default.
- Same seed and snapshots produce identical output.
- Runtime validation fails fast.
- Anthropic is optional with deterministic fallback.
- CI enforces 90% lines, 80% branches, and 95% functions.

## Demo

```powershell
npm.cmd ci
npm.cmd run verify
npm.cmd run demo
```

Optional Bitget proof:

```powershell
npm.cmd run demo:live
```

## Scope

- CLI submission, no Web UI.
- `ma-cross` MVP strategy.
- No real trading or performance guarantee.
- News stores metadata and risk tags, not article bodies.
- Surviving scenarios are valid results.

The submission deliberately keeps one fully validated strategy archetype. The
next milestone is a `StrategyAdapter` registry plus an RSI mean-reversion
reference strategy, rather than an unverified arbitrary-strategy DSL.

## Checklist

- [x] Public repository and README
- [x] Five-dimensional offline demo
- [x] Public Bitget adapter
- [x] Deterministic candidate search
- [x] Prescription and held-out validation
- [x] Automated tests and CI
- [x] Three-minute script
- [ ] Record and upload demo video
- [ ] Fill video URL
- [ ] Submit before 2026-06-24
