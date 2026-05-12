// network/api-client.js
// Drop-in HTTP client used by client-role Electron instances.
// Each method matches the signature expected by preload.js / renderer.js
// so the renderer doesn't need to know whether it's talking to local IPC
// or a remote server.

'use strict';

const http = require('http');

let _baseUrl    = null;   // e.g.  http://192.168.1.10:3721
let _sessionTok = null;   // stored after login

// ─── low-level fetch ──────────────────────────────────────────────────────────

/**
 * Make a JSON HTTP request to the server.
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path
 * @param {object|null} [body]
 * @returns {Promise<any>}  resolves to response.data, rejects on error
 */
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    if (!_baseUrl) return reject(new Error('API client not configured. Call configure() first.'));

    const url      = new URL(_baseUrl + path);
    const payload  = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port:     parseInt(url.port, 10),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload           ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(_sessionTok       ? { 'X-Session-Token': _sessionTok }               : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.ok) return reject(new Error(parsed.error || 'Server error'));
          resolve(parsed.data);
        } catch {
          reject(new Error('Invalid JSON from server'));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const get    = (path)       => request('GET',    path);
const post   = (path, body) => request('POST',   path, body);
const put    = (path, body) => request('PUT',    path, body);
const del    = (path, body) => request('DELETE', path, body);

// ─── configuration ────────────────────────────────────────────────────────────

/**
 * Configure the client with the server's base URL.
 * @param {string} serverIp
 * @param {number} [port=3721]
 */
function configure(serverIp, port = 3721) {
  _baseUrl = `http://${serverIp}:${port}`;
  console.log('[APIClient] Configured for', _baseUrl);
}

function setSessionToken(token) { _sessionTok = token; }
function clearSessionToken()    { _sessionTok = null;  }
function getBaseUrl()           { return _baseUrl; }

/**
 * Test reachability — resolves true if /health returns ok.
 */
async function ping() {
  try {
    await get('/health');
    return true;
  } catch {
    return false;
  }
}

// ─── auth ──────────────────────────────────────────────────────────────────────
const initializeAuth = ()      => post('/auth/initialize', {});
const login          = (creds) => post('/auth/login', creds).then(result => {
  if (result?.sessionToken) setSessionToken(result.sessionToken);
  return result;
});
const logout         = (tok)   => {
  clearSessionToken();
  return post('/auth/logout', { sessionToken: tok });
};
const getSessionUser = (tok)   => get(`/auth/session`);   // token sent via header

// ─── users ────────────────────────────────────────────────────────────────────
const getUsers         = (tok)  => get('/users');
const createUser       = (data) => post('/users', data);
const updateUserRole   = (data) => put('/users/role', data);
const deleteUser       = (data) => del(`/users/${data.userId}`, data);
const updateOwnProfile = (data) => put('/users/profile', data);
const changeOwnPassword= (data) => put('/users/password', data);

// ─── db meta ──────────────────────────────────────────────────────────────────
const testConnection = ()    => get('/db/test');
const getFiscalYears = ()    => get('/db/fiscal-years');

// ─── dashboard ────────────────────────────────────────────────────────────────
const getDashboardStats = () => get('/dashboard/stats');

// ─── agencies ─────────────────────────────────────────────────────────────────
const getAgencies      = ()     => get('/agencies');
const getAgencyById    = (id)   => get(`/agencies/${id}`);
const getAgenciesByType= (type) => get(`/agencies/by-type/${type}`);
const createAgency     = (data) => post('/agencies', data);
const updateAgency     = (data) => put(`/agencies/${data.id}`, data);
const deleteAgency     = (id)   => del(`/agencies/${id}`);

// ─── venues ───────────────────────────────────────────────────────────────────
const getVenues    = ()     => get('/venues');
const getVenueById = (id)   => get(`/venues/${id}`);
const createVenue  = (data) => post('/venues', data);
const updateVenue  = (data) => put(`/venues/${data.id}`, data);
const deleteVenue  = (id)   => del(`/venues/${id}`);

// ─── JFA records ──────────────────────────────────────────────────────────────
const getJfaRecords      = (filters) => get('/jfa?' + new URLSearchParams(filters || {}).toString());
const getJfaById         = (id)      => get(`/jfa/${id}`);
const createJfa          = (data)    => post('/jfa', data);
const updateJfa          = (data)    => put(`/jfa/${data.id}`, data);
const deleteJfa          = (id)      => del(`/jfa/${id}`);
const updateJfaDocuments = (data)    => put(`/jfa/${data.jfa_id}/documents`, data);
const getJfaDocumentStatus=(filters) => get('/jfa/document-status?' + new URLSearchParams(filters||{}).toString());

// ─── job fair events ──────────────────────────────────────────────────────────
const getJobFairEvents   = (f)    => get('/jobfair?' + new URLSearchParams(f||{}).toString());
const getJobFairById     = (id)   => get(`/jobfair/${id}`);
const createJobFairEvent = (data) => post('/jobfair', data);
const updateJobFairEvent = (data) => put(`/jobfair/${data.id}`, data);
const deleteJobFairEvent = (id)   => del(`/jobfair/${id}`);
const addParticipant     = (data) => post(`/jobfair/${data.event_id}/participants`, data);
const updateParticipant  = (data) => put(`/jobfair/participants/${data.id}`, data);
const deleteParticipant  = (id)   => del(`/jobfair/participants/${id}`);

// ─── monitoring ───────────────────────────────────────────────────────────────
const getMonitoringRecords = (f)    => get('/monitoring?' + new URLSearchParams(f||{}).toString());
const getMonitoringById    = (id)   => get(`/monitoring/${id}`);
const createMonitoring     = (data) => post('/monitoring', data);
const updateMonitoring     = (data) => put(`/monitoring/${data.id}`, data);
const deleteMonitoring     = (id)   => del(`/monitoring/${id}`);
// File-picker is Electron dialog — not available on client via HTTP
const pickMonitoringEvidencePath = () => Promise.resolve({ canceled: true, paths: [] });

/**
 * On a client PC, fetch the file from the server and open it locally
 * by writing it to a temp file via the Electron shell.
 * Falls back to opening a blob URL in the default browser if shell is unavailable.
 */
function openMonitoringEvidencePath(targetPath) {
  return new Promise((resolve) => {
    if (!_baseUrl) return resolve({ success: false, error: 'API client not configured.' });

    const url = _baseUrl + '/monitoring/evidence/stream?path=' + encodeURIComponent(targetPath);
    const urlParsed = new URL(url);
    const options = {
      hostname: urlParsed.hostname,
      port:     parseInt(urlParsed.port, 10),
      path:     urlParsed.pathname + urlParsed.search,
      method:   'GET',
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ success: false, error: parsed.error || 'Server error' });
          } catch {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
          }
        });
        return;
      }

      // Collect the binary response into a Buffer
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', async () => {
        try {
          const os   = require('os');
          const fs   = require('fs');
          const path = require('path');
          const { shell } = require('electron');

          const buffer   = Buffer.concat(chunks);
          // Extract filename from Content-Disposition or fallback to path basename
          const cd       = res.headers['content-disposition'] || '';
          const match    = cd.match(/filename="([^"]+)"/);
          const filename = match ? decodeURIComponent(match[1]) : path.basename(targetPath);
          const tmpPath  = path.join(os.tmpdir(), filename);

          fs.writeFileSync(tmpPath, buffer);
          const error = await shell.openPath(tmpPath);
          if (error) {
            resolve({ success: false, error });
          } else {
            resolve({ success: true });
          }
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.end();
  });
}

