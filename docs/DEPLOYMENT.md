# Deployment And Preview Access

Strategy Doctor is intentionally simple to deploy for the hackathon: one Node
process serves both the Web client and `/api/v1/*`. The default public demo uses
offline `MockBacktester`; it does not need Bitget private keys and it cannot
place orders.

## 1. Start The Service

```bash
npm ci
npm run build:web

DOCTOR_HOST=0.0.0.0 \
DOCTOR_PORT=8080 \
DOCTOR_WEB_ACCESS_CODE='<reviewer-access-code>' \
DOCTOR_SESSION_SECRET='<random-32-plus-char-secret>' \
DOCTOR_API_KEYS='<private-agent-key>' \
node src/server/start.ts
```

Verify from the server:

```bash
curl -i http://127.0.0.1:8080/api/v1/health
curl -I http://127.0.0.1:8080/showcase
```

## 2. Print Access Commands

Use the helper when you are unsure which URL to open:

```bash
npm run preview:access
```

If the server is reachable only through SSH, pass the SSH login details:

```bash
STRATEGY_DOCTOR_SSH_HOST='<server-ip-or-domain>' \
STRATEGY_DOCTOR_SSH_PORT='<ssh-port>' \
STRATEGY_DOCTOR_SSH_USER='<ssh-user>' \
npm run preview:access
```

The helper prints the server-local URLs, a laptop-side SSH tunnel command,
health checks, and the optional Cloudflare tunnel command. It does not read or
print secrets.

## 3. SSH Tunnel Preview

Use this when the service works on the server but your browser cannot open the
server IP or port.

Run this on your laptop and keep the terminal open:

```bash
ssh -p <ssh-port> -L 18080:127.0.0.1:8080 <ssh-user>@<server-ip-or-domain>
```

Then open:

```text
http://127.0.0.1:18080/showcase
http://127.0.0.1:18080/
```

This works because your laptop's `127.0.0.1:18080` is forwarded through SSH to
the server's `127.0.0.1:8080`.

## 4. Temporary Public Demo

For a short judge or teammate preview:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

Share the generated `trycloudflare.com` URL. Send the Web access code and API
key separately through a private channel.

Limits:

- The Strategy Doctor process and `cloudflared` process must both keep running.
- The URL changes after the tunnel restarts.
- This is a demo path, not permanent production hosting.

## 5. Stable Deployment Option

For a longer-running server, put Nginx or another reverse proxy in front of the
Node process:

```nginx
server {
  listen 80;
  server_name strategy-doctor.example.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Add TLS, log retention, key rotation, and a process manager such as `systemd` or
`pm2` before treating this as a persistent public service.

## 6. API Verification

After the page is visible, verify the developer path:

```bash
export STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
export STRATEGY_DOCTOR_API_KEY='<private-agent-key>'
npm run api:check
npm run submission:usage-record
```

The generated record lives at `examples/submission/api-call-log.jsonl` and is the
evidence that REST access reaches real diagnoses, not only a static frontend.
