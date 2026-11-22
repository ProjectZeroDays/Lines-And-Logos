#!/usr/bin/env bash
# Lines & Logos Business OS — launcher (Linux/macOS)
cd "$(dirname "$0")"
PORT="${PORT:-3001}"
echo "Starting Lines & Logos Business OS on port $PORT ..."
exec node server.js
