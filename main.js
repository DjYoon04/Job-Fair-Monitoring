// main.js - Electron Main Process
const path = require('path');
require('dotenv').config();

let app, BrowserWindow, Menu, globalShortcut;

try {
  // Import Electron components - must be done in Electron's main process context
  const electron = require('electron');

  // If electron is a path string (from npm package), we have the wrong electron
  if (typeof electron === 'string') {
    console.error('ERROR: electron module returned a string path. This shouldn\'t happen.');
    console.error('Electron path:', electron);
    process.exit(1);
  }

  app = electron.app;
  BrowserWindow = electron.BrowserWindow;
  Menu = electron.Menu;
  globalShortcut = electron.globalShortcut;

  if (!app) {
    console.error('ERROR: Could not extract app from electron module');
    console.error('Module type:', typeof electron);
    console.error('Module keys (first 20):', Object.keys(electron).slice(0, 20));
    process.exit(1);
  }
} catch (err) {
  console.error('ERROR: Failed to load electron:', err.message);
  process.exit(1);
}

const db = require('./database/connection');

if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
}

let mainWindow;
let handlersRegistered = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Job Fair Monitoring System',
    icon: path.join(__dirname, 'src', 'img', 'dmw_logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Build menu - hidden menu (empty array)
  const menu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerKeyboardShortcuts() {
  // Ctrl+R - Refresh/Reload the page
  globalShortcut.register('CmdOrCtrl+R', () => {
    if (mainWindow) {
      mainWindow.reload();
      console.log('🔄 Page refreshed (Ctrl+R)');
    }
  });

  // Ctrl+Shift+R - Hard refresh (clear cache and reload)
  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    if (mainWindow) {
      mainWindow.webContents.reloadIgnoringCache();
      console.log('🔄 Hard refresh executed (Ctrl+Shift+R)');
    }
  });

  console.log('⌨️  Keyboard shortcuts registered: Ctrl+R (refresh), Ctrl+Shift+R (hard refresh)');
}

app.whenReady().then(async () => {
  console.log('✅ App ready, registering handlers...');

  // Register IPC handlers AFTER app is ready
  if (!handlersRegistered) {
    try {
      const { registerAllHandlers } = require('./ipc/handlers');
      registerAllHandlers();
      handlersRegistered = true;
      console.log('✅ IPC handlers registered');
    } catch (err) {
      console.error('❌ Error registering handlers:', err.message);
    }
  }

  // Test DB connection
  const connected = await db.testConnection();
  if (!connected) {
    console.warn('⚠️  WARNING: Database connection failed. Check your .env configuration.');
  }

  createWindow();

  // Register keyboard shortcuts
  registerKeyboardShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  await db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
