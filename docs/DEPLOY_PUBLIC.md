# Long-lived Public Deployment

If you need a persistent internet URL for hackathon judges and teammates, use a managed host instead of temporary tunnels.

## Option A (Recommended): Render

1. Push this branch to GitHub.
2. In Render, create a new **Blueprint** service and select this repository.
3. Render reads `render.yaml` and builds from `Dockerfile`.
4. In Render service environment variables, set:

```text
DOCTOR_WEB_ACCESS_CODE=your-web-access-code
DOCTOR_SESSION_SECRET=at-least-32-char-random-string
DOCTOR_API_KEYS=agent-key-1,agent-key-2
```

Optional DeepSeek natural-language Agent parsing:

```text
DOCTOR_NL_AI_ENABLED=1
DOCTOR_NL_PROVIDER=deepseek
DOCTOR_NL_DEEPSEEK_ENABLED=1
DEEPSEEK_API_KEY=your-deepseek-key
DOCTOR_DEEPSEEK_MODEL=deepseek-v4-pro
```

5. After deploy, Render provides a fixed URL like:

```text
https://strategy-doctor.onrender.com
```

Use:

- Workspace: `https://strategy-doctor.onrender.com`
- Public showcase: `https://strategy-doctor.onrender.com/showcase`

6. Share this URL in your submission docs as the long-lived demo endpoint.

## Option B: Railway

1. Connect repository, add service with Dockerfile.
2. Set same environment variables as above.
3. Deploy and use the generated `*.railway.app` domain.

## Option C: Cloudflare Tunnel (custom domain, stable)

If you already own a domain, create a permanent Tunnel in Cloudflare Zero Trust and bind it to the service host.
Use this for a branded address:

```text
https://strategy-doctor.your-domain.com
```

## Security notes

- Keep `DOCTOR_WEB_ACCESS_CODE` and `DOCTOR_SESSION_SECRET` out of public repos.
- Keep API keys in platform secrets, not checked into code.
- If you expose API to users, keep Bearer keys rotation in platform secrets and change periodically.

## Smoke test after deployment

```text
curl -I https://your-domain.com/api/v1/health
curl https://your-domain.com/api/v1/openapi.json
curl -X POST https://your-domain.com/api/v1/auth \
  -H "Content-Type: application/json" \
  -d "{\"accessCode\":\"your-web-access-code\"}"
```
