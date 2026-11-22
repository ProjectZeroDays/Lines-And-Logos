#!/usr/bin/env bash
# ============================================================================
# Lines & Logos Business OS — VPS installer (Debian 11+/Ubuntu 20.04+)
#
#   curl -fsSL https://your-host/install-vps.sh | bash
#   or:  bash install-vps.sh
#
# Asks for everything needed to configure the deployment, installs the app,
# creates a hardened systemd service, and (optionally) puts Caddy with
# automatic HTTPS in front. The FIRST person to open the app in a browser
# creates the owner account — that's the only manual step left.
# ============================================================================
set -euo pipefail

APP_NAME="lines-logos"
APP_TITLE="Lines & Logos Business OS"
APP_USER="lines-logos"
INSTALL_DIR="/opt/lines-logos"

# ---------- pretty output ----------
if [ -t 1 ]; then
  B=$'\033[1m'; D=$'\033[2m'; G=$'\033[32m'; Y=$'\033[33m'; C=$'\033[36m'; R=$'\033[31m'; N=$'\033[0m'
else
  B=""; D=""; G=""; Y=""; C=""; R=""; N=""
fi
step(){ printf '\n%s==>%s %s%s%s\n' "$C" "$N" "$B" "$1" "$N"; }
ok(){   printf '  %s✓%s %s\n' "$G" "$N" "$1"; }
warn(){ printf '  %s!%s %s\n' "$Y" "$N" "$1"; }
die(){  printf '\n%s✗ %s%s\n' "$R" "$1" "$N" >&2; exit 1; }

# ---------- privilege check ----------
[ "$(id -u)" -eq 0 ] || die "Run as root (sudo bash install-vps.sh)"

# If the app source isn't next to this script, allow APP_SRC override.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_SRC="${APP_SRC:-$SCRIPT_DIR/..}"
[ -f "$APP_SRC/server.js" ] || die "Cannot find server.js in $APP_SRC — set APP_SRC=/path/to/app"

step "$APP_TITLE — installation"

# ---------- 1. Node.js ----------
step "Checking Node.js"
NEED_NODE=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
  [ "$NODE_MAJOR" -ge 18 ] && ok "Node $(node --version)" || NEED_NODE=1
else
  NEED_NODE=1
fi
if [ "$NEED_NODE" -eq 1 ]; then
  warn "Node 18+ not found — installing from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
  ok "Node $(node --version)"
fi

# ---------- 2. Ask for configuration ----------
step "Configuration (press Enter to accept defaults)"
ask(){ # $1=prompt $2=default -> sets REPLY
  local prompt="$1" def="$2"
  if [ -n "$def" ]; then printf '  %s%s%s [%s%s%s]: ' "$B" "$prompt" "$N" "$D" "$def" "$N"
  else printf '  %s%s%s: ' "$B" "$prompt" "$N"; fi
  read -r REPLY || true
  REPLY="${REPLY:-$def}"
}

ask "Public domain name (blank = no HTTPS, access by IP only)" ""
DOMAIN="$REPLY"
ask "Port the app listens on (behind a reverse proxy this stays internal)" "3001"
PORT="$REPLY"
case "$PORT" in ''|*[!0-9]*) die "Port must be a number";; esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then die "Port out of range"; fi

SETUP_CADDY=0
if [ -n "$DOMAIN" ]; then
  ask "Set up Caddy reverse proxy with automatic HTTPS? (y/n)" "y"
  [ "${REPLY,,}" = "y" ] && SETUP_CADDY=1
fi

# ---------- API keys (all optional — everything is also settable later in the app: Admin → Keys & Integrations) ----------
printf '\n  %sAPI keys%s — press Enter to skip any of them; the app asks again on its %sKeys & Integrations%s page.\n' "$B" "$N" "$B" "$N"
ask_key(){ # $1=env $2=label $3=signup $4=where $5=how  -> sets REPLY
  printf '\n  %s▸ %s%s\n' "$C" "$B$2$N" ""
  [ -n "$3" ] && printf '    %ssign up:%s %s\n' "$D" "$N" "$3"
  [ -n "$4" ] && printf '    %sget key:%s %s\n' "$D" "$N" "$4"
  printf '    %s\n' "$5"
  printf '  %s%s%s: ' "$D" "$1" "$N"
  read -r REPLY || true
}

ask_key "STRIPE_PUBLISHABLE_KEY" "Stripe publishable key" "https://stripe.com" "https://dashboard.stripe.com/apikeys" \
  "Dashboard → Developers → API keys → Publishable key (pk_live_… for real charges, pk_test_… for safe testing)."
PK="$REPLY"
ask_key "STRIPE_SECRET_KEY" "Stripe secret key" "" "https://dashboard.stripe.com/apikeys" \
  "Same page → Secret key → Reveal. Guard it like a password — it can move money."
SK="$REPLY"
ask_key "STRIPE_WEBHOOK_SECRET" "Stripe webhook signing secret" "" "https://dashboard.stripe.com/webhooks" \
  "Developers → Webhooks → Add endpoint → paste https://<your-domain>/api/stripe/webhook → select invoice.paid, invoice.payment_failed, invoice.voided, invoice.marked_uncollectible, credit_note.created, checkout.session.completed → copy the Signing secret (whsec_…)."
