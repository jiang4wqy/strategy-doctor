# Strategy Doctor Risk-Gated BTC Playbook

## 策略 / Strategy

This Playbook is the Bitget Playbook companion for Strategy Doctor. Strategy
Doctor first diagnoses a strategy idea across five hostile market dimensions,
then this package carries a simple BTC perpetual trend signal into the managed
Playbook workflow for upload, sandbox backtest, and publication evidence.

The package is intentionally transparent. It does not claim to be an arbitrary
strategy generator and it does not use private account data in the repository.
It is a deterministic, signal-only strategy package that lets judges reproduce
the bridge from diagnostic infrastructure to Bitget Playbook.

## 开仓 / Entry

The strategy opens long exposure when a shorter directional read of BTC price
action leads the slower baseline upward. It waits when the market is unclear.
This matches the Strategy Doctor philosophy: a signal should be explainable
before it is allowed into a managed backtest or publication flow.

## 平仓 / Exit

The strategy closes when the directional alignment that justified the entry is
lost. There is no hidden discretionary override in the package. The managed
runtime receives a clean signal and the package remains signal-only, so local
code never sends exchange orders directly.

## 参数 / Tunables

Subscribers can tune the trading symbol, leverage, and margin budget. The
symbol is kept to BTCUSDT for this submission evidence package. Higher leverage
raises both upside and drawdown. Margin budget controls the capital allowance
used by the platform when reporting Playbook return.

## 风险 / Risk

The main risks are choppy sideways regimes, news gaps, and sharp reversals after
trend alignment has already appeared. The repository includes Strategy Doctor
diagnosis outputs for both MA trend following and RSI/Bollinger mean reversion
so reviewers can see the failure modes before trusting a Playbook run.

Historical backtests are evidence, not a guarantee. Live execution can still
pay fees, suffer slippage, and perform poorly in unsuitable regimes.

## Local validation

The official GetAgent skill was installed outside the repository at:

```text
D:\tools\getagent-skill-codex
```

Validate this package before uploading:

```powershell
python D:\tools\getagent-skill-codex\scripts\validate.py `
  examples\playbook\strategy-doctor-adaptive-playbook
```

Upload, run, and publish should use a Playbook API key from an environment
variable. Never commit that key to the repository.
