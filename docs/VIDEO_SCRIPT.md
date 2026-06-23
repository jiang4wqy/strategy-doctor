# Strategy Doctor Demo Video Script

## 90-second version

**0:00 - 0:10 | Open**

Strategy Doctor is an AI trading-infrastructure copilot for the Bitget AI
Hackathon. It converts strategy ideas into typed strategies, attacks them with
deterministic market stress tests, and returns auditable repairs before a team
publishes a Playbook.

**0:10 - 0:25 | Judge mode**

Open `/judge`. Show the evidence surface: supported strategies, five risk
dimensions, verification status, and the Playbook bridge endpoint. This page is
public-demo safe and does not require a preview code.

**0:25 - 0:45 | Private workspace**

Open `/showcase`, enter the team preview code, and type a strategy idea such as:

```text
BTC moving average crossover with defensive stop loss and position sizing
```

Parse the strategy. Point out that the app produces a typed strategy draft,
assumptions, parser confidence, and registered strategy metadata.

**0:45 - 1:10 | Diagnosis**

Confirm and diagnose. Show the five-dimensional scorecard, death scenarios,
held-out trade-off, risk dashboard, model consistency metadata, and targeted
parameter prescription. Emphasize that the same diagnosis contract is used by
the CLI, web UI, API, MCP tools, and Playbook bridge.

**1:10 - 1:25 | Playbook bridge**

Show the `/api/v1/playbook/diagnoses` example in judge mode. Explain that a
Playbook export or prompt can be imported into Strategy Doctor, diagnosed with
the same adversarial engine, and used as evidence before publishing. API keys
remain outside the repository and are never committed.

**1:25 - 1:30 | Close**

Strategy Doctor gives trading teams a repeatable safety layer: parse, stress,
repair, compare, and only then deploy.

## Voiceover text

Strategy Doctor is an AI trading-infrastructure copilot built for the Bitget AI
Hackathon. A trader can describe a strategy in natural language, and the system
turns it into a typed, registered strategy contract. Before deployment, Strategy
Doctor runs deterministic adversarial stress tests across trend, chop, crash,
spread, and liquidity regimes. The result is not just a backtest number: it is
an evidence package with death scenarios, held-out trade-offs, model-consistency
metadata, and targeted parameter repairs.

For judges, the public judge mode summarizes the system, verification evidence,
and Playbook bridge. The private workspace shows the complete workflow: parse a
strategy idea, confirm the generated draft, run diagnosis, inspect five risk
dimensions, and export the results. The Playbook bridge accepts a Bitget
Playbook export or strategy prompt and runs it through the same diagnosis API,
so teams can review risk evidence before publishing. Secrets stay outside the
repository; the project remains deterministic, offline-first, and auditable.

## Capture checklist

1. Start the local demo with `scripts\start-showcase.cmd`.
2. Open `http://127.0.0.1:8080/judge`.
3. Open `http://127.0.0.1:8080/showcase`.
4. Enter the preview access code.
5. Parse the sample BTC strategy idea.
6. Confirm and run diagnosis.
7. Show the dashboard, charts, prescription, and reproducibility panel.
8. End on the judge mode Playbook bridge section.

## Optional public link

Run:

```powershell
scripts\start-public-demo.cmd -InstallCloudflared
```

Copy the printed `https://*.trycloudflare.com/judge` link for reviewers. Keep
the terminal logs private if they include local paths.
