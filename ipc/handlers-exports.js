// ipc/handlers-exports.js
// This file is a thin adapter that re-exports the pure business-logic
// functions from handlers.js so that api-server.js can call them directly
// without going through Electron IPC.
//
// HOW TO USE:
//   Replace the last line of handlers.js:
//     module.exports = { registerAllHandlers };
//   with:
//     module.exports = { registerAllHandlers, ...require('./handlers-exports') };
//
// Then api-server.js can do:
//   const { handleLogin, ensureDefaultUsers, ... } = require('../ipc/handlers');

'use strict';

const crypto = require('crypto');
const db     = require('../database/connection');

// ── These must stay in sync with handlers.js ──────────────────────────────────
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Shared in-memory session store.
// Both IPC handlers (handlers.js) and HTTP routes (api-server.js) import
// this module and share the SAME Map instance because Node caches modules.
const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `pbkdf2$120000$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored?.startsWith('pbkdf2$')) return false;
  const [, iterations, salt, expected] = stored.split('$');
  try {
    const computed = crypto.pbkdf2Sync(password, salt, parseInt(iterations, 10), 64, 'sha512').toString('hex');
    const a = Buffer.from(computed, 'hex'), b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function normalizeUsername(u) { return String(u || '').trim().toLowerCase(); }
function sanitizeUser(row) {
  if (!row) return null;
  return { id: row.id, username: row.username, email: row.email,
           full_name: row.full_name, role: row.role,
           is_active: row.is_active, created_at: row.created_at };
}

// ── Exported handler functions (mirror IPC handlers but return values directly)

async function ensureDefaultUsers() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(150),
      full_name VARCHAR(150) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin','staff')),
      password_hash TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150)');
  const { rows } = await db.query('SELECT COUNT(*)::int AS total FROM users');
  if (rows[0].total > 0) return;
  const adminPw = process.env.DEFAULT_ADMIN_PASSWORD;
  const staffPw = process.env.DEFAULT_STAFF_PASSWORD;
  if (!adminPw || !staffPw) return;
  const adminRes = await db.query(
    `INSERT INTO users (username, full_name, role, password_hash)
     VALUES ($1,'System Administrator','admin',$2) RETURNING id`,
    ['admin', hashPassword(adminPw)]
  );
  await db.query(
    `INSERT INTO users (username, full_name, role, password_hash, created_by)
     VALUES ($1,'Staff User','staff',$2,$3)`,
    ['staff', hashPassword(staffPw), adminRes.rows[0].id]
  );
}

async function handleLogin(credentials) {
  await ensureDefaultUsers();
  const username = normalizeUsername(credentials?.username);
  const password = String(credentials?.password || '');
  if (!username || !password) throw new Error('Username and password are required.');

  const { rows } = await db.query(
    `SELECT id, username, email, full_name, role, is_active, password_hash, created_at
     FROM users WHERE username=$1`, [username]
  );
  const user = rows[0];
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    throw new Error('Invalid username or password.');
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionToken, {
    token: sessionToken,
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return { sessionToken, user: sanitizeUser(user) };
}

async function handleLogout(sessionToken) {
  if (sessionToken) sessions.delete(String(sessionToken).trim());
  return { success: true };
}

async function handleGetSessionUser(sessionToken) {
  const token = String(sessionToken || '').trim();
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  const { rows } = await db.query(
    `SELECT id, username, email, full_name, role, is_active, created_at
     FROM users WHERE id=$1 AND is_active=TRUE`, [session.userId]
  );
  const user = rows[0];
  if (!user) { sessions.delete(token); return null; }
  session.role = user.role;
  return sanitizeUser(user);
}

function requireSession(token) {
  const t = String(token || '').trim();
  const s = sessions.get(t);
  if (!s) throw new Error('Unauthorized. Please login again.');
  if (s.expiresAt <= Date.now()) { sessions.delete(t); throw new Error('Session expired.'); }
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return s;
}

function requireAdmin(token) {
  const s = requireSession(token);
  if (s.role !== 'admin') throw new Error('Admin only.');
  return s;
}

async function handleGetUsers(sessionToken) {
  requireAdmin(sessionToken);
  const { rows } = await db.query(
    `SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY role DESC, username`
  );
  return rows;
}

async function handleCreateUser(payload) {
  const session = requireAdmin(payload?.sessionToken);
  const { rows } = await db.query(
    `INSERT INTO users (username, email, full_name, role, password_hash, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, username, email, full_name, role, is_active, created_at`,
    [normalizeUsername(payload.username), payload.email || null,
     payload.full_name, payload.role, hashPassword(payload.password), session.userId]
  );
  return rows[0];
}

async function handleUpdateUserRole(payload) {
  requireAdmin(payload?.sessionToken);
  await db.query(
    `UPDATE users SET role=$1, is_active=$2, updated_at=NOW() WHERE id=$3`,
    [payload.role, payload.isActive, payload.userId]
  );
  return { success: true };
}

async function handleDeleteUser(payload) {
  const session = requireAdmin(payload?.sessionToken);
  const adminRes = await db.query(
    `SELECT password_hash FROM users WHERE id=$1 AND is_active=TRUE`, [session.userId]
  );
  if (!verifyPassword(payload.adminPassword, adminRes.rows[0]?.password_hash)) {
    throw new Error('Incorrect password.');
  }
  await db.query(`DELETE FROM users WHERE id=$1`, [payload.userId]);
  for (const [t, s] of sessions.entries()) {
    if (s.userId === Number(payload.userId)) sessions.delete(t);
  }
  return { success: true };
}

async function handleUpdateOwnProfile(payload) {
  const session = requireSession(payload?.sessionToken);
  const { rows } = await db.query(
    `UPDATE users SET username=$1, email=$2, full_name=$3, updated_at=NOW()
     WHERE id=$4 AND is_active=TRUE
     RETURNING id, username, email, full_name, role, is_active, created_at`,
    [normalizeUsername(payload.username), payload.email || null, payload.full_name, session.userId]
  );
  if (!rows.length) throw new Error('Unable to update account info.');
  return sanitizeUser(rows[0]);
}

async function handleChangeOwnPassword(payload) {
  const session = requireSession(payload?.sessionToken);
  const { rows } = await db.query(
    `SELECT password_hash FROM users WHERE id=$1 AND is_active=TRUE`, [session.userId]
  );
  if (!rows.length || !verifyPassword(payload.currentPassword, rows[0].password_hash)) {
    throw new Error('Current password is incorrect.');
  }
  await db.query(
    `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2`,
    [hashPassword(payload.newPassword), session.userId]
  );
  return { success: true };
}

// Summary helpers
async function handleDashboardStats() {
  const [jfaTotal, eventTotal, applicantTotal, agencyTotal, recentJfa, monthlyTrend] =
    await Promise.all([
      db.query(`SELECT fiscal_year, COUNT(*) AS count FROM jfa_records GROUP BY fiscal_year ORDER BY fiscal_year`),
      db.query(`SELECT fiscal_year, COALESCE(SUM(num_job_fairs_facilitated),0) AS count FROM job_fair_events GROUP BY fiscal_year ORDER BY fiscal_year`),
      db.query(`SELECT e.fiscal_year, COALESCE(SUM(p.registered_applicants_male),0) AS male, COALESCE(SUM(p.registered_applicants_female),0) AS female, COALESCE(SUM(p.registered_applicants_male+p.registered_applicants_female),0) AS total FROM job_fair_events e LEFT JOIN job_fair_participants p ON e.id=p.event_id GROUP BY e.fiscal_year ORDER BY e.fiscal_year`),
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE agency_type='recruitment') AS recruitment, COUNT(*) FILTER (WHERE agency_type='lgu') AS lgu, COUNT(*) FILTER (WHERE agency_type='school') AS school, COUNT(*) FILTER (WHERE agency_type='dole') AS dole FROM agencies`),
      db.query(`SELECT j.jfa_no, a.agency_name, j.job_fair_date_start, j.status, j.fiscal_year, j.month FROM jfa_records j JOIN agencies a ON j.agency_id=a.id ORDER BY j.created_at DESC LIMIT 10`),
      db.query(`SELECT e.fiscal_year, e.month, COALESCE(SUM(p.registered_applicants_male+p.registered_applicants_female),0) AS applicants FROM job_fair_events e LEFT JOIN job_fair_participants p ON e.id=p.event_id GROUP BY e.fiscal_year, e.month ORDER BY e.fiscal_year, e.month`),
    ]);
  return {
    jfaByYear: jfaTotal.rows, eventsByYear: eventTotal.rows,
    applicantsByYear: applicantTotal.rows, agencyStats: agencyTotal.rows[0],
    recentJfa: recentJfa.rows, monthlyTrend: monthlyTrend.rows,
  };
}

