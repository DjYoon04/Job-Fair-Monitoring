// network/config-manager.js
// Persists the network role ('server' | 'client') and server IP address
// to a JSON file in the user's app data directory so the choice survives restarts.

const path = require('path');
const fs   = require('fs');

let _appDataPath = null;   // set once by init()
let _configPath  = null;

/**
 * Must be called once, after app.getPath() is available (i.e. inside app.whenReady).
 * @param {string} appDataDir  - result of app.getPath('userData')
 */
function init(appDataDir) {
  _appDataPath = appDataDir;
  _configPath  = path.join(appDataDir, 'network-config.json');
}

function _ensureInit() {
  if (!_configPath) {
    throw new Error('[NetworkConfig] init() must be called before reading/writing config.');
  }
}

/**
 * Read the stored network config.
 * Returns { role: 'server'|'client'|null, serverIp: string|null }
 */
function read() {
  _ensureInit();
  try {
    if (!fs.existsSync(_configPath)) return { role: null, serverIp: null };
    const raw = fs.readFileSync(_configPath, 'utf8');
    const cfg = JSON.parse(raw);
    return {
      role:     cfg.role     || null,
      serverIp: cfg.serverIp || null,
    };
  } catch {
    return { role: null, serverIp: null };
  }
}

/**
 * Write / update the network config.
 * @param {{ role?: string, serverIp?: string }} updates
 */
function write(updates) {
  _ensureInit();
  const current = read();
  const next = { ...current, ...updates };
  fs.mkdirSync(_appDataPath, { recursive: true });
  fs.writeFileSync(_configPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** Clear stored config (reset to first-run state) */
function clear() {
  _ensureInit();
  if (fs.existsSync(_configPath)) {
    fs.unlinkSync(_configPath);
  }
}

module.exports = { init, read, write, clear };
