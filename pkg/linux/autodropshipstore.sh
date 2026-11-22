#!/bin/sh
# autodropshipstore — Lines & Logos Business OS
# Usage: autodropshipstore          starts/opens the app in your browser
#        autodropshipstore --shell  runs the server in this terminal instead
# Installed to /usr/local/bin/autodropshipstore by the package postinst.
APP_DIR=/opt/lines-logos
PORT="$(sed -n 's/^PORT=\([0-9][0-9]*\).*/\1/p' "$APP_DIR/.env" 2>/dev/null)"
PORT="${PORT:-3001}"
URL="http://localhost:${PORT}/login.html"

if [ "$1" = "--shell" ]; then
  cd "$APP_DIR" || exit 1
  echo "autodropshipstore: starting Lines & Logos Business OS on port $PORT"
  echo "Open $URL in your browser (Ctrl+C to stop)."
  exec node server.js
fi

if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet lines-logos.service 2>/dev/null; then
    sudo systemctl start lines-logos.service 2>/dev/null \
      || echo "autodropshipstore: could not start the service — run: sudo systemctl start lines-logos"
  fi
  # wait (max ~10s) for the server to answer
  i=0
  while [ "$i" -lt 20 ]; do
    node -e "require('http').get('http://localhost:${PORT}/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" 2>/dev/null && break
    i=$((i+1)); sleep 0.5
  done
  exec xdg-open "$URL" 2>/dev/null || echo "Open $URL in your browser."
fi

# no systemd: run the server directly in this terminal
cd "$APP_DIR" || exit 1
echo "autodropshipstore: starting Lines & Logos Business OS on port $PORT"
echo "Open $URL in your browser (Ctrl+C to stop)."
exec node server.js
