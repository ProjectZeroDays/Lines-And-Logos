# Releases — iOS · Android · macOS · Windows · Linux

Lines & Logos is a **PWA first**: the same codebase installs from the browser on
every platform (Add to Home Screen / Install app). Store releases are thin
wrappers around the published site, so one web deploy updates every app.

All wrappers open to **`/login.html?source=app`** (the PWA opens to
`/login.html?source=pwa`), so installed apps land on the login page.

| Platform | Wrapper | Store | Cost | Guide |
|---|---|---|---|---|
| Android | TWA via Bubblewrap / PWABuilder | Google Play | $25 one-time | `native/twa/README.md` |
| iOS | Capacitor 8 (WKWebView shell) | App Store | $99/yr | below |
| Windows | Electron (electron-builder → NSIS) or MSIX via PWABuilder | Direct download / Microsoft Store | free / ~$19 one-time | below |
| macOS | Electron (electron-builder → DMG) | Direct download | free (+$99/yr to notarize) | below |
| Linux | Electron (electron-builder → AppImage/deb) | Direct download | free | below |

---

## 1 · PWA (no store, all platforms) — already done

`manifest.webmanifest`, `sw.js`, maskable icons, and `?ref=` referral capture
ship with the site. After publishing, open the URL in Chrome/Edge/Safari and use
**Install app**. The installed app starts on the login page
(`start_url: /login.html?source=pwa`).

## 2 · Android — Google Play (TWA)

See `native/twa/README.md`. In short:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.webmanifest
bubblewrap build        # signed .aab for Play Console
```

- Host `/.well-known/assetlinks.json` (template already in this repo at
  `.well-known/assetlinks.json`) with your Play signing SHA-256 fingerprint.
- 2026 requirements: target API 36, closed test (12 testers / 14 days) for new
  personal accounts, data-safety + privacy policy forms.

## 3 · iOS — App Store (Capacitor)

Apple has **no PWA submission path**; the App Store binary is a WKWebView shell:

```bash
cd native/capacitor
npm install
# edit capacitor.config.json → server.url = your published https URL
npm run init:ios        # adds the Xcode project
npm run open:ios        # Xcode: set team, bundle id, icons, then Archive → upload
```

- Requires a Mac with Xcode 26 and a $99/yr Apple Developer account.
- Guideline 4.2 risk: because the shell mirrors the website, add native polish
  before submitting (splash screen — already themed, push notifications via
  `@capacitor/push-notifications`, haptics) and describe the business value in
  App Review notes. Rejections are appealable but plan for one review round.
- Cheaper alternative: PWABuilder's experimental iOS package generates the same
  style of wrapper without writing config by hand.

## 4 · Windows / macOS / Linux — Electron

```bash
cd native/electron
npm install
LL_APP_URL=https://YOUR-DOMAIN npm start     # dev run
npm run dist:win                             # LinesAndLogos-Setup-1.0.0.exe (NSIS)
npm run dist:mac                             # .dmg + .zip (run on a Mac)
npm run dist:linux                           # .AppImage + .deb
```

- **Microsoft Store (optional, free path):** upload the PWA to
  [PWABuilder](https://www.pwabuilder.com) → Windows package → Partner Center.
- **macOSGatekeeper:** unsigned DMGs show a warning (right-click → Open works).
  Distribute signed + notarized with an Apple Developer cert when ready.
- Replace `native/electron/icon.png` with a 1024×1024 master before shipping.

## Release checklist

1. Publish the web app (Kimi publish button) and confirm
   `https://YOUR-DOMAIN/manifest.webmanifest` and `/sw.js` load.
2. Set the final domain in `native/electron/main.js` (`LL_APP_URL` default),
   `native/capacitor/capacitor.config.json`, and Bubblewrap init.
3. Put the Play SHA-256 fingerprint in `.well-known/assetlinks.json`.
4. Build each wrapper, smoke-test login → dashboard on a real device.
5. Store listings: screenshots (375px + desktop already in this UI), privacy
   policy URL, support email.
