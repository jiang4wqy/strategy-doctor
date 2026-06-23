# Setup And Operations

This guide is written for teammates, reviewers, and demo operators. It keeps the default workflow offline, deterministic, and safe.

## Requirements

| Dependency | Version | Purpose |
|---|---:|---|
| Node.js | 24+ | Native TypeScript execution, tests, CLI, API, and Web build |
| npm | Bundled with Node | Dependency installation and package scripts |

The project does not require Python, Docker, a database, or private Bitget trading credentials.

```powershell
git clone https://github.com/jiang4wqy/strategy-doctor.git
Set-Location strategy-doctor
npm.cmd ci
npm.cmd run verify
```

If `npm.cmd` is not in `PATH`, set `NODE_EXE` or use the local helper scripts. They search `D:\tools\node-v24.14.0-win-x64\node.exe` before falling back to `node`.

```powershell
$env:NODE_EXE='D:\tools\node-v24.14.0-win-x64\node.exe'
```

## Recommended Local Showcase

```powershell
.\scripts\start-showcase.ps1
```

If PowerShell script execution is disabled, use the wrapper:

```powershell
.\scripts\start-showcase.cmd
```

The script:

- clears an existing listener on the selected port;
- sets safe local demo environment variables;
- disables auth rate limiting for local preview by default;
- builds the Web client;
- starts the API/Web server in the background;
- prints URL, access code, PID, and log files.

Default URL:

```text
http://127.0.0.1:8080/showcase
```

Default access code:

```text
team-preview-code-change-me
```

Stop the showcase:

```powershell
.\scripts\stop-showcase.ps1
```

Use a different port:

```powershell
.\scripts\start-showcase.ps1 -Port 8090
```

Keep production-like auth rate limiting:

```powershell
.\scripts\start-showcase.ps1 -KeepAuthRateLimit
```

## Manual Web/API Startup

```powershell
$env:DOCTOR_WEB_ACCESS_CODE='team-preview-code-change-me'
$env:DOCTOR_SESSION_SECRET='replace-this-with-a-random-32-char-secret'
$env:DOCTOR_API_KEYS='replace-this-with-a-private-agent-key'
$env:DOCTOR_HOST='127.0.0.1'
$env:DOCTOR_PORT='8080'
$env:DOCTOR_AUTH_RATE_LIMIT_DISABLED='1'

npm.cmd run build:web
npm.cmd run server
```

If npm is not available:

```powershell
$Node='D:\tools\node-v24.14.0-win-x64\node.exe'
& $Node node_modules\vite\bin\vite.js build --config web/vite.config.ts
& $Node src/server/start.ts
```

## Environment Variables

| Variable | Required | Description |
|---|---:|---|
| `DOCTOR_WEB_ACCESS_CODE` | Web login | Access code entered on the browser login page |
| `DOCTOR_SESSION_SECRET` | Web login | At least 32 characters; signs HttpOnly browser sessions |
| `DOCTOR_API_KEYS` | Agent/API | Comma-separated Bearer keys |
| `DOCTOR_HOST` | No | Defaults to `127.0.0.1` |
| `DOCTOR_PORT` | No | Defaults to `8080` |
| `DOCTOR_SESSION_TTL_SECONDS` | No | Defaults to 12 hours |
| `DOCTOR_BODY_LIMIT` | No | Defaults to 32768 bytes |
| `DOCTOR_STATIC_ROOT` | No | Defaults to `web/dist` |
| `DOCTOR_AUTH_RATE_LIMIT_DISABLED` | No | Set to `1` only for trusted local demos |
| `DOCTOR_AUTH_RATE_LIMIT_MAX` | No | Defaults to `5` attempts |
| `DOCTOR_AUTH_RATE_LIMIT_WINDOW` | No | Defaults to `15 minutes` |

Never commit access codes, session secrets, API keys, or private exchange credentials.

## CLI

```powershell
npm.cmd run demo
npm.cmd run demo:json
```

Custom run:

```powershell
node src/cli.ts examples/trend-follower.json `
  --style trend `
  --seed 7 `
  --candidates 12 `
  --format markdown `
  --output report.md
```

## Submission Pack

```powershell
.\scripts\build-submission-pack.ps1 -Seed 42 -Candidates 6
```

Execution-policy-safe wrapper:

```powershell
.\scripts\build-submission-pack.cmd -Seed 42 -Candidates 6
```

Generated files:

```text
artifacts/submission-pack/strategy-doctor-submission-pack.json
artifacts/submission-pack/strategy-doctor-submission-pack.md
```

## REST And TypeScript Clients

Start the server first, then run:

```powershell
$env:STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
$env:STRATEGY_DOCTOR_API_KEY='replace-this-with-a-private-agent-key'
.\examples\agent-curl.ps1
node examples/agent-client.ts
```

OpenAPI:

```text
http://127.0.0.1:8080/api/v1/openapi.json
```

OpenAPI is protected. Use an authenticated browser session or a Bearer API key.

## Team Sharing

For a short team preview:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Share the generated URL and the Web access code through a private channel. Agent/API callers also need a Bearer key.

Quick Tunnel is for demos and temporary collaboration only. A durable deployment should add TLS, access control, log retention, key rotation, and operational monitoring.

## Optional AI Fallback

The natural-language parser is rules-first and offline by default. Anthropic fallback only runs when explicitly enabled:

```powershell
$env:DOCTOR_NL_AI_ENABLED='1'
$env:ANTHROPIC_API_KEY='<your-key>'
$env:DOCTOR_NL_MODEL='<available-model-id>'
npm.cmd run web
```

LLM narration is also opt-in:

```powershell
$env:DOCTOR_LLM_NARRATE='1'
$env:ANTHROPIC_API_KEY='<your-key>'
$env:DOCTOR_LLM_MODEL='<available-model-id>'
npm.cmd run demo
```

## Optional Bitget Public Data

```powershell
npm.cmd run demo:live
npm.cmd run snapshots:refresh
```

These commands read public market data only. They do not require private Bitget account credentials.

## Verification

```powershell
.\scripts\verify-project.ps1 -SkipWebServer
git diff --check
```

For browser acceptance tests, install Chromium once:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='D:\tools\ms-playwright'
& 'D:\tools\node-v24.14.0-win-x64\node.exe' node_modules\@playwright\test\cli.js install chromium
& 'D:\tools\node-v24.14.0-win-x64\node.exe' node_modules\@playwright\test\cli.js test -c tests\e2e\playwright.config.ts
```

## Troubleshooting

### `npm.cmd` Is Not Recognized

Use the helper scripts or run Node directly:

```powershell
$Node='D:\tools\node-v24.14.0-win-x64\node.exe'
& $Node src/cli.ts examples/trend-follower.json --style conservative --seed 42 --candidates 6
```

### Port 8080 Is Already In Use

```powershell
.\scripts\stop-showcase.ps1 -Port 8080
.\scripts\start-showcase.ps1 -Port 8080
```

If `.ps1` execution is blocked:

```powershell
.\scripts\stop-showcase.cmd -Port 8080
.\scripts\start-showcase.cmd -Port 8080
```

### Login Says `RATE_LIMITED`

You are hitting an old process or production-like auth limits. Restart through:

```powershell
.\scripts\start-showcase.ps1
```

For manual startup, set:

```powershell
$env:DOCTOR_AUTH_RATE_LIMIT_DISABLED='1'
```

### Login Says Credentials Are Invalid

Make sure the browser access code exactly matches `DOCTOR_WEB_ACCESS_CODE`.

### API Returns 401

Use:

```text
Authorization: Bearer <one value from DOCTOR_API_KEYS>
```
