#!/usr/bin/env bash
# DigitalOcean deployment — tested against Ubuntu 22.04 droplets.
# Usage: DOMAIN=linesandlogosteam.com EMAIL=you@email bash deploy/digitalocean.sh
set -euo pipefail
DOMAIN="${DOMAIN:?set DOMAIN=yourdomain.com}"
EMAIL="${EMAIL:-info@linesandlogos.team}"
APP_DIR=/opt/lines-and-logos
REPO="${REPO:-https://github.com/projectzerodays/lines-and-logos.git}"

echo "== 1/6 system packages =="
apt-get update -qq
apt-get install -y -qq git ufw curl

echo "== 2/6 node 20 =="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs

echo "== 3/6 firewall =="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== 4/6 app =="
mkdir -p "$APP_DIR/data"
if [ ! -d "$APP_DIR/.git" ]; then git clone "$REPO" "$APP_DIR"; fi
cd "$APP_DIR"
git pull --ff-only
chown -R www-data:www-data "$APP_DIR/data"

echo "== 5/6 systemd service =="
cat > /etc/systemd/system/linesandlogos.service <<EOF
[Unit]
Description=Lines & Logos Business OS
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=-$APP_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now linesandlogos

echo "== 6/6 HTTPS (Caddy) =="
apt-get install -y -qq caddy
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    reverse_proxy 127.0.0.1:3001
    encode zstd gzip
    tls $EMAIL
}
www.$DOMAIN {
    redir https://$DOMAIN{uri} permanent
}
EOF
systemctl reload caddy

echo "== done =="
echo "App:    systemctl status linesandlogos"
echo "Health: curl -s http://127.0.0.1:3001/api/health"
echo "Site:   https://$DOMAIN"
