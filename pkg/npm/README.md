# lines-and-logos-os

Run the Lines & Logos Business OS without cloning or building anything.

```bash
npx lines-and-logos-os              # start on http://localhost:8080
npx lines-and-logos-os doctor         # check the environment first
npx lines-and-logos-os start --port 9000 --data /var/lib/ll-os
```

## What the admin gets

- Marketing site, Business OS dashboards, client/crew/partner portals
- Quotes + CRM, calendar, finance, chat, automation agents
- First-run creates an admin login and prints it to the terminal

## Layout (published package)

```
bin/cli.js        launcher (start | doctor)
server.js         the app server (bundled at publish time)
app/              static front end
data/             default seed data
```

## Release checklist (owner)

1. From repo root: `cp -r server.js lib app data pkg/npm/` (or wire a build step).
2. `cd pkg/npm && npm version patch && npm publish --access public`
   (remove `"private": true` from package.json to publish).
3. Tag the release: `git tag v1.0.0 && git push --tags`.

## Package targets

- **npm/npx** — this package
- **snap** — `pkg/linux/snap/snapcraft.yaml` (icon: `pkg/icons/dist/linux/hicolor/512x512/apps/lines-and-logos.png`)
- **deb** — `pkg/linux/deb/` (desktop file + DEBIAN control)
