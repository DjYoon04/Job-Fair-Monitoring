// network/api-server.js
// Express HTTP server that runs inside the Electron main process (server role only).
// Exposes every database operation as a REST endpoint so that client Electron
// instances on the same LAN can call them over HTTP instead of IPC.
//
// Security notes:
//   • Sessions are stored in-memory on the server, same as the IPC path.
//   • Every mutating request must carry a valid session token in the
//     X-Session-Token header (or body.sessionToken).
//   • The server only binds to the LAN IP, not 0.0.0.0, to limit exposure.

'use strict';

const express    = require('express');
const bodyParser = require('body-parser');
const multer     = require('multer');
const archiver   = require('archiver');
const crypto     = require('crypto');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const db         = require('../database/connection');
const { getLocalIP } = require('./ip-detector');

// ─── re-use the same session store & helpers that handlers.js uses ───────────
// We share the handlers module so sessions created via IPC (server's own window)
// are visible to HTTP clients and vice-versa.
let _handlersModule = null;
function getHandlers() {
  if (!_handlersModule) {
    _handlersModule = require('../ipc/handlers');
  }
  return _handlersModule;
}

// ─── constants ───────────────────────────────────────────────────────────────
const DEFAULT_PORT = 3721;   // unlikely to clash with common services

// ─── helpers ─────────────────────────────────────────────────────────────────
function ok(res, data)  { res.json({ ok: true,  data }); }
function err(res, msg, status = 400) {
  console.error('[API]', msg);
  res.status(status).json({ ok: false, error: String(msg) });
}

/** Wrap an async route handler so unhandled rejections surface as 400 errors */
function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      err(res, e.message || String(e));
    }
  };
}

/** Extract session token from header or body */
function sessionToken(req) {
  return (
    req.headers['x-session-token'] ||
    req.body?.sessionToken ||
    null
  );
}

