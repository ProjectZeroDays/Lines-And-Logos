# Lines & Logos — Desktop App (Windows / macOS)

Electron wrapper around the Business OS. **The login page is the landing page** on every launch.

## Modes
- **Standalone (default):** spawns the bundled zero-dependency Node server; all data stays on the machine. Good for a single office computer.
- **Remote:** connect to your VPS deployment so the whole team uses one shared database. Server → *Change server…* in the menu bar, paste `https://your-domain.com`. The choice is remembered.

## Build
```bash
cd electron
npm install
npm run dist:win    # → dist/Lines & Logos Business OS-Setup-1.0.0.exe (+ portable)
npm run dist:mac    # → dist/*.dmg and *.zip (unsigned — right-click → Open on first launch)
```
Requires Node 18+. Building mac `.dmg` requires macOS; the `.zip` target works from Linux/Windows too.

## CLI alias + desktop shortcut (`autodropshipstore`)
On first launch the app quietly installs a CLI launcher and desktop shortcut:
- **Windows:** `%LOCALAPPDATA%\LinesAndLogos\bin\autodropshipstore.cmd` + user PATH entry → type `autodropshipstore` in any terminal or Win+R. Desktop shortcut included.
- **macOS / Linux:** `~/.local/bin/autodropshipstore` (PATH line added to `~/.zshrc`/`~/.profile`) + Desktop entry/alias.
Re-run anytime from **Server → Install desktop shortcut & CLI (autodropshipstore)**.

## Develop
```bash
npm install
npm start           # runs the app against the parent-folder server
```
