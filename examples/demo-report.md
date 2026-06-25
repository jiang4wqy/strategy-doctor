# Strategy Doctor Report: High-Leverage Trend Follower

> Scenario set: `tx42/ho100042`. Treatment and held-out validation use separate seeds.

## Five-Dimensional Stress Coverage
| Dimension | Skill | Observed At | Severity | Shock | PnL | Max Drawdown | Trades | Damage | Outcome |
|---|---|---|---:|---|---:|---:|---:|---:|---|
| macro | macro-analyst | 2026-06-13T04:15:45.396Z | 2 | grind | 57.9% | 52.4% | 7 | -5.6 | Drawdown breach |
| market-intel | market-intel | 2026-06-13T04:15:45.396Z | 1 | crash | -35.3% | 74.8% | 9 | 110.1 | Drawdown breach |
| news | news-briefing | 2026-06-13T04:15:45.396Z | 3 | gap | -99.9% | 99.9% | 4 | 1199.8 | Liquidation |
| sentiment | sentiment-analyst | 2026-06-13T04:15:45.396Z | 3 | squeeze | 974.6% | 80.4% | 7 | -894.3 | Drawdown breach |
| technical | technical-analysis | 2026-06-13T04:15:45.396Z | 3 | whipsaw | -89.9% | 99.5% | 5 | 1189.4 | Liquidation |

## Three Style Scores
| Style | Risk Score | Passed | Worst Drawdown | Mean Return |
|---|---:|---|---:|---:|
| Conservative | 6 | No | 99.9% | 161.5% |
| Aggressive | 21 | No | 99.9% | 161.5% |
| Trend | 15 | No | 99.9% | 161.5% |

## Failure List
- **Macro grind: rates and liquidity pressure** (macro): Drawdown breach; return 57.9%, max drawdown 52.4%, 7 trades.
  - Fed funds 3.50%-3.75%, 10Y Treasury 4.45%, high-yield spread 2.78%, DXY 99.75, and VIX 17.68 map to a deterministic grind stress path.
- **Market structure liquidity crash** (market-intel): Drawdown breach; return -35.3%, max drawdown 74.8%, 9 trades.
  - Crypto market cap changed -0.35% over 24h, stablecoin supply changed -1.88% over 30d, BTC open interest changed 0.29%, and top-trader long share is 54.1%.
- **News catalyst gap** (news): Liquidation; return -99.9%, max drawdown 99.9%, 4 trades.
  - Across 8 frozen news items, negative headlines represent 25.0%, high-impact headlines 75.0%, and regulatory items 25.0%; the scenario models gap risk from sudden catalysts.
- **Sentiment squeeze: long crowding** (sentiment): Drawdown breach; return 974.6%, max drawdown 80.4%, 7 trades.
  - long crowding, fear-greed 13, and taker buy share 46.2%. The scenario models an upside bait move followed by a fast selloff to test liquidation risk in leveraged trend strategies.
- **Technical whipsaw: false-breakout grinder** (technical): Liquidation; return -89.9%, max drawdown 99.5%, 5 trades.
  - ADX 29.3, 1 DMI switches in the last 20 bars, 4 RSI centerline crosses, and Bollinger bandwidth 5.4%. The scenario creates repeated false breakouts to test chasing and stop-loss bleed risk.

## Prescription
- Parameter changes: `{"leverage":5,"stopLossPct":0.072,"positionPct":0.6}`
- Rationale: Liquidation failure -> reduce leverage and move the stop inside half of the liquidation distance; Drawdown breach -> reduce position exposure; final prescription: Leverage 10 -> 5; Stop-loss distance 0.5 -> 0.072; Position size 1 -> 0.6

## Held-Out Retest (Honest Trade-Off)
- Risk score change: +2
- Mean return change: +37.1%

> This report does not promise that a patch is automatically better. Prescription quality is judged on held-out scenarios that were not used during the repair search; remaining failures should stay visible as risk.