WH="$REPLY"
ask_key "OPENROUTER_API_KEY" "OpenRouter key — FREE AI default" "https://openrouter.ai" "https://openrouter.ai/keys" \
  "Free key that powers the website chat assistant and all AI agents (free models). Keys → Create Key."
OR_KEY="$REPLY"
ask_key "ANTHROPIC_API_KEY" "Claude key — optional, paid" "https://console.anthropic.com" "https://console.anthropic.com/settings/keys" \
  "API keys → Create key. Higher-quality agent brains."
AN_KEY="$REPLY"
ask_key "OPENAI_API_KEY" "ChatGPT key — optional, paid" "https://platform.openai.com" "https://platform.openai.com/api-keys" \
  "API keys → Create new secret key."
OA_KEY="$REPLY"
ask_key "GEMINI_API_KEY" "Gemini key — optional, free tier" "https://aistudio.google.com" "https://aistudio.google.com/apikey" \
  "Get API key. Free tier available."
GM_KEY="$REPLY"
CRON_SEC="$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)"

# ---------- 3. Install files ----------
step "Installing to $INSTALL_DIR"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$INSTALL_DIR"
# copy app (exclude dev artifacts, secrets, local data, VCS)
tar -C "$APP_SRC" -cf - \
    --exclude=.git --exclude=.env --exclude='*.bak' --exclude=PREVIEW.html \
    --exclude='data/db.json' --exclude='data/backups' --exclude='data/uploads' \
    . | tar -C "$INSTALL_DIR" -xf -
mkdir -p "$INSTALL_DIR/data/backups" "$INSTALL_DIR/data/uploads"
chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
chmod 750 "$INSTALL_DIR" "$INSTALL_DIR/data"
ok "Files installed"

# ---------- 4. .env ----------
step "Writing configuration"
ENV_FILE="$INSTALL_DIR/.env"
umask 077
{
  echo "# Lines & Logos Business OS — generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Manage keys anytime in the app: Admin → Keys & Integrations"
  echo "PORT=$PORT"
  [ -n "$DOMAIN" ] && echo "PUBLIC_DOMAIN=$DOMAIN"
  [ -n "$PK" ] && echo "STRIPE_PUBLISHABLE_KEY=$PK"
  [ -n "$SK" ] && echo "STRIPE_SECRET_KEY=$SK"
  [ -n "$WH" ] && echo "STRIPE_WEBHOOK_SECRET=$WH"
  [ -n "$OR_KEY" ] && echo "OPENROUTER_API_KEY=$OR_KEY"
  [ -n "$AN_KEY" ] && echo "ANTHROPIC_API_KEY=$AN_KEY"
  [ -n "$OA_KEY" ] && echo "OPENAI_API_KEY=$OA_KEY"
  [ -n "$GM_KEY" ] && echo "GEMINI_API_KEY=$GM_KEY"
  echo "CRON_SECRET=$CRON_SEC"
} > "$ENV_FILE"
chown "$APP_USER:$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
ok ".env written (mode 600, owner $APP_USER)"

# ---------- 5. systemd ----------
step "Creating systemd service"
cat > /etc/systemd/system/lines-logos.service <<EOF
[Unit]
Description=Lines & Logos Business OS
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$INSTALL_DIR/data

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now lines-logos.service >/dev/null 2>&1
sleep 2
systemctl is-active --quiet lines-logos.service || die "Service failed to start — run: journalctl -u lines-logos -n 50"
ok "Service running (systemctl status lines-logos)"

# ---------- 6. Optional Caddy ----------
if [ "$SETUP_CADDY" -eq 1 ]; then
  step "Installing Caddy (automatic HTTPS)"
  apt-get install -y caddy >/dev/null 2>&1 || {
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update >/dev/null && apt-get install -y caddy >/dev/null
  }
  cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
    reverse_proxy 127.0.0.1:$PORT
}
EOF
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
  ok "HTTPS enabled for $DOMAIN"
fi

# ---------- 7. Firewall ----------
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ok "Firewall rules added (ufw)"
fi

# ---------- 8. Summary ----------
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
URL="http://$IP:$PORT"
[ -n "$DOMAIN" ] && URL="https://$DOMAIN"
printf '\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$G" "$N"
printf '%s  %s installed successfully%s\n' "$B" "$APP_TITLE" "$N"
printf '  Open: %s%s%s\n' "$B$URL/login.html$N" "" ""
printf '  The FIRST person to open that page creates the owner account.\n'
printf '  Keys: add/replace any time at Admin → Keys & Integrations (with signup links).\n'
printf '  Skipped Stripe? The go-live checklist inside the app walks you through live keys.\n'
printf '  Useful commands:\n'
printf '    systemctl status lines-logos    — service status\n'
printf '    journalctl -u lines-logos -f    — live logs\n'
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$G" "$N"
