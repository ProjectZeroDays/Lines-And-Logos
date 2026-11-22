# Android TWA (Trusted Web Activity) — Google Play

The site is already a fully installable PWA, so the Play Store release is a thin
TWA wrapper generated with **Bubblewrap** (or PWABuilder, which automates the
same output).

## One-time setup

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.webmanifest
# answer: package id com.linesandlogos.twa, start URL /login.html?source=pwa
bubblewrap build        # produces app-release-signed.apk / .aab
```

## Digital Asset Links (required)

Play will not grant full-screen TWA behavior until the domain proves the app is
yours. Host `assetlinks.json` (template included in this folder, and already
placed at `/.well-known/assetlinks.json` in the app root) at:

```
https://YOUR-DOMAIN/.well-known/assetlinks.json
```

Replace `REPLACE_WITH_YOUR_PLAY_SIGNING_SHA256_FINGERPRINT` with the SHA-256 of
your Play App Signing certificate:
Play Console → your app → Setup → App integrity → App signing key certificate.

## Play Console checklist (2026 rules)

- Target API level **36** (required for new apps from Aug 31, 2026) — Bubblewrap
  keeps this current; rebuild if the store warns.
- New **personal** developer accounts must run a closed test with **12 testers
  for 14 days** before production. Organization accounts skip this.
- Content rating, data-safety form (the app collects account + job data),
  and a privacy-policy URL are mandatory.
