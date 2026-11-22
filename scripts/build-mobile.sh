#!/bin/bash
# Build the mobile wrapper: stage web assets into capacitor/www and sync native projects.
# Usage: scripts/build-mobile.sh   (from repo root; requires node + npm)
set -e
cd "$(dirname "$0")/.."
mkdir -p capacitor/www
rm -rf capacitor/www/* 
# stage web app (same files the desktop/electron bundle ships)
cp -r *.html assets data icons manifest.webmanifest capacitor/www/ 2>/dev/null || true
cp logo-hero.png capacitor/www/ 2>/dev/null || true
# point the app at your hosted Business OS server (set SERVER_URL when building for real devices)
if [ -n "$SERVER_URL" ]; then
  node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('capacitor/capacitor.config.json'));c.server.url='$SERVER_URL';fs.writeFileSync('capacitor/capacitor.config.json',JSON.stringify(c,null,2))"
  echo "server.url set to $SERVER_URL"
fi
cd capacitor
if [ ! -d node_modules ]; then npm install; fi
npx cap sync
echo "Mobile projects synced. Build with: npx cap build android  (or open ios in Xcode: npx cap open ios)"
