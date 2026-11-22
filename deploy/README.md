# Deployment Guide

Every path ends at the same place: Node 20 + the zero-dependency server behind Caddy (automatic HTTPS), data in a persistent volume/dir.

| Path | When to use | Command |
| --- | --- | --- |
| **Docker (any host)** | You have Docker; simplest reproducible deploy | `docker build -t lines . && docker run -d -p 3001:3001 -v lines-data:/app/data lines` |
| **Compose (prod)** | Full stack with HTTPS | `DOMAIN=linesandlogosteam.com EMAIL=you@email docker compose -f docker-compose.prod.yml up -d` |
| **DigitalOcean** | One script on a fresh Ubuntu 22.04 droplet | `DOMAIN=… EMAIL=… bash deploy/digitalocean.sh` |
| **AWS EC2** | Paste `deploy/aws-userdata.sh` into instance user-data (t3.small+) | see header of the script |
| **Google Cloud** | One command from Cloud Shell | `DOMAIN=… EMAIL=… bash deploy/gcp.sh` |
| **Bare metal / VPS (IONOS)** | The $6 tier works — add 1GB swap first (see below) | `node server.js` behind any reverse proxy |
| **systemd (any Linux)** | No Docker, want auto-restart | copy `deploy/linesandlogos.service` to `/etc/systemd/system/`, `systemctl enable --now linesandlogos` |

## IONOS $6-tier notes
```bash
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
The app baseline is ~120MB RSS; the local AI model needs a 4GB+ tier — use OpenRouter free there.

## After deploy checklist
1. `curl -s localhost:3001/api/health` → `{"ok":true,...}`
2. Log in at `https://YOURDOMAIN/dashboard.html` (admin@linesandlogos.com / onepaint — change immediately)
3. Admin → Settings → Integrations: Stripe keys, Google/Workspace creds
4. DNS: A-record → server IP; the Caddyfile handles TLS + www redirect
5. Backups: `data/backups/` rotates automatically; copy the volume off-box for real DR
