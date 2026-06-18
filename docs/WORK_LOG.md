# Work Log

Updated: 2026-06-18, Asia/Shanghai

## Active delivery branch

This is the protected local merge branch for final hackathon polishing:

| Item | Value |
|---|---|
| Local path | `D:\github\strategy-doctor-submission` |
| Branch | `submission/hackathon-final-polish` |
| Base | `origin/main` |
| Included C commit | `15199e3 fix: harden generic risk engine inputs` |
| Included D commits | `95d7af5 test: lock release artifact workflows`, `6eedd12 docs: add team work log` |

The original role worktrees were not modified by this final polishing branch:

- C original: `D:\github\strategy-doctor`, branch `feat/generic-risk-engine`
- D original: `D:\github\strategy-doctor-d-acceptance`, branch `test/multi-strategy-acceptance`

## What changed in this polishing pass

### Public reviewer UI

- Added a no-login showcase route at `http://127.0.0.1:8080/showcase`.
- The showcase renders real generated MA and RSI/Bollinger diagnosis outputs.
- The protected Web/API workspace remains available at `/`.

Files:

- `web/src/showcase/ShowcasePage.tsx`
- `web/src/showcase/showcase-data.ts`
- `web/src/App.tsx`
- `web/src/App.test.tsx`
- `web/src/styles/layout.css`

### Submission evidence package

- Added reproducible API request/output artifacts for both supported strategies.
- Added a submission evidence document that maps Bitget requirements to repository proof.
- Added a local runner script for dependency install, verification, Web build, and Playbook validation.

Files:

- `examples/submission/*`
- `docs/SUBMISSION_EVIDENCE.md`
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

## Latest local validation result

Final local run on 2026-06-18:

| Check | Result |
|---|---|
| `scripts/run-local-submission.ps1` | Passed |
| npm audit during install | 0 vulnerabilities |
| Core coverage suite | 232 tests, 231 passed, 1 skipped |
| Coverage | Lines 96.36%, branches 89.44%, functions 99.10% |
| TypeScript core | Passed |
| TypeScript Web | Passed |
| Offline CLI demo | Passed |
| Web production build | Passed |
| Playbook validator | Validation PASSED |
| No-login `/showcase` smoke | Passed with Microsoft Edge through Playwright |

The skipped test is the opt-in live Bitget public-data smoke test. It is skipped
by default so CI and local submission checks stay offline and deterministic.

## Upload status

GitHub push may still depend on local network access to `github.com:443`.
When the network is available:

```powershell
cd D:\github\strategy-doctor-submission
git push origin submission/hackathon-final-polish
```

Then open a PR into `main`.
