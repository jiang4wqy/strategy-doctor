# Competitive Gap Analysis

## Reference products

- **Freqtrade:** strong crypto backtesting workflow, historical data download,
  pair/timeframe configuration, web backtesting, plotting, and optimization.
- **RQAlpha:** strong data-bundle model, configurable start/end dates,
  frequency, and local research workflow.
- **Catalyst / Zipline lineage:** event-driven backtesting philosophy for
  historical market simulation, portfolio accounting, and exchange-specific
  data ingestion.
- **Bitget API:** official public historical candles expose symbol,
  granularity/timeframe, limit, and time-window parameters. Private trading
  keys are not required for public market-data diagnosis.

Reference links:

- Freqtrade backtesting and historical data workflow:
  https://www.freqtrade.io/en/stable/backtesting/
- Freqtrade data download example with pairs and timeframes:
  https://www.freqtrade.io/en/stable/docker_quickstart/
- RQAlpha local run configuration with start and end dates:
  https://rqalpha.readthedocs.io/zh-cn/latest/notebooks/run-rqalpha-in-ipython.html
- Bitget contract historical candles:
  https://www.bitget.com/api-doc/contract/market/Get-History-Candle-Data
- Bitget candlestick parameters, including `startTime`, `endTime`, and `limit`:
  https://www.bitget.com/api-doc/contract/market/Get-Candle-Data
- Catalyst / Zipline crypto-asset lineage:
  https://github.com/scrtlabs/catalyst

## Gaps closed in Strategy Doctor

1. **Market selection in the Web workflow**
   - Users can now choose `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, or
     `DOGEUSDT`.
   - The selected symbol is written into `strategy.universe`.

2. **Timeframe selection**
   - Users can choose `1h`, `4h`, or `1d`.
   - The selected timeframe is written into `strategy.timeframe`.

3. **Backtest data controls**
   - Users can select deterministic offline data or Bitget public candles.
   - Users can choose candle count from 50 to 1000.
   - Users can optionally choose start and end dates.

4. **Bitget public data path**
   - `strategy.backtest.source = "bitget-public"` routes default server
     diagnosis through `BitgetBacktester`.
   - `BitgetBacktester` passes symbol, timeframe, candle limit, start time,
     and end time to the candle source.
   - Default demo mode remains deterministic and offline-safe.

5. **Strategy iteration loop**
   - Results are no longer terminal.
   - Users can edit parameters after diagnosis, rerun, and compare against the
     original diagnosis.

6. **Playbook bridge**
   - Playbook exports or prompts can be imported and diagnosed through
     `/api/v1/playbook/diagnoses`.
   - The bridge is a risk-evidence layer, not a private trading endpoint.

## Product logic after this upgrade

1. A user writes a natural-language strategy or launches a random sample.
2. The parser produces a registered strategy draft.
3. The confirmation screen lets the user choose strategy parameters, market,
   timeframe, dataset source, candle count, and optional date window.
4. The diagnosis API validates the complete strategy contract.
5. Offline synthetic runs stay fully deterministic for judging and regression
   tests.
6. Bitget public candle runs use the same risk engine and stress scenarios, so
   live market data and offline evidence remain comparable.
7. The result screen supports parameter edits and baseline comparison, turning
   diagnosis into an iterative repair loop rather than a static report.

## Remaining P2 opportunities

1. **Multi-symbol portfolio diagnosis**
   - Current engine remains one-symbol-per-diagnosis for deterministic
     isolation.
   - Next step: portfolio-level scenario aggregation and cross-symbol
     correlation stress.

2. **Full historical ingestion cache**
   - Current Bitget path reads public candles through the configured market-data
     source.
   - Next step: local candle cache, CSV export/import, and reproducible dataset
     fingerprints.

3. **Hyperparameter optimization mode**
   - Current prescription is targeted repair, not broad hyperopt.
   - Next step: explicit optimization mode with constraints, leaderboard, and
     overfitting warnings.

4. **Private Bitget strategy inventory**
   - Current system imports Playbook JSON/prompts.
   - Next step: read-only Bitget/Playbook account strategy listing after
     official API details are confirmed and secrets are stored only in
     environment variables.

5. **Dataset fingerprinting**
   - Store exchange, symbol, timeframe, date window, candle count, fetch time,
     and a SHA-256 hash with each diagnosis.
   - This would make public-candle diagnoses auditable even when exchange data
     later updates.

6. **Optimization mode**
   - Keep the current prescription loop as a safe targeted repair path.
   - Add a separate hyperparameter search mode with overfitting warnings,
     train/validation splits, and leaderboard export.
