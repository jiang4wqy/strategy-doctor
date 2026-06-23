# Strategy Doctor diagnosis: 高杠杆趋势跟随

> Scenario set: `tx42/ho100042`. Treatment and held-out validation use different root seeds.

## Five-dimension stress coverage
| Dimension | Skill | Observed at | Severity | Shock | PnL | Max drawdown | Trades | Damage | Result |
|---|---|---|---:|---|---:|---:|---:|---:|---|
| macro | macro-analyst | 2026-06-13T04:15:45.396Z | 2 | grind | 57.9% | 52.4% | 7 | -5.6 | drawdown breach |
| market-intel | market-intel | 2026-06-13T04:15:45.396Z | 1 | crash | -35.3% | 74.8% | 9 | 110.1 | drawdown breach |
| news | news-briefing | 2026-06-13T04:15:45.396Z | 3 | gap | -99.9% | 99.9% | 4 | 1199.8 | forced liquidation |
| sentiment | sentiment-analyst | 2026-06-13T04:15:45.396Z | 3 | squeeze | 974.6% | 80.4% | 7 | -894.3 | drawdown breach |
| technical | technical-analysis | 2026-06-13T04:15:45.396Z | 3 | whipsaw | -89.9% | 99.5% | 5 | 1189.4 | forced liquidation |

## Three-profile risk scores
| Profile | Risk score | Survived | Worst drawdown | Mean PnL |
|---|---:|---|---:|---:|
| Conservative | 6 | no | 99.9% | 161.5% |
| Aggressive | 21 | no | 99.9% | 161.5% |
| Trend-following | 15 | no | 99.9% | 161.5% |

## Failure ledger
- **Macro grind: rates and liquidity pressure** (macro): drawdown breach; PnL 57.9%, max drawdown 52.4%, trades 7.
  - Fed funds 3.50%-3.75%, 10Y Treasury yield 4.45%, high-yield spread 2.78%, DXY 99.75, and VIX 17.68 map to a deterministic grind stress path.
- **Market structure liquidity crash** (market-intel): drawdown breach; PnL -35.3%, max drawdown 74.8%, trades 9.
  - Crypto market cap 24h change -0.35%, stablecoin supply 30d change -1.88%, BTC open-interest change 0.29%, and top-trader long share 54.1%.
- **News catalyst gap** (news): forced liquidation; PnL -99.9%, max drawdown 99.9%, trades 4.
  - 8 frozen news items show 25.0% negative headlines, 75.0% high-impact items, and 25.0% regulatory exposure. The scenario simulates gap risk from a sudden catalyst.
- **Sentiment squeeze: long crowding** (sentiment): drawdown breach; PnL 974.6%, max drawdown 80.4%, trades 7.
  - long crowding; fear-greed index 13; taker buy share 46.2%. The scenario simulates a squeeze upward that traps late longs before a fast selloff, testing liquidation risk in leveraged trend strategies.
- **Technical whipsaw: false-breakout grinder** (technical): forced liquidation; PnL -89.9%, max drawdown 99.5%, trades 5.
  - ADX 29.3, 1 DMI switches over the last 20 candles, 4 RSI midline crosses, and Bollinger bandwidth 5.4%. The scenario creates repeated false breakouts to test chase-and-reversal losses in trend strategies.

## Prescription
- Parameter changes: `{"leverage":5,"stopLossPct":0.072,"positionPct":0.6}`
- Rationale: Reduce leverage and tighten stop-loss to within half of the liquidation line.; Lower position exposure to reduce drawdown pressure.; final prescription: leverage 10 -> 5; stopLossPct 0.5 -> 0.072; positionPct 1 -> 0.6
- Consensus: 100.0% agreement across conservative profiles.

## Held-out validation
- Robustness score change: +2.0000
- Average return change: +37.1%

> Strategy Doctor is a diagnostic and risk-control tool. It does not promise future returns, and every prescription must be judged by the independent held-out result above.
