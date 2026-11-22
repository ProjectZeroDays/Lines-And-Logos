// Lines & Logos — Electron shell (Windows / macOS / Linux)
// Wraps the published web app so the desktop apps open straight to the login page.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

// Set LL_APP_URL to your published site, e.g. https://lines-and-logos.ok.kimi.link
const BASE = (process.env.LL_APP_URL || 'https://lines-and-logos.ok.kimi.link').replace(/\/$/, '');
const START = BASE + '/login.html?source=app';

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#04060d',
    title: 'Lines & Logos',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(START);

  // Open external links (maps, meet links, mailto) in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BASE)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(BASE)) { e.preventDefault(); shell.openExternal(url); }
  });

  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
