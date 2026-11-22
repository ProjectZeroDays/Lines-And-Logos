// Preload — keeps the web page isolated; exposes only an app marker.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('LL_DESKTOP', { platform: process.platform, shell: 'electron' });
