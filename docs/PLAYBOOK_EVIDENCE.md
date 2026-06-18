# Bitget Playbook Evidence

## Strategy philosophy

Strategy Doctor should sit between strategy ideation and strategy deployment.
The Playbook package in this repository represents the deployment side of that
loop: after Strategy Doctor identifies likely failure modes, a conservative,
auditable BTC signal can be uploaded to Bitget Playbook for managed sandbox
backtesting and publication evidence.

Playbook strategy philosophy:

```text
Adaptive risk gate: follow clear BTC trend alignment, avoid forcing trades in
unclear regimes, and use Strategy Doctor's five-dimension diagnosis before
publishing or tuning risk. If the diagnosis exposes liquidation, drawdown, or
whipsaw risk, reduce risk budget before Playbook publication.
```

## Local package

```text
examples/playbook/strategy-doctor-adaptive-playbook
```

The package is signal-only and uses BTCUSDT. It is intended as submission
evidence for the bridge between Strategy Doctor and Bitget Playbook; it does
not contain private API keys and does not place orders from local code.

## Installation evidence

Official package checked:

```powershell
npm.cmd view @bitget-ai/getagent-skill version description bin --json
```

Observed version:

```text
0.3.3
```

Installed outside the repository:

```powershell
npx.cmd @bitget-ai/getagent-skill install `
  --client codex `
  --target D:\tools\getagent-skill-codex `
  --no-update-check
```

## Validation evidence

```powershell
python D:\tools\getagent-skill-codex\scripts\validate.py `
  examples\playbook\strategy-doctor-adaptive-playbook
```

Result:

```text
Validation PASSED
```

## Upload / backtest / publish runbook

Use a rotated Playbook API key. Store it only in the shell:

```powershell
$env:GETAGENT_ACCESS_KEY='<rotated Playbook API key>'
```

Then use the official GetAgent skill workflow to upload, run, and publish this
package. When the managed backtest completes, record:

| Metric | Value |
|---|---|
| total_return_pct | Fill after Playbook run |
| max_drawdown_pct | Fill after Playbook run |
| sharpe_ratio | Fill after Playbook run |
| win_rate | Fill after Playbook run |
| total_trades | Fill after Playbook run |
| published_url | Fill after publish |

Do not write the API key into this file.
