# Public Demo Runbook

## Local judge mode

Run:

```powershell
scripts\start-showcase.cmd
```

Open:

```text
http://127.0.0.1:8080/judge
```

Judge mode is public-read and does not require the workspace access code. The
private workspace remains at:

```text
http://127.0.0.1:8080/showcase
```

Default preview access code:

```text
team-preview-code-change-me
```

## Temporary public URL

Run:

```powershell
scripts\start-public-demo.cmd -InstallCloudflared
```

The script starts the local showcase server, downloads `cloudflared.exe` to
`D:\tools` if needed, opens a temporary Cloudflare Tunnel, and prints:

```text
https://<generated>.trycloudflare.com/judge
https://<generated>.trycloudflare.com/showcase
```

Use the `/judge` URL for reviewers. Share `/showcase` only with the access code.

## Playbook bridge check

After starting the server, this endpoint accepts a Bitget Playbook export or
strategy prompt:

```text
POST /api/v1/playbook/diagnoses
```

It returns:

```text
import.source
import.strategy
view.scorecard
view.riskDashboard
view.modelConsistency
view.charts
```

Keep Playbook API keys in environment variables or private tooling. Do not paste
secrets into committed files or public demo pages.
