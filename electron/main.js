/* Lines & Logos Business OS — desktop shell (Windows + macOS).
 *
 * Landing page is always the LOGIN page. Two connection modes:
 *   1. Remote server: if a server URL is configured (env LINES_LOGOS_URL or
 *      via the tray/menu "Change server…" prompt), the app loads that server's
 *      login page — nothing runs locally.
 *   2. Standalone (default): spawns the bundled zero-dependency Node server
 *      and loads its login page. All data stays on this machine.
 *
 * The chosen server URL is remembered in the user-data folder, so the app
 * reopens on the login page of the same server every launch.
 */
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PREFERRED_PORT = Number(process.env.PORT || 3001);
let server = null, win = null, currentUrl = '';

/* ---------- remembered server URL ---------- */
function serverUrlFile(){ return path.join(app.getPath('userData'), 'server.json'); }
function readServerUrl(){
  try { const u = String(JSON.parse(fs.readFileSync(serverUrlFile(), 'utf8')).url || '').trim(); return /^https?:\/\//.test(u) ? u.replace(/\/+$/,'') : ''; } catch { return ''; }
}
function writeServerUrl(url){
  try { fs.writeFileSync(serverUrlFile(), JSON.stringify({ url }, null, 2)); } catch {}
}

/* ---------- local bundled server ---------- */
function serverRoot(){ return app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..'); }
function portFree(port){ return new Promise(res => { const s = net.createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1'); }); }
async function freePort(start){ for (let p = start; p < start + 20; p++) if (await portFree(p)) return p; return start; }

async function startLocalServer(){
  const port = await freePort(PREFERRED_PORT);
  server = spawn(process.execPath, [path.join(serverRoot(), 'server.js')], {
    env: { ...process.env, PORT: String(port) },
    cwd: serverRoot(),
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  server.on('exit', code => { if (code && win) dialog.showErrorBox('Server stopped', 'The local server exited unexpectedly (code ' + code + ').'); });
  app.on('quit', () => { try { server.kill(); } catch {} });
  return `http://localhost:${port}`;
}

async function reachable(url){
  try { const r = await fetch(url + '/api/health', { signal: AbortSignal.timeout(4000) }); return r.ok; } catch { return false; }
}

/* ---------- CLI alias + desktop shortcut: autodropshipstore ----------
 * First launch (and via Server → "Install desktop shortcut & CLI…"):
 *   Windows : writes %LOCALAPPDATA%\LinesAndLogos\bin\autodropshipstore.cmd
 *             launching this app, adds that folder to the user PATH (so
 *             Win+R → autodropshipstore and any terminal work), and puts a
 *             desktop shortcut pointing at the .cmd.
 *   macOS   : writes ~/.local/bin/autodropshipstore, ensures ~/.local/bin is
 *             on PATH (~/.zshrc / ~/.profile), symlinks the app to ~/Desktop.
 *   Linux   : same as macOS, plus a freedesktop .desktop file on ~/Desktop.
 */
function cliInstallFlag(){ return path.join(app.getPath('userData'), 'cli-installed.json'); }
function installCliShortcut({ quiet } = {}){
  const execPath = process.execPath;
  const results = [];
  try {
    if (process.platform === 'win32'){
      const binDir = path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData\\Local'), 'LinesAndLogos', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      const cmdFile = path.join(binDir, 'autodropshipstore.cmd');
      fs.writeFileSync(cmdFile, `@echo off\r\nREM autodropshipstore - Lines & Logos Business OS\r\nstart "" "${execPath}" %*\r\n`);
      // add binDir to the per-user PATH (read-modify-write via reg.exe)
      try {
        const cur = require('child_process').execSync('reg query HKCU\\Environment /v Path 2>nul', { encoding: 'utf8' });
        const m = cur.match(/REG_(?:EXPAND_)?SZ\s+(.+)$/m);
        const val = m ? m[1].trim() : '';
        if (!val.split(';').some(p => p.toLowerCase() === binDir.toLowerCase())){
          require('child_process').execSync(`reg add HKCU\\Environment /v Path /t REG_EXPAND_SZ /d "${val ? val + ';' : ''}${binDir}" /f`, { encoding: 'utf8' });
          require('child_process').execSync('setx TEMP %TEMP% >nul 2>nul'); // broadcast-ish refresh
          results.push('Added to your PATH (open a new terminal or Win+R for it to take effect).');
        } else results.push('Already on your PATH.');
      } catch { results.push('Could not edit PATH automatically — add "' + binDir + '" to your user PATH manually.'); }
      // desktop shortcut
      const desktop = path.join(app.getPath('home'), 'Desktop');
      if (fs.existsSync(desktop)){
        const vbs = path.join(app.getPath('temp'), 'll-shortcut.vbs');
        const lnk = path.join(desktop, 'Lines & Logos Business OS.lnk');
        fs.writeFileSync(vbs, `Set s = CreateObject("WScript.Shell").CreateShortcut("${lnk.replace(/\\/g, '\\\\')}")\r\ns.TargetPath = "${cmdFile.replace(/\\/g, '\\\\')}"\r\ns.IconLocation = "${execPath.replace(/\\/g, '\\\\')},0"\r\ns.Save\r\n`);
        require('child_process').execSync(`cscript //nologo "${vbs}"`, { encoding: 'utf8' });
        fs.unlinkSync(vbs);
        results.push('Desktop shortcut created.');
      }
    } else {
      const binDir = path.join(app.getPath('home'), '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      const shim = path.join(binDir, 'autodropshipstore');
      fs.writeFileSync(shim, `#!/bin/sh\n# autodropshipstore - Lines & Logos Business OS\nexec "${execPath}" "$@"\n`, { mode: 0o755 });
      results.push('CLI alias installed at ~/.local/bin/autodropshipstore.');
      // make sure ~/.local/bin is on PATH
      const line = 'export PATH="$HOME/.local/bin:$PATH"';
      for (const rc of ['.zshrc', '.profile', '.bashrc']){
        const f = path.join(app.getPath('home'), rc);
        let content = '';
        try { content = fs.readFileSync(f, 'utf8'); } catch {}
        if (content.includes('.local/bin')) continue; // already covered
        try { fs.appendFileSync(f, `\n# Lines & Logos Business OS\n${line}\n`); results.push(`Added ${line} to ~/${rc}.`); break; }
        catch {}
      }
      // desktop entry / alias
      const desktop = path.join(app.getPath('home'), 'Desktop');
      if (fs.existsSync(desktop)){
        if (process.platform === 'darwin'){
          try { fs.symlinkSync(path.dirname(execPath), path.join(desktop, 'Lines & Logos Business OS.app'), 'dir'); results.push('Desktop alias created.'); } catch {}
        } else {
          const de = path.join(desktop, 'lines-and-logos-business-os.desktop');
          fs.writeFileSync(de, `[Desktop Entry]\nName=Lines & Logos Business OS\nExec=${shim}\nIcon=${path.join(process.resourcesPath || path.dirname(execPath), 'app', 'icons', 'icon-512.png')}\nType=Application\nTerminal=false\n`, { mode: 0o755 });
          try { fs.chmodSync(de, 0o755); } catch {}
          results.push('Desktop shortcut created (right-click → Allow Launching if your desktop asks).');
        }
      }
    }
    fs.writeFileSync(cliInstallFlag(), JSON.stringify({ at: new Date().toISOString() }));
  } catch (e) {
    results.push('Install error: ' + (e && e.message ? e.message : e));
  }
  if (!quiet && win) dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], message: 'Desktop shortcut & CLI — autodropshipstore', detail: results.join('\n') });
  return results;
}

/* ---------- window ---------- */
function createWindow(url){
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    backgroundColor: '#04060d',
    title: 'Lines & Logos — Business OS',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL(url + '/login.html');   // the login page is the landing page
  win.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https?:/.test(u)) shell.openExternal(u); return { action: 'deny' }; });
  buildMenu();
}

function buildMenu(){
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Server',
      submenu: [
        { label: 'Open login page', click: () => win && win.loadURL(currentUrl + '/login.html') },
        { label: 'Change server…', click: async () => {
            const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['Connect to a server URL', 'Run local server on this machine', 'Cancel'],
              defaultId: 0, cancelId: 2,
              message: 'Which server should this app use?',
              detail: 'Current: ' + (currentUrl.startsWith('http://localhost') ? 'local server on this machine' : currentUrl) });
            if (r.response === 0){
              const p = await promptUrl();
              if (p){ writeServerUrl(p); app.relaunch(); app.exit(0); }
            } else if (r.response === 1){
              writeServerUrl(''); app.relaunch(); app.exit(0);
            }
          } },
        { type: 'separator' },
        { label: 'Install desktop shortcut & CLI (autodropshipstore)', click: () => installCliShortcut() },
        { type: 'separator' },
        { label: 'Copy server address', click: () => require('electron').clipboard.writeText(currentUrl) },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function promptUrl(){
  // simple modal input via a small data-url window
  const inputWin = new BrowserWindow({ width: 480, height: 220, parent: win, modal: true, resizable: false,
    autoHideMenuBar: true, title: 'Server URL', webPreferences: { contextIsolation: true } });
  await inputWin.loadURL('data:text/html,' + encodeURIComponent(`<!doctype html><body style="margin:0;background:#0d1526;color:#e8ecf6;font:15px system-ui;display:flex;flex-direction:column;gap:12px;padding:22px">
    <b>Server URL</b><input id="u" placeholder="https://os.yourcompany.com" value="${readServerUrl()}" style="padding:11px;border-radius:9px;border:1px solid #2a3c66;background:#0a1122;color:#e8ecf6;font-size:15px">
    <div style="display:flex;gap:10px"><button onclick="go()" style="flex:1;padding:11px;border:none;border-radius:9px;background:#2d5bff;color:#fff;font-weight:700;cursor:pointer">Connect</button>
    <button onclick="window.close()" style="padding:11px 18px;border-radius:9px;border:1px solid #2a3c66;background:transparent;color:#8b95b3;cursor:pointer">Cancel</button></div>
    <script>function go(){require('electron').ipcRenderer.send('server-url',document.getElementById('u').value)}window.addEventListener('keydown',e=>{if(e.key==='Enter')go()});document.getElementById('u').focus()<\/script></body>`));
  return new Promise(res => {
    const { ipcMain } = require('electron');
    const h = (_e, v) => { ipcMain.removeListener('server-url', h); inputWin.close(); res(/^https?:\/\/.+/.test(v) ? v.replace(/\/+$/,'') : ''); };
    ipcMain.on('server-url', h);
    inputWin.on('closed', () => { ipcMain.removeListener('server-url', h); res(''); });
  });
}

/* ---------- boot ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', () => { if (win) { win.focus(); win.loadURL(currentUrl + '/login.html'); } });

app.whenReady().then(async () => {
  const envUrl = (process.env.LINES_LOGOS_URL || '').trim();
  const savedUrl = readServerUrl();
  const candidate = envUrl || savedUrl;
  if (candidate && await reachable(candidate)) currentUrl = candidate;
  else currentUrl = await startLocalServer();
  createWindow(currentUrl);
  // one-time: desktop shortcut + CLI alias (safe to re-run from the Server menu)
  try { if (!fs.existsSync(cliInstallFlag())) installCliShortcut({ quiet: true }); } catch {}
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(currentUrl); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
