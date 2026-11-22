#!/usr/bin/env bash
# Google Cloud — run from Cloud Shell or any gcloud CLI:
#   DOMAIN=linesandlogosteam.com EMAIL=you@email bash deploy/gcp.sh
# Creates an e2-small in us-central1 with the full stack via startup script.
set -euo pipefail
DOMAIN="${DOMAIN:?set DOMAIN=yourdomain.com}"
EMAIL="${EMAIL:-info@linesandlogos.team}"
NAME="${NAME:-lines-and-logos}"
ZONE="${ZONE:-us-central1-a}"
REPO="${REPO:-https://github.com/projectzerodays/lines-and-logos.git}"

gcloud compute instances create "$NAME" \
  --zone="$ZONE" \
  --machine-type=e2-small \
  --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --tags=http-server,https-server \
  --metadata startup-script="#!/bin/bash
set -e
exec > >(tee /var/log/startup-script.log) 2>&1
apt-get update -qq
apt-get install -y -qq git caddy curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs
mkdir -p /opt/lines-and-logos/data
[ -d /opt/lines-and-logos/.git ] || git clone $REPO /opt/lines-and-logos
cd /opt/lines-and-logos && git pull --ff-only
chown -R www-data:www-data /opt/lines-and-logos/data
cat > /etc/systemd/system/linesandlogos.service <<'UNIT'
[Unit]
Description=Lines & Logos Business OS
After=network.target
[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/lines-and-logos
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=-/opt/lines-and-logos/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now linesandlogos
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    reverse_proxy 127.0.0.1:3001
    encode zstd gzip
    tls $EMAIL
}
www.$DOMAIN {
    redir https://$DOMAIN{uri} permanent
}
CADDY
systemctl reload caddy
echo DEPLOYED > /root/startup-done"

echo "Opening firewall (one-time)..."
gcloud compute firewall-rules create allow-web --allow=tcp:80,tcp:443 --target-tags=http-server,https-server 2>/dev/null || true
IP=$(gcloud compute instances describe "$NAME" --zone="$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "Provisioning $NAME at $IP — DNS A-record for $DOMAIN should point here."
echo "Progress: gcloud compute ssh $NAME --zone=$ZONE --command='tail -f /var/log/startup-script.log'"
