# Icons — Lines & Logos

**Source of truth:** `icons/icon-512.png` — the logo mark, square, transparent
background. Do **not** use `logo-hero.png` (widescreen, black background) for app icons.

## Regenerate everything

```bash
pip install pillow
python3 pkg/icons/generate-icons.py
```

## What gets produced

| Output | Format | Used by |
|---|---|---|
| `icons/favicon.ico` | ICO 16/32/48 | Browsers (classic) |
| `icons/favicon-16.png`, `favicon-32.png` | PNG | Browsers (modern) |
| `icons/apple-touch-icon.png` | PNG 180 (opaque) | iOS home screen |
| `icons/icon-192.png`, `icon-512.png` | PNG | PWA manifest (existing files refreshed) |
| `icons/icon-maskable-512.png` | PNG | PWA manifest `maskable` purpose |
| `pkg/icons/dist/windows/icon.ico` | ICO 16–256 | Windows app / installer / Electron |
| `pkg/icons/dist/macos/icon.icns` | ICNS 16–1024 | macOS app bundle / Electron / dmg |
| `pkg/icons/dist/macos/icon.iconset/` | PNG set | Alternative: `iconutil -c icns` |
| `pkg/icons/dist/linux/hicolor/**` | PNG 16–512 | snap, deb → `/usr/share/icons/hicolor/…` |

The `.icns` is written in pure Python — no Mac required.

## npm package

`pkg/npm/` contains the npm/npx package (`lines-and-logos-os`).
See `pkg/npm/README.md` for release steps.