// ─── summaries ────────────────────────────────────────────────────────────────
const getJfaSummary      = (year) => get(`/summary/jfa?year=${year}`);
const getJobFairSummary  = (year) => get(`/summary/jobfair?year=${year}`);
const getMonitoringSummary=(year) => get(`/summary/monitoring?year=${year}`);
const getEventDetails    = (f)    => get('/summary/event-details?' + new URLSearchParams(f||{}).toString());
const getYearlyTotals    = (year) => get(`/summary/yearly-totals?year=${year}`);

module.exports = {
  // config
  configure, ping, setSessionToken, clearSessionToken, getBaseUrl,
  // auth
  initializeAuth, login, logout, getSessionUser,
  // users
  getUsers, createUser, updateUserRole, deleteUser, updateOwnProfile, changeOwnPassword,
  // db
  testConnection, getFiscalYears,
  // dashboard
  getDashboardStats,
  // agencies
  getAgencies, getAgencyById, getAgenciesByType, createAgency, updateAgency, deleteAgency,
  // venues
  getVenues, getVenueById, createVenue, updateVenue, deleteVenue,
  // jfa
  getJfaRecords, getJfaById, createJfa, updateJfa, deleteJfa,
  updateJfaDocuments, getJfaDocumentStatus,
  // jobfair
  getJobFairEvents, getJobFairById, createJobFairEvent, updateJobFairEvent,
  deleteJobFairEvent, addParticipant, updateParticipant, deleteParticipant,
  // monitoring
  getMonitoringRecords, getMonitoringById, createMonitoring,
  updateMonitoring, deleteMonitoring,
  pickMonitoringEvidencePath, openMonitoringEvidencePath,
  // summaries
  getJfaSummary, getJobFairSummary, getMonitoringSummary,
  getEventDetails, getYearlyTotals,
};