// ─── build the Express app ───────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(bodyParser.json({ limit: '50mb' }));

  // ── Multer: store uploaded files in <userData>/uploads on the server ────────
  // The upload directory is placed in the OS temp folder under job-fair-uploads.
  // In production you should point this at a stable persistent directory.
  const UPLOAD_DIR = path.join(os.homedir(), 'job-fair-uploads');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Preserve optional sub-folder sent by the client as ?folder=relative/path
      const sub = String(req.query.folder || '').replace(/\.\./g, '').trim();
      const dest = sub ? path.join(UPLOAD_DIR, sub) : UPLOAD_DIR;
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      // Keep original filename; prefix with timestamp to avoid collisions
      const safe = file.originalname.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
      cb(null, safe);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB per file
  });

  // Health check – clients use this to verify the server is reachable
  app.get('/health', (req, res) => {
    res.json({ ok: true, role: 'server', ts: Date.now() });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  app.post('/auth/initialize', wrap(async (req, res) => {
    const { ensureDefaultUsers } = getHandlers();
    await ensureDefaultUsers();
    ok(res, { ok: true });
  }));

  app.post('/auth/login', wrap(async (req, res) => {
    const { handleLogin } = getHandlers();
    const result = await handleLogin(req.body);
    ok(res, result);
  }));

  app.post('/auth/logout', wrap(async (req, res) => {
    const { handleLogout } = getHandlers();
    await handleLogout(sessionToken(req) || req.body?.sessionToken);
    ok(res, { success: true });
  }));

  app.get('/auth/session', wrap(async (req, res) => {
    const { handleGetSessionUser } = getHandlers();
    const user = await handleGetSessionUser(sessionToken(req));
    ok(res, user);
  }));

  // ── Users ──────────────────────────────────────────────────────────────────
  app.get('/users', wrap(async (req, res) => {
    const { handleGetUsers } = getHandlers();
    const rows = await handleGetUsers(sessionToken(req));
    ok(res, rows);
  }));

  app.post('/users', wrap(async (req, res) => {
    const { handleCreateUser } = getHandlers();
    const row = await handleCreateUser({ ...req.body, sessionToken: sessionToken(req) });
    ok(res, row);
  }));

  app.put('/users/role', wrap(async (req, res) => {
    const { handleUpdateUserRole } = getHandlers();
    const result = await handleUpdateUserRole({ ...req.body, sessionToken: sessionToken(req) });
    ok(res, result);
  }));

  app.delete('/users/:id', wrap(async (req, res) => {
    const { handleDeleteUser } = getHandlers();
    const result = await handleDeleteUser({ ...req.body, userId: req.params.id, sessionToken: sessionToken(req) });
    ok(res, result);
  }));

  app.put('/users/profile', wrap(async (req, res) => {
    const { handleUpdateOwnProfile } = getHandlers();
    const result = await handleUpdateOwnProfile({ ...req.body, sessionToken: sessionToken(req) });
    ok(res, result);
  }));

  app.put('/users/password', wrap(async (req, res) => {
    const { handleChangeOwnPassword } = getHandlers();
    const result = await handleChangeOwnPassword({ ...req.body, sessionToken: sessionToken(req) });
    ok(res, result);
  }));

  // ── DB meta ────────────────────────────────────────────────────────────────
  app.get('/db/test', wrap(async (_req, res) => {
    const result = await db.query('SELECT NOW() as now');
    ok(res, { connected: true, ts: result.rows[0].now });
  }));

  app.get('/db/fiscal-years', wrap(async (_req, res) => {
    const result = await db.query('SELECT * FROM fiscal_years ORDER BY year');
    ok(res, result.rows);
  }));

  // ── Dashboard ──────────────────────────────────────────────────────────────
  app.get('/dashboard/stats', wrap(async (_req, res) => {
    const { handleDashboardStats } = getHandlers();
    ok(res, await handleDashboardStats());
  }));

  // ── Agencies ───────────────────────────────────────────────────────────────
  app.get('/agencies', wrap(async (_req, res) => {
    const r = await db.query('SELECT * FROM agencies ORDER BY created_at DESC, id DESC');
    ok(res, r.rows);
  }));

  app.get('/agencies/by-type/:type', wrap(async (req, res) => {
    const r = await db.query('SELECT * FROM agencies WHERE agency_type=$1 ORDER BY agency_name', [req.params.type]);
    ok(res, r.rows);
  }));

  app.get('/agencies/:id', wrap(async (req, res) => {
    const r = await db.query('SELECT * FROM agencies WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return err(res, 'Agency not found', 404);
    ok(res, r.rows[0]);
  }));

  app.post('/agencies', wrap(async (req, res) => {
    const d = req.body;
    if (!d.agency_name?.trim()) throw new Error('Agency name is required');
    if (!d.agency_type?.trim()) throw new Error('Agency type is required');
    const isActive = typeof d.is_active === 'boolean' ? d.is_active : true;
    const r = await db.query(
      'INSERT INTO agencies (agency_name, agency_type, is_active) VALUES ($1,$2,$3) RETURNING *',
      [d.agency_name.trim(), d.agency_type.trim(), isActive]
    );
    ok(res, r.rows[0]);
  }));

  app.put('/agencies/:id', wrap(async (req, res) => {
    const d = req.body;
    if (!d.agency_name?.trim()) throw new Error('Agency name is required');
    const isActive = typeof d.is_active === 'boolean' ? d.is_active : true;
    const r = await db.query(
      'UPDATE agencies SET agency_name=$1, agency_type=$2, is_active=$3 WHERE id=$4 RETURNING *',
      [d.agency_name.trim(), d.agency_type, isActive, req.params.id]
    );
    if (!r.rows.length) return err(res, 'Agency not found', 404);
    ok(res, r.rows[0]);
  }));

  app.delete('/agencies/:id', wrap(async (req, res) => {
    await db.query('DELETE FROM agencies WHERE id=$1', [req.params.id]);
    ok(res, { success: true });
  }));

  // ── Venues ─────────────────────────────────────────────────────────────────
  app.get('/venues', wrap(async (_req, res) => {
    const r = await db.query('SELECT * FROM venues ORDER BY venue_name');
    ok(res, r.rows);
  }));

  app.get('/venues/:id', wrap(async (req, res) => {
    const r = await db.query('SELECT * FROM venues WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return err(res, 'Venue not found', 404);
    ok(res, r.rows[0]);
  }));

  app.post('/venues', wrap(async (req, res) => {
    const d = req.body;
    if (!d.venue_name?.trim()) throw new Error('Venue name is required');
    const r = await db.query(
      'INSERT INTO venues (venue_name, city_municipality, province, region) VALUES ($1,$2,$3,$4) RETURNING *',
      [d.venue_name.trim(), d.city_municipality || null, d.province || null, d.region || null]
    );
    ok(res, r.rows[0]);
  }));

  app.put('/venues/:id', wrap(async (req, res) => {
    const d = req.body;
    if (!d.venue_name?.trim()) throw new Error('Venue name is required');
    const r = await db.query(
      'UPDATE venues SET venue_name=$1, city_municipality=$2, province=$3, region=$4 WHERE id=$5 RETURNING *',
      [d.venue_name.trim(), d.city_municipality, d.province, d.region, req.params.id]
    );
    if (!r.rows.length) return err(res, 'Venue not found', 404);
    ok(res, r.rows[0]);
  }));

  app.delete('/venues/:id', wrap(async (req, res) => {
    await db.query('DELETE FROM venues WHERE id=$1', [req.params.id]);
    ok(res, { success: true });
  }));

  // ── JFA Records ────────────────────────────────────────────────────────────
  app.get('/jfa', wrap(async (req, res) => {
    const f = req.query;
    let where = 'WHERE 1=1'; const params = []; let idx = 1;
    const valid = (v) => v && v !== 'undefined' && v !== 'null';
    if (valid(f.fiscal_year)) { where += ` AND j.fiscal_year=$${idx++}`; params.push(f.fiscal_year); }
    if (valid(f.month))       { where += ` AND j.month=$${idx++}`;       params.push(f.month); }
    if (valid(f.status))      { where += ` AND j.status=$${idx++}`;      params.push(f.status); }
    if (valid(f.agency_id))   { where += ` AND j.agency_id=$${idx++}`;   params.push(f.agency_id); }
    const r = await db.query(
      `SELECT j.*, a.agency_name, a.agency_type, v.venue_name,
              d.invitation_letter_date, d.affidavit_date, d.job_orders_date,
              d.representative_id_date, d.terminal_report_date,
              d.status_of_applicants, d.status_date, d.is_complete
       FROM jfa_records j
       JOIN agencies a ON j.agency_id = a.id
       LEFT JOIN venues v ON j.venue_id = v.id
       LEFT JOIN jfa_documents d ON j.id = d.jfa_id
       ${where}
       ORDER BY j.fiscal_year DESC, j.month DESC, j.jfa_no`, params
    );
    ok(res, r.rows);
  }));

  app.get('/jfa/document-status', wrap(async (req, res) => {
    const f = req.query;
    let where = 'WHERE 1=1'; const params = []; let idx = 1;
    const valid = (v) => v && v !== 'undefined' && v !== 'null';
    if (valid(f.fiscal_year)) { where += ` AND fiscal_year=$${idx++}`; params.push(f.fiscal_year); }
    if (valid(f.month))       { where += ` AND month=$${idx++}`;       params.push(f.month); }
    const r = await db.query(
      `SELECT * FROM v_jfa_document_status ${where} ORDER BY fiscal_year DESC, month, jfa_no`, params
    );
    ok(res, r.rows);
  }));

  app.get('/jfa/:id', wrap(async (req, res) => {
    const r = await db.query(
      `SELECT j.*, a.agency_name, v.venue_name,
              d.invitation_letter_date, d.affidavit_date, d.job_orders_date,
              d.representative_id_date, d.terminal_report_date,
              d.status_of_applicants, d.status_date, d.is_complete
       FROM jfa_records j
       JOIN agencies a ON j.agency_id = a.id
       LEFT JOIN venues v ON j.venue_id = v.id
       LEFT JOIN jfa_documents d ON j.id = d.jfa_id
       WHERE j.id=$1`, [req.params.id]
    );
    ok(res, r.rows[0]);
  }));

  app.post('/jfa', wrap(async (req, res) => {
    const d = req.body;
    if (!d.jfa_no?.trim())            throw new Error('JFA No. is required');
    if (!d.agency_id || isNaN(d.agency_id)) throw new Error('Agency is required');
    if (!d.fiscal_year)               throw new Error('Fiscal year is required');
    if (!d.month || d.month < 1 || d.month > 12) throw new Error('Valid month is required');
    const r = await db.query(
      `INSERT INTO jfa_records
       (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end,
        venue_id, available_job_orders, job_site, job_orders_balance, status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [d.jfa_no.trim(), d.agency_id, d.fiscal_year, d.month,
       d.job_fair_date_start||null, d.job_fair_date_end||null,
       d.venue_id||null, d.available_job_orders||0,
       d.job_site||null, d.job_orders_balance||0,
       d.status||'active', d.remarks||null]
    );
    ok(res, r.rows[0]);
  }));

  app.put('/jfa/:id', wrap(async (req, res) => {
    const d = req.body;
    const r = await db.query(
      `UPDATE jfa_records SET
       jfa_no=$1, agency_id=$2, fiscal_year=$3, month=$4,
       job_fair_date_start=$5, job_fair_date_end=$6,
       venue_id=$7, available_job_orders=$8, job_site=$9,
       job_orders_balance=$10, status=$11, remarks=$12
       WHERE id=$13 RETURNING *`,
      [d.jfa_no.trim(), d.agency_id, d.fiscal_year, d.month,
       d.job_fair_date_start||null, d.job_fair_date_end||null,
       d.venue_id||null, d.available_job_orders||0,
       d.job_site||null, d.job_orders_balance||0,
       d.status, d.remarks||null, req.params.id]
    );
    if (!r.rows.length) return err(res, 'JFA not found', 404);
    ok(res, r.rows[0]);
  }));

  app.put('/jfa/:id/documents', wrap(async (req, res) => {
    const d = req.body;
    const r = await db.query(
      `UPDATE jfa_documents SET
       invitation_letter_date=$1, affidavit_date=$2, job_orders_date=$3,
       representative_id_date=$4, terminal_report_date=$5,
       status_of_applicants=$6, status_date=$7
       WHERE jfa_id=$8 RETURNING *`,
      [d.invitation_letter_date||null, d.affidavit_date||null,
       d.job_orders_date||null, d.representative_id_date||null,
       d.terminal_report_date||null, d.status_of_applicants||null,
       d.status_date||null, req.params.id]
    );
    ok(res, r.rows[0]);
  }));

  app.delete('/jfa/:id', wrap(async (req, res) => {
    await db.query('DELETE FROM jfa_records WHERE id=$1', [req.params.id]);
    ok(res, { success: true });
  }));

  // ── Job Fair Events ─────────────────────────────────────────────────────────
  app.get('/jobfair', wrap(async (req, res) => {
    const f = req.query;
    let where = 'WHERE 1=1'; const params = []; let idx = 1;
    const valid = (v) => v && v !== 'undefined' && v !== 'null';
    if (valid(f.fiscal_year)) { where += ` AND e.fiscal_year=$${idx++}`; params.push(f.fiscal_year); }
    if (valid(f.month))       { where += ` AND e.month=$${idx++}`;       params.push(f.month); }
    const r = await db.query(
      `SELECT e.*, org.agency_name AS organizer_name, v.venue_name,
              COALESCE(SUM(p.registered_applicants_male),0) AS total_male,
              COALESCE(SUM(p.registered_applicants_female),0) AS total_female,
              COALESCE(SUM(p.registered_applicants_male + p.registered_applicants_female),0) AS total_applicants,
              COUNT(DISTINCT p.id) AS total_agencies
       FROM job_fair_events e
       LEFT JOIN agencies org ON e.organizer_id = org.id
       LEFT JOIN venues v ON e.venue_id = v.id
       LEFT JOIN job_fair_participants p ON e.id = p.event_id
       ${where}
       GROUP BY e.id, org.agency_name, v.venue_name
       ORDER BY e.fiscal_year DESC, e.month DESC, e.job_fair_date_start`, params
    );
    ok(res, r.rows);
  }));

  app.get('/jobfair/:id', wrap(async (req, res) => {
    const evtR = await db.query(
      `SELECT e.*, org.agency_name AS organizer_name, v.venue_name
       FROM job_fair_events e
       LEFT JOIN agencies org ON e.organizer_id = org.id
       LEFT JOIN venues v ON e.venue_id = v.id
       WHERE e.id=$1`, [req.params.id]
    );
    const parR = await db.query(
      `SELECT p.*, a.agency_name, j.jfa_no
       FROM job_fair_participants p
       JOIN agencies a ON p.agency_id = a.id
       LEFT JOIN jfa_records j ON p.jfa_id = j.id
       WHERE p.event_id=$1 ORDER BY a.agency_name`, [req.params.id]
    );
    ok(res, { event: evtR.rows[0], participants: parR.rows });
  }));

  app.post('/jobfair', wrap(async (req, res) => {
    const d = req.body;
    if (!d.fiscal_year) throw new Error('Fiscal year is required');
    if (!d.month || d.month < 1 || d.month > 12) throw new Error('Valid month is required');
    if (!d.job_fair_date_start) throw new Error('Start date is required');
    const r = await db.query(
      `INSERT INTO job_fair_events
       (fiscal_year, month, organizer_id, job_fair_date_start, job_fair_date_end,
        venue_id, num_job_fairs_facilitated, monitored_by, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.fiscal_year, d.month, d.organizer_id||null,
       d.job_fair_date_start, d.job_fair_date_end||null,
       d.venue_id||null, d.num_job_fairs_facilitated||1,
       d.monitored_by||null, d.remarks||null]
    );
    ok(res, r.rows[0]);
  }));

  app.put('/jobfair/:id', wrap(async (req, res) => {
    const d = req.body;
    const r = await db.query(
      `UPDATE job_fair_events SET
       fiscal_year=$1, month=$2, organizer_id=$3,
       job_fair_date_start=$4, job_fair_date_end=$5,
       venue_id=$6, num_job_fairs_facilitated=$7,
       monitored_by=$8, remarks=$9
       WHERE id=$10 RETURNING *`,
      [d.fiscal_year, d.month, d.organizer_id||null,
       d.job_fair_date_start, d.job_fair_date_end||null,
       d.venue_id||null, d.num_job_fairs_facilitated||1,
       d.monitored_by||null, d.remarks||null, req.params.id]
    );
    if (!r.rows.length) return err(res, 'Event not found', 404);
    ok(res, r.rows[0]);
  }));

  app.delete('/jobfair/:id', wrap(async (req, res) => {
    await db.query('DELETE FROM job_fair_events WHERE id=$1', [req.params.id]);
    ok(res, { success: true });
  }));

  app.post('/jobfair/:id/participants', wrap(async (req, res) => {
    const d = req.body;
    if (!d.agency_category?.trim()) throw new Error('Agency category is required');
    const r = await db.query(
      `INSERT INTO job_fair_participants
       (event_id, agency_id, jfa_id, agency_category,
        registered_applicants_male, registered_applicants_female,
        terminal_report_male, terminal_report_female)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (event_id, agency_id) DO UPDATE SET
         jfa_id=EXCLUDED.jfa_id, agency_category=EXCLUDED.agency_category,
         registered_applicants_male=EXCLUDED.registered_applicants_male,
         registered_applicants_female=EXCLUDED.registered_applicants_female,
         terminal_report_male=EXCLUDED.terminal_report_male,
         terminal_report_female=EXCLUDED.terminal_report_female
       RETURNING *`,
      [req.params.id, d.agency_id, d.jfa_id||null, d.agency_category.trim(),
       d.registered_applicants_male||0, d.registered_applicants_female||0,
       d.terminal_report_male||0, d.terminal_report_female||0]
    );
    ok(res, r.rows[0]);
  }));

  app.put('/jobfair/participants/:id', wrap(async (req, res) => {
    const d = req.body;
    const r = await db.query(
      `UPDATE job_fair_participants SET
       agency_id=$1, jfa_id=$2, agency_category=$3,
       registered_applicants_male=$4, registered_applicants_female=$5,
       terminal_report_male=$6, terminal_report_female=$7
       WHERE id=$8 RETURNING *`,
      [d.agency_id, d.jfa_id||null, d.agency_category.trim(),
       d.registered_applicants_male||0, d.registered_applicants_female||0,
       d.terminal_report_male||0, d.terminal_report_female||0, req.params.id]
    );
    ok(res, r.rows[0]);
  }));

  app.delete('/jobfair/participants/:id', wrap(async (req, res) => {
    await db.query('DELETE FROM job_fair_participants WHERE id=$1', [req.params.id]);
    ok(res, { success: true });
  }));

  // ── Monitoring ─────────────────────────────────────────────────────────────
  app.get('/monitoring', wrap(async (req, res) => {
    const f = req.query;
    let where = 'WHERE 1=1'; const params = []; let idx = 1;
    const valid = (v) => v && v !== 'undefined' && v !== 'null';
    if (valid(f.fiscal_year)) { where += ` AND m.fiscal_year=$${idx++}`; params.push(f.fiscal_year); }
    if (valid(f.month))       { where += ` AND m.month=$${idx++}`;       params.push(f.month); }
    const r = await db.query(
      `SELECT m.*, a.agency_name, v.venue_name
       FROM monitoring_records m
       LEFT JOIN agencies a ON m.implementing_agency_id = a.id
       LEFT JOIN venues v ON m.venue_id = v.id
       ${where}
       ORDER BY m.fiscal_year DESC, m.month DESC, m.job_fair_date_start DESC`, params
    );
    ok(res, r.rows);
  }));

  app.get('/monitoring/:id', wrap(async (req, res) => {
    const r = await db.query(
      `SELECT m.*, a.agency_name, v.venue_name
       FROM monitoring_records m
       LEFT JOIN agencies a ON m.implementing_agency_id = a.id
       LEFT JOIN venues v ON m.venue_id = v.id
       WHERE m.id=$1`, [req.params.id]
    );
    ok(res, r.rows[0]);
  }));

  app.post('/monitoring', wrap(async (req, res) => {
    const d = req.body;
    const r = await db.query(
      `INSERT INTO monitoring_records
       (fiscal_year, month, agency_id, venue_id, monitoring_date,
        monitored_by, findings, recommendations, evidence_path,
        celebration_event, job_fair_monitoring, conduct_of_peos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [d.fiscal_year, d.month, d.agency_id||null, d.venue_id||null,
       d.monitoring_date||null, d.monitored_by||null,
       d.findings||null, d.recommendations||null, d.evidence_path||null,
       d.celebration_event||null,
       d.job_fair_monitoring ?? null, d.conduct_of_peos ?? null]
    );
    ok(res, r.rows[0]);
  }));

  app.put('/monitoring/:id', wrap(async (req, res) => {
    const d = req.body;
    const r = await db.query(
      `UPDATE monitoring_records SET
       fiscal_year=$1, month=$2, agency_id=$3, venue_id=$4, monitoring_date=$5,
       monitored_by=$6, findings=$7, recommendations=$8, evidence_path=$9,
       celebration_event=$10, job_fair_monitoring=$11, conduct_of_peos=$12
       WHERE id=$13 RETURNING *`,
      [d.fiscal_year, d.month, d.agency_id||null, d.venue_id||null,
       d.monitoring_date||null, d.monitored_by||null,
       d.findings||null, d.recommendations||null, d.evidence_path||null,
       d.celebration_event||null,
       d.job_fair_monitoring ?? null, d.conduct_of_peos ?? null, req.params.id]
    );
    if (!r.rows.length) return err(res, 'Record not found', 404);
    ok(res, r.rows[0]);
  }));

  app.delete('/monitoring/:id', wrap(async (req, res) => {
    await db.query('DELETE FROM monitoring_records WHERE id=$1', [req.params.id]);
    ok(res, { success: true });
  }));

  // ── Summaries ──────────────────────────────────────────────────────────────

  // ── Evidence file upload (single or multiple) ──────────────────────────────
  // POST /monitoring/evidence/upload?folder=optional/sub/path
  // Body: multipart/form-data, field name "files" (multiple allowed)
  // Returns: { ok: true, data: { uploaded: [{name, path, size}] } }
  app.post('/monitoring/evidence/upload', upload.array('files', 100), wrap(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return err(res, 'No files received', 400);
    }
    const uploaded = req.files.map((f) => ({
      name:         f.originalname,
      savedName:    f.filename,
      path:         f.path,
      size:         f.size,
      mimetype:     f.mimetype,
    }));
    console.log(`[API] Uploaded ${uploaded.length} file(s):`, uploaded.map(f => f.name).join(', '));
    ok(res, { uploaded });
  }));

  // ── Evidence folder listing ─────────────────────────────────────────────────
  // GET /monitoring/evidence/list?path=server/folder/path
  // Returns an array of { name, path, isDir, size } entries (one level deep)
  app.get('/monitoring/evidence/list', wrap(async (req, res) => {
    const target = String(req.query.path || UPLOAD_DIR).trim();
    if (!fs.existsSync(target)) {
      return err(res, 'Path not found: ' + target, 404);
    }
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) {
      // Single file — return it as a one-element list
      return ok(res, [{ name: path.basename(target), path: target, isDir: false, size: stat.size }]);
    }
    const entries = fs.readdirSync(target).map((name) => {
      const full = path.join(target, name);
      const s    = fs.statSync(full);
      return { name, path: full, isDir: s.isDirectory(), size: s.isDirectory() ? null : s.size };
    });
    ok(res, entries);
  }));

  // ── Evidence folder ZIP download ────────────────────────────────────────────
  // GET /monitoring/evidence/zip?path=server/folder/path
  // Streams a ZIP of the entire folder (all files, recursively)
  app.get('/monitoring/evidence/zip', (req, res) => {
    const target = String(req.query.path || '').trim();
    if (!target) return res.status(400).json({ ok: false, error: 'No path specified' });
    if (!fs.existsSync(target)) return res.status(404).json({ ok: false, error: 'Path not found: ' + target });

    const stat = fs.statSync(target);
    const zipName = encodeURIComponent(path.basename(target) + '.zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (e) => {
      console.error('[API] ZIP error:', e.message);
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
    });
    archive.pipe(res);

    if (stat.isDirectory()) {
      archive.directory(target, path.basename(target));
    } else {
      archive.file(target, { name: path.basename(target) });
    }
    archive.finalize();
  });

  // ── Evidence multi-file batch download ─────────────────────────────────────
  // POST /monitoring/evidence/batch-zip
  // Body: { paths: ["/abs/path/a", "/abs/path/b", ...] }
  // Streams a ZIP containing all requested files/folders
  app.post('/monitoring/evidence/batch-zip', (req, res) => {
    const paths = req.body?.paths;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ ok: false, error: 'No paths provided' });
    }

    res.setHeader('Content-Disposition', 'attachment; filename="evidence-files.zip"');
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (e) => {
      console.error('[API] Batch ZIP error:', e.message);
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
    });
    archive.pipe(res);

    for (const p of paths) {
      const target = String(p || '').trim();
      if (!target || !fs.existsSync(target)) {
        console.warn('[API] Batch ZIP: skipping missing path:', target);
        continue;
      }
      const s = fs.statSync(target);
      if (s.isDirectory()) {
        archive.directory(target, path.basename(target));
      } else {
        archive.file(target, { name: path.basename(target) });
      }
    }
    archive.finalize();
  });

  // Evidence file serving: streams a server-side file to the client as a binary download.
  app.get('/monitoring/evidence/stream', (req, res) => {
    const fs   = require('fs');
    const path = require('path');

    const filePath = String(req.query.path || '').trim();
    if (!filePath) {
      return res.status(400).json({ ok: false, error: 'No path specified' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'File not found on server: ' + filePath });
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return res.status(400).json({ ok: false, error: 'Path is a directory, not a file' });
    }

    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(filename) + '"');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/octet-stream');

    const stream = fs.createReadStream(filePath);
    stream.on('error', (e) => {
      console.error('[API] Evidence stream error:', e.message);
      if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
    });
    stream.pipe(res);
  });

  app.get('/summary/jfa', wrap(async (req, res) => {
    const { handleJfaSummary } = getHandlers();
    ok(res, await handleJfaSummary(req.query.year));
  }));

  app.get('/summary/jobfair', wrap(async (req, res) => {
    const { handleJobFairSummary } = getHandlers();
    ok(res, await handleJobFairSummary(req.query.year));
  }));

  app.get('/summary/monitoring', wrap(async (req, res) => {
    const { handleMonitoringSummary } = getHandlers();
    ok(res, await handleMonitoringSummary(req.query.year));
  }));

  app.get('/summary/event-details', wrap(async (req, res) => {
    const { handleEventDetails } = getHandlers();
    ok(res, await handleEventDetails(req.query));
  }));

  app.get('/summary/yearly-totals', wrap(async (req, res) => {
    const { handleYearlyTotals } = getHandlers();
    ok(res, await handleYearlyTotals(req.query.year));
  }));

  return app;
}

// ─── start / stop ─────────────────────────────────────────────────────────────
let _server = null;
let _boundIp = null;
let _boundPort = null;

/**
 * Start the HTTP API server.
 * @param {number} [port]
 * @returns {Promise<{ ip: string, port: number }>}
 */
async function start(port = DEFAULT_PORT) {
  if (_server) {
    return { ip: _boundIp, port: _boundPort };
  }

  const ip  = getLocalIP();
  const app = buildApp();

  return new Promise((resolve, reject) => {
    _server = app.listen(port, ip, () => {
      _boundIp   = ip;
      _boundPort = port;
      console.log(`[API] Server listening on http://${ip}:${port}`);
      resolve({ ip, port });
    });

    _server.on('error', (e) => {
      console.error('[API] Failed to start server:', e.message);
      _server = null;
      reject(e);
    });
  });
}

/** Stop the HTTP API server */
async function stop() {
  return new Promise((resolve) => {
    if (!_server) return resolve();
    _server.close(() => {
      _server    = null;
      _boundIp   = null;
      _boundPort = null;
      console.log('[API] Server stopped');
      resolve();
    });
  });
}

function isRunning() { return !!_server; }
function getAddress() { return _server ? { ip: _boundIp, port: _boundPort } : null; }

module.exports = { start, stop, isRunning, getAddress, DEFAULT_PORT };