async function handleJfaSummary(year) {
  const { rows } = await db.query(`SELECT * FROM v_jfa_summary WHERE fiscal_year=$1`, [year]);
  return rows;
}
async function handleJobFairSummary(year) {
  const { rows } = await db.query(`SELECT * FROM v_job_fair_summary WHERE fiscal_year=$1`, [year]);
  return rows;
}
async function handleMonitoringSummary(year) {
  const { rows } = await db.query(`SELECT * FROM v_monitoring_overview WHERE fiscal_year=$1`, [year]);
  return rows;
}
async function handleEventDetails(filters) {
  let where = 'WHERE 1=1'; const params = []; let i = 1;
  if (filters?.fiscal_year) { where += ` AND fiscal_year=$${i++}`; params.push(filters.fiscal_year); }
  if (filters?.month)       { where += ` AND month=$${i++}`;       params.push(filters.month); }
  const { rows } = await db.query(`SELECT * FROM v_job_fair_event_details ${where}`, params);
  return rows;
}
async function handleYearlyTotals(year) {
  const [jfaRes, jfRes] = await Promise.all([
    db.query(`SELECT fiscal_year, COUNT(*) AS total_jfa, COUNT(*) FILTER (WHERE status='completed') AS completed, COUNT(*) FILTER (WHERE status='cancelled') AS cancelled, COUNT(*) FILTER (WHERE status='not_participated') AS not_participated, COUNT(*) FILTER (WHERE status='active') AS active FROM jfa_records WHERE fiscal_year=$1 GROUP BY fiscal_year`, [year]),
    db.query(`SELECT e.fiscal_year, COALESCE(SUM(e.num_job_fairs_facilitated),0) AS total_job_fairs, COALESCE(SUM(p.registered_applicants_male),0) AS total_male, COALESCE(SUM(p.registered_applicants_female),0) AS total_female, COALESCE(SUM(p.registered_applicants_male+p.registered_applicants_female),0) AS total_applicants, COUNT(DISTINCT CASE WHEN p.agency_category='land-based' THEN p.id END) AS land_based, COUNT(DISTINCT CASE WHEN p.agency_category='sea-based' THEN p.id END) AS sea_based, COUNT(DISTINCT p.id) AS total_agencies FROM job_fair_events e LEFT JOIN job_fair_participants p ON e.id=p.event_id WHERE e.fiscal_year=$1 GROUP BY e.fiscal_year`, [year]),
  ]);
  return { jfa: jfaRes.rows[0] || {}, jobFair: jfRes.rows[0] || {} };
}

module.exports = {
  sessions,   // shared store
  ensureDefaultUsers,
  handleLogin, handleLogout, handleGetSessionUser,
  handleGetUsers, handleCreateUser, handleUpdateUserRole,
  handleDeleteUser, handleUpdateOwnProfile, handleChangeOwnPassword,
  handleDashboardStats,
  handleJfaSummary, handleJobFairSummary, handleMonitoringSummary,
  handleEventDetails, handleYearlyTotals,
};
