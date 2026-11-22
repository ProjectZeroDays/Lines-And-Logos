#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org then re-run this file."
  exit 1
fi
( sleep 2; xdg-open http://localhost:3001 >/dev/null 2>&1 ) &
node server.js
