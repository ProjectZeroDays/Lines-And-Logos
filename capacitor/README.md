# Lines & Logos — Mobile App (Android / iOS)

Capacitor wrapper around the Business OS. **The login page is the landing page:** on first launch the app asks for your server address once (with a live reachability check), remembers it, and opens the server's login page from then on. *Use a different server* is always available on the loading screen.

The server itself is never bundled — this is a client for your VPS/desktop deployment, so the whole team shares one database.

## Build an Android APK / AAB
```bash
cd capacitor
npm install
npx cap add android        # once
npx cap sync android
npx cap open android       # Android Studio → Run ▶ or Build > Generate Signed Bundle/APK
```
For a release: Build → Generate Signed App Bundle (Play Store) or APK (direct install). Package name: `com.linesandlogos.businessos`.

## iOS (Mac only)
```bash
npx cap add ios && npx cap sync ios && npx cap open ios
```

## Notes
- `allowMixedContent` is enabled and cleartext is permitted so the app can reach `http://` servers on local networks (e.g. a machine running the desktop/NSIS install). Production servers should use HTTPS.
- If the saved server stops responding, the app returns to the server-address screen instead of showing a dead WebView.
