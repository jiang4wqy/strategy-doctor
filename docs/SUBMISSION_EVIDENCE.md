# Strategy Doctor Submission Evidence

更新时间：2026-06-18（UTC+8）

## Official checklist mapping

| Bitget requirement | Evidence in this repository |
|---|---|
| Public GitHub repository with README | `README.md`, `docs/API.md`, `docs/SETUP.md`, `docs/DEMO.md` |
| Real runnable demo, not a concept-only deck | `npm.cmd run verify`, `npm.cmd run web`, `/showcase` no-login public route |
| Track 2 developer-facing integration | REST API, OpenAPI, TypeScript Client, PowerShell sample, capability discovery |
| API logs / sample input-output / reproducible run records | `examples/submission/*`, `examples/agent-curl.ps1`, `examples/agent-client.ts` |
| Demo video if public UI requires login | `/showcase` is no-login; protected workspace still has a video-ready script in `docs/DEMO.md` |
| Crypto or AI connection | Bitget public market snapshots, Bitget public OHLCV path, AI strategy parsing, Strategy Doctor diagnosis |
| No private-account risk | Default Web/API/CLI use offline `MockBacktester`; live paths read public data only |

## Public showcase route

After building and starting the Web/API service:

```powershell
npm.cmd run web
```

Open:

```text
http://127.0.0.1:8080/showcase
```

This route does not require a Web access code. It renders the same diagnosis
workspace with pre-generated MA and RSI/Bollinger evidence so reviewers can see
the product surface without receiving private credentials.

## Canonical strategy examples

The two executable strategy inputs used by CLI, Web/API samples, and release
tests are:

- `examples/trend-follower.json`
- `examples/rsi-bollinger.json`

## Reproducible sample artifacts

| Artifact | Purpose |
|---|---|
| `examples/submission/ma-diagnose-request.json` | MA diagnosis API request |
| `examples/submission/ma-scorecard.json` | MA full scorecard output |
| `examples/submission/ma-diagnosis-view.json` | MA Web/API chart-ready output |
| `examples/submission/rsi-diagnose-request.json` | RSI/Bollinger diagnosis API request |
| `examples/submission/rsi-scorecard.json` | RSI/Bollinger full scorecard output |
| `examples/submission/rsi-diagnosis-view.json` | RSI/Bollinger Web/API chart-ready output |
| `examples/submission/api-call-log.jsonl` | Submission-grade API call log sample |

All sample outputs use seed `42`, held-out seed `100042`, style
`conservative`, and candidate count `6`.

## Verification result

Command:

```powershell
npm.cmd run verify
```

Latest local result:

```text
229 tests
228 passed
1 skipped: live Bitget public-data smoke
0 failed

Coverage:
Lines 96.35%
Branches 89.35%
Functions 99.10%

TypeScript:
core passed
web passed

Demo:
passed
```

## Playbook bridge

The official GetAgent skill was installed outside the repository at:

```text
D:\tools\getagent-skill-codex
```

Repository package:

```text
examples/playbook/strategy-doctor-adaptive-playbook
```

Validator:

```powershell
python D:\tools\getagent-skill-codex\scripts\validate.py `
  examples\playbook\strategy-doctor-adaptive-playbook
```

Latest result:

```text
Validation PASSED
```

Upload/backtest/publish should be done with a Playbook API key stored only in an
environment variable. Do not commit Playbook credentials.

## Submission links to prepare

- GitHub repository URL.
- Public `/showcase` URL after temporary or permanent deployment.
- Demo video URL, three minutes or less.
- Optional social post URL with the required Bitget tag/mention.
- Playbook published URL after managed sandbox run succeeds.
- This evidence document URL.
