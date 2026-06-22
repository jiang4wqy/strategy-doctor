# Deployment And Preview Access

Strategy Doctor is intentionally simple to deploy for the hackathon: one Node
process serves both the Web client and `/api/v1/*`. The default public demo uses
offline `MockBacktester`; it does not need Bitget private keys and it cannot
place orders.

## 1. Start The Service

Copy the environment template and fill only local secrets:

```bash
cp .env.example .env
```

The important fields are:

| Variable | Purpose |
|---|---|
| `DOCTOR_WEB_ACCESS_CODE` | Reviewer login code for `/` |
| `DOCTOR_SESSION_SECRET` | 32+ character session-signing secret |
| `DOCTOR_API_KEYS` | Private Bearer keys for Agents and scripts |
| `DOCTOR_HOST` | Use `0.0.0.0` when a reverse proxy or tunnel needs to reach the process |
| `DOCTOR_PORT` | Default `8080` |

```bash
npm ci
npm run build:web
npm run start:prod
```

`start:prod` reads `.env`, verifies required variables, checks `web/dist`, and
starts `src/server/start.ts`. You can still run the server directly when useful:

```bash
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
npm run healthcheck
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
http://127.0.0.1:18080/developer
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

For a longer-running server, use a process manager and put Nginx or another
reverse proxy in front of the Node process.

### systemd

Template:

```text
deploy/systemd/strategy-doctor.service.example
```

Typical install:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin strategy-doctor
sudo mkdir -p /opt/strategy-doctor
sudo rsync -a --delete ./ /opt/strategy-doctor/
sudo chown -R strategy-doctor:strategy-doctor /opt/strategy-doctor
sudo cp deploy/systemd/strategy-doctor.service.example /etc/systemd/system/strategy-doctor.service
sudo systemctl daemon-reload
sudo systemctl enable --now strategy-doctor
sudo systemctl status strategy-doctor
```

### PM2

Template:

```text
deploy/pm2/ecosystem.config.cjs
```

```bash
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 status
```

### Nginx

Template:

```text
deploy/nginx/strategy-doctor.conf.example
```

```nginx
server {
  listen 80;
  server_name strategy-doctor.example.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Add TLS, log retention, key rotation, and firewall rules before treating this as
a persistent public service.

## 6. API Verification

After the page is visible, verify the developer path:

```bash
export STRATEGY_DOCTOR_URL='http://127.0.0.1:8080'
export STRATEGY_DOCTOR_API_KEY='<private-agent-key>'
npm run api:check
npm run healthcheck
npm run submission:usage-record
```

The generated record lives at `examples/submission/api-call-log.jsonl` and is the
evidence that REST access reaches real diagnoses, not only a static frontend.

## 7. Reviewer Links

Use these links in the submission or demo script after replacing the host:

```text
https://<public-host>/showcase
https://<public-host>/developer
https://<public-host>/
```

`/showcase` and `/developer` are no-login public evidence pages. `/` is the
protected live workspace and requires `DOCTOR_WEB_ACCESS_CODE`.
