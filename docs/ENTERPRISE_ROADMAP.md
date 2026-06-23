# Enterprise Upgrade Roadmap

## Implemented in this branch

- Explicit execution assumptions:
  - fee rate
  - slippage
  - turnover
  - fee drag
  - slippage drag
- Professional chart-ready outputs:
  - equity curves
  - drawdown curves
  - scenario damage ranking
  - risk radar
  - parameter changes
  - execution quality
- Bitget public candle diagnosis controls:
  - symbol
  - timeframe
  - candle count
  - optional date window
- Random strategy generation now emits only parser-supported symbols and
  timeframes.

## P2: Paper Trading And Real-Time Signal Tracking

Goal: bridge backtesting and deployment without touching private account funds.

Recommended architecture:

- `SignalAdapter`: converts a registered strategy and latest candles into
  `long`, `short`, `flat`, or `hold`.
- `PaperAccount`: tracks simulated cash, exposure, fees, slippage, and orders.
- `SignalMonitor`: polls public Bitget candles or Playbook exports and records
  decision changes.
- Web surface:
  - live signal state
  - simulated position
  - last signal reason
  - paper PnL
  - execution-cost attribution

Safety boundary:

- No private order endpoint.
- No account balance reads.
- No automatic deployment.
- All keys stay in environment variables.

## P2: AI Factor Library

Goal: make Strategy Doctor feel like a quant research copilot, not only a
strategy validator.

Initial factor groups:

- Trend: moving-average slope, breakout persistence, ADX, DMI switch count.
- Mean reversion: RSI percentile, Bollinger z-score, band compression.
- Volatility: realized volatility, ATR proxy, volatility regime shift.
- Liquidity: volume shock, open-interest drift, stablecoin liquidity proxy.
- Sentiment: fear-greed, taker buy share, long/short crowding.
- Macro: rates, DXY, VIX, credit spread.
- News: headline risk, regulatory exposure, high-impact event density.

Deliverable:

- `GET /api/v1/factors`
- factor cards in Web
- factor provenance and last-observed timestamp
- factor-to-scenario explanation in exported reports

## P2: Notebook Research Lane

Goal: provide an online notebook-like environment for reproducible experiments.

Practical first version:

- Browser notebook templates backed by downloadable Markdown/JSON, not arbitrary
  remote code execution.
- Prebuilt cells:
  - choose dataset
  - choose factor set
  - run diagnosis
  - compare variants
  - export report
- Dataset fingerprints:
  - exchange
  - symbol
  - timeframe
  - date window
  - candle count
  - SHA-256 hash

Security boundary:

- No arbitrary code execution in the hosted judge demo.
- Local notebook support can be offered as an optional developer mode.

## P2: Open-Source LLM Strategy Review

Goal: use a second model as an independent reviewer of the generated strategy
and the prescription.

Current implementation:

- `strategyReview` is attached to every diagnosis.
- Default mode uses deterministic local rules.
- Network mode supports OpenAI-compatible APIs.
- Tongyi Qianwen/Qwen can be called through DashScope by setting:
  - `DOCTOR_REVIEW_ENABLED=1`
  - `DASHSCOPE_API_KEY`
  - optional `DOCTOR_REVIEW_MODEL=qwen-plus`

Recommended flow:

1. Primary parser creates a typed strategy.
2. Open-source reviewer model checks:
   - missing risk controls
   - unrealistic leverage
   - overfitting risk
   - market-regime mismatch
   - explainability gaps
3. Strategy Doctor records an agreement score and reviewer objections.
4. The diagnosis report includes both quantitative evidence and model-review
   notes.

Local candidates:

- Qwen
- Llama
- DeepSeek
- Mistral

Implementation note:

- Keep the current deterministic rules path as default.
- Add model review only behind an explicit environment opt-in.

## P3: Portfolio-Level Backtesting

Goal: compete with mature quant frameworks on multi-asset research.

Add:

- multi-symbol universe
- portfolio cash and exposure accounting
- correlation stress
- capital allocation rules
- portfolio-level drawdown
- portfolio turnover
- per-symbol contribution analysis

This should be implemented after one-symbol diagnosis is stable and dataset
fingerprinting exists.
