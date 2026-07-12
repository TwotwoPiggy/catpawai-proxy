const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createApp } = require('./clean/app');
const { log } = require('./clean/logger');

// Load environment early
require('dotenv').config();

let mainWindow;

async function startServerAndUI() {
  // Start the proxy server
  const HOST = process.env.HOST || '127.0.0.1';
  const PORT = Number(process.env.PORT || 13000);
  
  const proxyApp = createApp();
  
  await new Promise((resolve) => {
    proxyApp.listen(PORT, HOST, () => {
      log(`CatPawAI Proxy listening on http://${HOST}:${PORT}`);
      resolve();
    });
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'public/favicon.ico') // Optional icon
  });

  // Load the dashboard
  mainWindow.loadURL(`http://${HOST}:${PORT}/`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServerAndUI();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startServerAndUI();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
