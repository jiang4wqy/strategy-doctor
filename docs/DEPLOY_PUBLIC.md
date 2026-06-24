# Long-Lived Public Deployment

For judge review, avoid temporary Cloudflare tunnel links and use a stable host.

## Option A (Recommended): Render

1. Push this branch to GitHub.
2. In Render, create a new **Web Service** from the repository.
3. Render reads `render.yaml` and builds from the included `Dockerfile`.
4. Set required variables:
   - `DOCTOR_WEB_ACCESS_CODE` (required)
   - `DOCTOR_SESSION_SECRET` (at least 32 characters)
   - `DOCTOR_API_KEYS` (optional for API callers)
5. Deploy and check:

```text
http://<service>.onrender.com/api/v1/health
```

Then share:

```text
https://<service>.onrender.com/judge
https://<service>.onrender.com/showcase
```

## Option B: Railway

1. Connect your GitHub repo in Railway.
2. Deploy as Docker image.
3. Set environment variables listed above.
4. Map Railway domain or custom domain.

## Option C: Your own domain

Deploy with Docker on any container host and bind your custom domain to:

```text
https://<your-domain>/judge
https://<your-domain>/showcase
```

## Local production-style run (VPS/container)

```bash
export DOCTOR_HOST=0.0.0.0
export DOCTOR_PORT=8080
export DOCTOR_WEB_ACCESS_CODE=your-access-code
export DOCTOR_SESSION_SECRET=replace-with-at-least-32-chars
export DOCTOR_API_KEYS=your-bearer-key
node src/server/start.ts
```

## Pre-checks before sharing

1. `GET /api/v1/health` returns status `ok`.
2. `/judge` is reachable by judges.
3. `/showcase` requires valid access code.
4. API endpoints return 401 when no auth is supplied and succeed with Bearer key.
