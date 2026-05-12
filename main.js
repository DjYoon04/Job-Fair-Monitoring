// main.js - Electron Main Process
// Now supports two network roles:
//   SERVER – runs the local PostgreSQL connection + Express HTTP API server.
//            Other PCs on the LAN connect to this machine.
//   CLIENT – connects to a remote server via HTTP; no local DB connection needed.
//
// On first launch the app shows a setup dialog to choose the role.
// The choice is persisted to userData/network-config.json.

const path = require('path');
require('dotenv').config();

let app, BrowserWindow, Menu, globalShortcut, ipcMain, dialog;

try {
  const electron = require('electron');
  if (typeof electron === 'string') {
    console.error('ERROR: electron module returned a string path.');
    process.exit(1);
  }
  app           = electron.app;
  BrowserWindow = electron.BrowserWindow;
  Menu          = electron.Menu;
  globalShortcut= electron.globalShortcut;
  ipcMain       = electron.ipcMain;
  dialog        = electron.dialog;

  if (!app) {
    console.error('ERROR: Could not extract app from electron module');
    process.exit(1);
  }
} catch (err) {
  console.error('ERROR: Failed to load electron:', err.message);
  process.exit(1);
}

const netCfg    = require('./network/config-manager');
const apiServer = require('./network/api-server');
const apiClient = require('./network/api-client');
const { getLocalIP, getAllLocalIPs } = require('./network/ip-detector');

if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
}

let mainWindow       = null;
let handlersRegistered = false;
let currentRole      = null;   // 'server' | 'client'

// ─── window helpers ──────────────────────────────────────────────────────────

