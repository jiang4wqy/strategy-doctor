# redteam

There are five snapshot parser/builders, responsible for:
- `macro`
- `market-intel`
- `news`
- `sentiment`
- `technical`

- `search.ts`: each dimension creates 1-50 deterministic candidates and picks the worst by `damage` score.
- `diagnose.ts`: classifies `liquidation`, `drawdown breach`, `stop-loss bleed`, and `survived`.
- `narrate.ts`: local narrative by default; optional Anthropic `/v1/messages` fallback with a 3-second timeout.
- `parse*.ts`: validates snapshot shape and converts deterministic stress shock into scenario shape.

Candidates never cross dimension boundaries, and they are not forced to make a strategy fail.