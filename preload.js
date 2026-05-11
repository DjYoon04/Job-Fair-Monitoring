// preload.js - Secure bridge between renderer and main process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── Auth ──
  initializeAuth: () => ipcRenderer.invoke('auth:initialize'),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: (sessionToken) => ipcRenderer.invoke('auth:logout', sessionToken),
  getSessionUser: (sessionToken) => ipcRenderer.invoke('auth:getSessionUser', sessionToken),
  getUsers: (sessionToken) => ipcRenderer.invoke('user:getAll', sessionToken),
  createUser: (data) => ipcRenderer.invoke('user:create', data),
  updateUserRole: (data) => ipcRenderer.invoke('user:updateRole', data),
  deleteUser: (data) => ipcRenderer.invoke('user:delete', data),
  updateOwnProfile: (data) => ipcRenderer.invoke('user:updateOwnProfile', data),
  changeOwnPassword: (data) => ipcRenderer.invoke('user:changeOwnPassword', data),

  // ── Database ──
  testConnection: () => ipcRenderer.invoke('db:test'),
  getFiscalYears: () => ipcRenderer.invoke('db:getFiscalYears'),

  // ── Dashboard ──
  getDashboardStats: () => ipcRenderer.invoke('dashboard:stats'),

  // ── Agencies ──
  getAgencies: () => ipcRenderer.invoke('agency:getAll'),
  getAgencyById: (id) => ipcRenderer.invoke('agency:getById', id),
  getAgenciesByType: (type) => ipcRenderer.invoke('agency:getByType', type),
  createAgency: (data) => ipcRenderer.invoke('agency:create', data),
  updateAgency: (data) => ipcRenderer.invoke('agency:update', data),
  deleteAgency: (id) => ipcRenderer.invoke('agency:delete', id),

  // ── Venues ──
  getVenues: () => ipcRenderer.invoke('venue:getAll'),
  getVenueById: (id) => ipcRenderer.invoke('venue:getById', id),
  createVenue: (data) => ipcRenderer.invoke('venue:create', data),
  updateVenue: (data) => ipcRenderer.invoke('venue:update', data),
  deleteVenue: (id) => ipcRenderer.invoke('venue:delete', id),

  // ── JFA Records ──
  getJfaRecords: (filters) => ipcRenderer.invoke('jfa:getAll', filters),
  getJfaById: (id) => ipcRenderer.invoke('jfa:getById', id),
  createJfa: (data) => ipcRenderer.invoke('jfa:create', data),
  updateJfa: (data) => ipcRenderer.invoke('jfa:update', data),
  deleteJfa: (id) => ipcRenderer.invoke('jfa:delete', id),
  updateJfaDocuments: (data) => ipcRenderer.invoke('jfa:updateDocuments', data),
  getJfaDocumentStatus: (filters) => ipcRenderer.invoke('jfa:getDocumentStatus', filters),

  // ── Job Fair Events ──
  getJobFairEvents: (filters) => ipcRenderer.invoke('jobfair:getAll', filters),
  getJobFairById: (id) => ipcRenderer.invoke('jobfair:getById', id),
  createJobFairEvent: (data) => ipcRenderer.invoke('jobfair:create', data),
  updateJobFairEvent: (data) => ipcRenderer.invoke('jobfair:update', data),
  deleteJobFairEvent: (id) => ipcRenderer.invoke('jobfair:delete', id),
  addParticipant: (data) => ipcRenderer.invoke('jobfair:addParticipant', data),
  updateParticipant: (data) => ipcRenderer.invoke('jobfair:updateParticipant', data),
  deleteParticipant: (id) => ipcRenderer.invoke('jobfair:deleteParticipant', id),

  // ── Monitoring ──
  getMonitoringRecords: (filters) => ipcRenderer.invoke('monitoring:getAll', filters),
  getMonitoringById: (id) => ipcRenderer.invoke('monitoring:getById', id),
  createMonitoring: (data) => ipcRenderer.invoke('monitoring:create', data),
  updateMonitoring: (data) => ipcRenderer.invoke('monitoring:update', data),
  deleteMonitoring: (id) => ipcRenderer.invoke('monitoring:delete', id),
  pickMonitoringEvidencePath: (mode) => ipcRenderer.invoke('monitoring:pickEvidencePath', mode),
  openMonitoringEvidencePath: (targetPath) => ipcRenderer.invoke('monitoring:openEvidencePath', targetPath),

  // ── Summaries ──
  getJfaSummary: (year) => ipcRenderer.invoke('summary:jfa', year),
  getJobFairSummary: (year) => ipcRenderer.invoke('summary:jobfair', year),
  getMonitoringSummary: (year) => ipcRenderer.invoke('summary:monitoring', year),
  getEventDetails: (filters) => ipcRenderer.invoke('summary:eventDetails', filters),
  getYearlyTotals: (year) => ipcRenderer.invoke('summary:yearlyTotals', year),

  // ── Network / Setup ──────────────────────────────────────────────────────
  // Returns { role, serverIp, localIp, allIps, apiPort }
  getNetworkConfig: () => ipcRenderer.invoke('network:getConfig'),

  // Save chosen role + server IP; validates connectivity for client role
  // Returns { ok: true } or throws an error string
  saveNetworkConfig: (data) => ipcRenderer.invoke('network:saveConfig', data),

  // Returns { ip, all, port } — current machine's LAN IP(s)
  getLocalIP: () => ipcRenderer.invoke('network:getLocalIP'),

  // Clear saved config (shows setup screen on next launch)
  resetNetworkConfig: () => ipcRenderer.invoke('network:resetConfig'),

  // Ping a specific IP to see if the server is reachable: { ok: bool }
  pingServer: (ip) => ipcRenderer.invoke('network:ping', ip),

  // Returns { running, ip, port } for server role; { running: false } for client
  getServerStatus: () => ipcRenderer.invoke('network:serverStatus'),
});
