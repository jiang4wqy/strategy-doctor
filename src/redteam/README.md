# Redteam Scenario Builders

Each snapshot parser/builder owns one stress dimension: `macro`, `market-intel`, `news`, `sentiment`, or `technical`.

- `search.ts` generates 1-50 deterministic candidates per dimension and selects the highest-damage scenario.
- `diagnose.ts` classifies `liquidation`, `drawdown-breach`, `stop-loss-bleed`, and `survived`.
- `narrate.ts` provides local narration with optional Anthropic enhancement and a fast fallback.

Candidates stay inside their source dimension and never force artificial strategy failure.
