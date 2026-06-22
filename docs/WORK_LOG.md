# Work Log

Updated: 2026-06-22, UTC

## Active delivery branch

This is the active local branch for Track 2 strategy and reviewer UI polishing:

| Item | Value |
|---|---|
| Local path | `/data/wuzuo.jiang/strategy-doctor` |
| Branch | `feature/track2-strategy-ui-polish` |
| Base | `main` |
| Merge target | `main` |

## What changed in this polishing pass

### Public reviewer UI

- Added a no-login showcase route at `http://127.0.0.1:8080/showcase`.
- The showcase renders real generated MA, RSI/Bollinger, and confirmed-breakout diagnosis outputs.
- Added a Playbook readiness panel with deployment gates and a reviewer-friendly readiness status.
- The protected Web/API workspace remains available at `/`.

Files:

- `web/src/showcase/ShowcasePage.tsx`
- `web/src/showcase/showcase-data.ts`
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/components/DeploymentReadinessPanel.tsx`
- `web/src/styles/layout.css`

### Strategy coverage upgrade

- Added `breakout-confirmation`, a third registered strategy archetype.
- The strategy waits for confirmed range expansion, applies a volatility gate,
  and exits when the breakout fails.
- Natural-language parsing can now recognize confirmed-breakout descriptions.
- CLI, Web/API capabilities, TypeScript client contracts, release artifacts,
  and tests all exercise the third strategy.

Files:

- `src/strategy/adapters/breakout-confirmation.ts`
- `examples/breakout-confirmation.json`
- `tests/strategy/breakout-confirmation.test.ts`
- `src/contracts.ts`
- `src/strategy/parse.ts`
- `src/strategy/registry.ts`
- `src/natural-language/rules.ts`

### Submission evidence package

- Added reproducible API request/output artifacts for all three supported strategies.
- Added a submission evidence document that maps Bitget requirements to repository proof.
- Added a submission form draft for fast copy/paste into the hackathon form.
- Added a local runner script for dependency install, verification, Web build, and Playbook validation.

Files:

- `examples/submission/*`
- `docs/SUBMISSION_EVIDENCE.md`
- `docs/SUBMISSION_FORM.md`
- `scripts/run-local-submission.ps1`

### Bitget Playbook bridge

- Installed the official GetAgent skill outside the repository at `D:\tools\getagent-skill-codex`.
- Added a credential-free Playbook package under `examples/playbook/strategy-doctor-adaptive-playbook`.
- Local official validator result: `Validation PASSED`.

Files:

- `examples/playbook/strategy-doctor-adaptive-playbook/*`
- `docs/PLAYBOOK_EVIDENCE.md`

### Release artifact tests

- Extended release artifact tests so docs, sample outputs, Playbook package, and reviewer evidence stay checked by automation.

Files:

- `tests/integration/release-artifacts.test.ts`

### Judge-facing showcase and packaging

- Added a public no-login showcase summary with judge pitch, three-strategy comparison, and Playbook readiness evidence.
- Added a local submission package index generator so reviewers can inspect artifact hashes without committing generated bundles.
- Fixed Web static asset fallback so missing `/assets/*.js` files return a real 404 instead of `index.html`, preventing blank pages after rebuilds.

Files:

- `web/src/showcase/ShowcasePage.tsx`
- `web/src/styles/layout.css`
- `web/src/App.tsx`
- `src/server/app.ts`
- `tests/server/static-assets.test.ts`
- `scripts/generate-submission-package.mjs`
- `scripts/run-local-submission.ps1`

## Validation commands

Use the bundled Node/npm installed on D drive:

```powershell
cd D:\github\strategy-doctor-submission
$env:PATH='D:\tools\node-v24.14.0-win-x64;' + $env:PATH
.\scripts\run-local-submission.ps1
```

Manual Web smoke:

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='demo-code-change-me'
$env:DOCTOR_SESSION_SECRET='demo-session-secret-at-least-32-chars'
$env:DOCTOR_API_KEYS='demo-private-agent-key'
D:\tools\node-v24.14.0-win-x64\npm.cmd run web
```

Then open:

```text
http://127.0.0.1:8080/showcase
```

If you rebuild Web assets while the server is already running, restart the
server before browser smoke testing so the static file handler sees the latest
hashed asset names.

## Latest local validation result

Final local run on 2026-06-20:

| Check | Result |
|---|---|
| `scripts/run-local-submission.ps1` | Passed |
| npm audit during install | 1 high severity advisory reported by npm |
| Core coverage suite | 271 tests, 269 passed, 2 skipped |
| Coverage | Lines 96.58%, branches 88.93%, functions 99.20% |
| TypeScript core | Passed |
| TypeScript Web | Passed |
| Offline CLI demo | Passed |
| Web production build | Passed |
| Playbook validator | Validation PASSED |
| Submission package index | Generated locally under `submission-package/` |
| No-login `/showcase` smoke | Passed in the in-app browser, including judge summary, strategy comparison, `Confirmed breakout`, and Playbook readiness |

The skipped test is the opt-in live Bitget public-data smoke test. It is skipped
by default so CI and local submission checks stay offline and deterministic.

## Upload status

GitHub push may still depend on local network access to `github.com:443`.
When the network is available:

```bash
cd /data/wuzuo.jiang/strategy-doctor
git push origin main
```

Then deploy the freshly built Web assets on the server.