function createWindow() {
  // Always show the network setup screen on every launch.
  // The setup screen itself handles connectivity verification before
  // proceeding, so we never land in the main app with a stale/dead config.
  mainWindow = new BrowserWindow({
    width:     600,
    height:    620,
    minWidth:  520,
    minHeight: 560,
    resizable: false,
    title: 'Job Fair Monitoring System',
    icon: path.join(__dirname, 'src', 'img', 'dmw_logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'network-setup.html'));
  console.log('[SETUP] Showing network setup screen');

  const menu = Menu.buildFromTemplate([]);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerKeyboardShortcuts() {
  globalShortcut.register('CmdOrCtrl+R', () => {
    if (mainWindow) { mainWindow.reload(); }
  });
  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    if (mainWindow) { mainWindow.webContents.reloadIgnoringCache(); }
  });
}

// ─── IPC: network config & info ──────────────────────────────────────────────

function registerNetworkHandlers() {
  // Renderer asks for the current role and server IP
  ipcMain.handle('network:getConfig', () => {
    const cfg = netCfg.read();
    return {
      role:     cfg.role,
      serverIp: cfg.serverIp,
      localIp:  getLocalIP(),
      allIps:   getAllLocalIPs(),
      apiPort:  apiServer.DEFAULT_PORT,
    };
  });

  // Renderer submits the setup form (role + optional serverIp)
  ipcMain.handle('network:saveConfig', async (_, { role, serverIp }) => {
    if (!['server', 'client'].includes(role)) {
      throw new Error('Role must be "server" or "client".');
    }
    if (role === 'client') {
      if (!serverIp || !/^\d{1,3}(\.\d{1,3}){3}$/.test(serverIp.trim())) {
        throw new Error('Please enter a valid server IP address.');
      }
      // Test connectivity before saving
      apiClient.configure(serverIp.trim(), apiServer.DEFAULT_PORT);
      const reachable = await apiClient.ping();
      if (!reachable) {
        throw new Error(
          `Cannot reach server at ${serverIp.trim()}:${apiServer.DEFAULT_PORT}.\n` +
          'Make sure the server is running and on the same network.'
        );
      }
    }

    netCfg.write({ role, serverIp: serverIp?.trim() || null });
    currentRole = role;

    // Apply the new role — skip if already activated at startup (guards against
    // double-registering handlers or starting the API server twice).
    if (role === 'server') {
      if (!handlersRegistered) {
        try {
          const { registerAllHandlers } = require('./ipc/handlers');
          registerAllHandlers();
          handlersRegistered = true;
        } catch (e) {
          console.error('[ERROR] Error registering handlers after setup:', e.message);
        }
      }
      if (!apiServer.isRunning()) {
        try { await apiServer.start(); } catch(e) { console.error('[API]', e.message); }
      }
    } else if (role === 'client') {
      // Always (re-)configure the client in case the IP changed
      apiClient.configure(serverIp.trim(), apiServer.DEFAULT_PORT);
      // registerClientProxyHandlers() is idempotent (guards internally)
      registerClientProxyHandlers();
    }

    // Reload main window to the full app
    if (mainWindow) {
      mainWindow.setResizable(true);
      mainWindow.setSize(1400, 900);
      mainWindow.setMinimumSize(1100, 700);
      mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    }

    return { ok: true };
  });

  // Renderer can ask to re-detect the local IP at any time
  ipcMain.handle('network:getLocalIP', () => ({
    ip:   getLocalIP(),
    all:  getAllLocalIPs(),
    port: apiServer.DEFAULT_PORT,
  }));

  // Renderer can reset config to trigger the setup screen again on next launch
  ipcMain.handle('network:resetConfig', () => {
    netCfg.clear();
    return { ok: true };
  });

  // Renderer can ping a specific IP to test reachability
  ipcMain.handle('network:ping', async (_, ip) => {
    apiClient.configure(ip, apiServer.DEFAULT_PORT);
    const ok = await apiClient.ping();
    return { ok };
  });

  // Renderer queries whether the API server is running (server role)
  ipcMain.handle('network:serverStatus', () => {
    const addr = apiServer.getAddress();
    return addr
      ? { running: true,  ip: addr.ip, port: addr.port }
      : { running: false, ip: null,    port: null };
  });
}

// ─── boot sequence ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log('[START] App ready');

  // Init config manager (needs userData path → only available after app ready)
  netCfg.init(app.getPath('userData'));

  // Register network IPC handlers first (always, regardless of role)
  registerNetworkHandlers();

  // ── Apply any previously-saved role immediately so IPC handlers are ready
  // before the setup screen loads. Without this, a client-role PC on relaunch
  // would have no proxy handlers registered while the setup screen is shown,
  // and any early IPC call would fall through to a local (non-existent) DB.
  const savedCfg = netCfg.read();
  if (savedCfg.role === 'server') {
    console.log('[ROLE] Restoring saved role: server');
    try {
      const { registerAllHandlers } = require('./ipc/handlers');
      registerAllHandlers();
      handlersRegistered = true;
    } catch (e) {
      console.error('[ERROR] Error registering server handlers on restore:', e.message);
    }
    try { await apiServer.start(); } catch (e) { console.error('[API]', e.message); }
    currentRole = 'server';
  } else if (savedCfg.role === 'client' && savedCfg.serverIp) {
    console.log('[ROLE] Restoring saved role: client →', savedCfg.serverIp);
    apiClient.configure(savedCfg.serverIp, apiServer.DEFAULT_PORT);
    registerClientProxyHandlers();
    currentRole = 'client';
  } else {
    console.log('[ROLE] No saved role. Setup screen will prompt user.');
  }

  createWindow();
  registerKeyboardShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ─── CLIENT: proxy every IPC call to the HTTP API ────────────────────────────

let clientProxyHandlersRegistered = false;

function registerClientProxyHandlers() {
  if (clientProxyHandlersRegistered) {
    console.log('[IPC] Client proxy handlers already registered, skipping.');
    return;
  }
  clientProxyHandlersRegistered = true;

  // Helper: wraps each apiClient method as an ipcMain.handle
  function proxy(channel, fn) {
    ipcMain.handle(channel, async (_, ...args) => fn(...args));
  }

  proxy('auth:initialize',          ()     => apiClient.initializeAuth());
  proxy('auth:login',               (c)    => apiClient.login(c));
  proxy('auth:logout',              (t)    => apiClient.logout(t));
  proxy('auth:getSessionUser',      (t)    => { apiClient.setSessionToken(t); return apiClient.getSessionUser(t); });

  proxy('user:getAll',              (t)    => { apiClient.setSessionToken(t); return apiClient.getUsers(); });
  proxy('user:create',              (d)    => apiClient.createUser(d));
  proxy('user:updateRole',          (d)    => apiClient.updateUserRole(d));
  proxy('user:delete',              (d)    => apiClient.deleteUser(d));
  proxy('user:updateOwnProfile',    (d)    => apiClient.updateOwnProfile(d));
  proxy('user:changeOwnPassword',   (d)    => apiClient.changeOwnPassword(d));

  proxy('db:test',                  ()     => apiClient.testConnection());
  proxy('db:getFiscalYears',        ()     => apiClient.getFiscalYears());

  proxy('dashboard:stats',          ()     => apiClient.getDashboardStats());

  proxy('agency:getAll',            ()     => apiClient.getAgencies());
  proxy('agency:getById',           (id)   => apiClient.getAgencyById(id));
  proxy('agency:getByType',         (t)    => apiClient.getAgenciesByType(t));
  proxy('agency:create',            (d)    => apiClient.createAgency(d));
  proxy('agency:update',            (d)    => apiClient.updateAgency(d));
  proxy('agency:delete',            (id)   => apiClient.deleteAgency(id));

  proxy('venue:getAll',             ()     => apiClient.getVenues());
  proxy('venue:getById',            (id)   => apiClient.getVenueById(id));
  proxy('venue:create',             (d)    => apiClient.createVenue(d));
  proxy('venue:update',             (d)    => apiClient.updateVenue(d));
  proxy('venue:delete',             (id)   => apiClient.deleteVenue(id));

  proxy('jfa:getAll',               (f)    => apiClient.getJfaRecords(f));
  proxy('jfa:getById',              (id)   => apiClient.getJfaById(id));
  proxy('jfa:create',               (d)    => apiClient.createJfa(d));
  proxy('jfa:update',               (d)    => apiClient.updateJfa(d));
  proxy('jfa:delete',               (id)   => apiClient.deleteJfa(id));
  proxy('jfa:updateDocuments',      (d)    => apiClient.updateJfaDocuments(d));
  proxy('jfa:getDocumentStatus',    (f)    => apiClient.getJfaDocumentStatus(f));

  proxy('jobfair:getAll',           (f)    => apiClient.getJobFairEvents(f));
  proxy('jobfair:getById',          (id)   => apiClient.getJobFairById(id));
  proxy('jobfair:create',           (d)    => apiClient.createJobFairEvent(d));
  proxy('jobfair:update',           (d)    => apiClient.updateJobFairEvent(d));
  proxy('jobfair:delete',           (id)   => apiClient.deleteJobFairEvent(id));
  proxy('jobfair:addParticipant',   (d)    => apiClient.addParticipant(d));
  proxy('jobfair:updateParticipant',(d)    => apiClient.updateParticipant(d));
  proxy('jobfair:deleteParticipant',(id)   => apiClient.deleteParticipant(id));

  proxy('monitoring:getAll',            (f) => apiClient.getMonitoringRecords(f));
  proxy('monitoring:getById',           (id)=> apiClient.getMonitoringById(id));
  proxy('monitoring:create',            (d) => apiClient.createMonitoring(d));
  proxy('monitoring:update',            (d) => apiClient.updateMonitoring(d));
  proxy('monitoring:delete',            (id)=> apiClient.deleteMonitoring(id));
  proxy('monitoring:pickEvidencePath',  ()  => apiClient.pickMonitoringEvidencePath());
  proxy('monitoring:openEvidencePath',  (p) => apiClient.openMonitoringEvidencePath(p));
  proxy('monitoring:uploadEvidence',    (d) => apiClient.uploadEvidenceFiles(d.filePaths, d.folder));
  proxy('monitoring:listEvidence',      (p) => apiClient.listEvidencePath(p));
  proxy('monitoring:downloadEvidenceZip', (p) => apiClient.downloadEvidenceZip(p));
  proxy('monitoring:downloadBatchZip',  (paths) => apiClient.downloadBatchZip(paths));

  proxy('summary:jfa',              (y)   => apiClient.getJfaSummary(y));
  proxy('summary:jobfair',          (y)   => apiClient.getJobFairSummary(y));
  proxy('summary:monitoring',       (y)   => apiClient.getMonitoringSummary(y));
  proxy('summary:eventDetails',     (f)   => apiClient.getEventDetails(f));
  proxy('summary:yearlyTotals',     (y)   => apiClient.getYearlyTotals(y));

  console.log('[IPC] Client proxy handlers registered');
}

// ─── shutdown ─────────────────────────────────────────────────────────────────

app.on('window-all-closed', async () => {
  globalShortcut.unregisterAll();

  if (currentRole === 'server') {
    await apiServer.stop();
    const db = require('./database/connection');
    await db.close();
  }

  if (process.platform !== 'darwin') app.quit();
});
