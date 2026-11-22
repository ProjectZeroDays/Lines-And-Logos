#!/usr/bin/env bash
# AWS EC2 user-data — paste into "Advanced details > User data" when launching
# an Ubuntu 22.04 t3.small (2GB) in any region, with ports 22/80/443 open.
# Or launch from CLI:
#   aws ec2 run-instances --image-id ami-0c7217cdde317cfec --instance-type t3.small \
#     --key-name your-key --security-group-ids sg-xxx \
#     --user-data file://deploy/aws-userdata.sh
set -euo pipefail
DOMAIN="${DOMAIN:-linesandlogosteam.com}"
EMAIL="${EMAIL:-info@linesandlogos.team}"
APP_DIR=/opt/lines-and-logos
REPO="${REPO:-https://github.com/projectzerodays/lines-and-logos.git}"

apt-get update -qq
apt-get install -y -qq git caddy curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs

mkdir -p "$APP_DIR/data"
[ -d "$APP_DIR/.git" ] || git clone "$REPO" "$APP_DIR"
cd "$APP_DIR" && git pull --ff-only
chown -R www-data:www-data "$APP_DIR/data"

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
echo "Lines & Logos deployed on $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo this-host)" > /root/deploy-result.txt
