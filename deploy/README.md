# Deployment Templates

These files are copy-ready starting points. Replace paths, users, domains, and
secret values for the target server.

| File | Purpose |
|---|---|
| `systemd/strategy-doctor.service.example` | Long-running Linux service |
| `nginx/strategy-doctor.conf.example` | Reverse proxy to local port `8080` |
| `pm2/ecosystem.config.cjs` | Optional PM2 process definition |

Recommended order:

```bash
cp .env.example .env
npm ci
npm run build:web
npm run healthcheck
npm run start:prod
```

For server boot persistence, prefer systemd. Use PM2 only if the deployment
environment already standardizes on it.
