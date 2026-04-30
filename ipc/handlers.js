// ipc/handlers.js
// All IPC handlers for database CRUD operations
const { ipcMain, dialog, BrowserWindow, shell } = require('electron');
const crypto = require('crypto');
const db = require('../database/connection');

const sessions = new Map();
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
let monitoringSchemaReadyPromise = null;

async function ensureMonitoringSchema() {
  if (monitoringSchemaReadyPromise) {
    return monitoringSchemaReadyPromise;
  }

  monitoringSchemaReadyPromise = (async () => {
    await db.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS celebration_event TEXT');
    await db.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS monitored_by VARCHAR(255)');
    await db.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS job_fair_monitoring BOOLEAN');
    await db.query('ALTER TABLE monitoring_records ADD COLUMN IF NOT EXISTS conduct_of_peos BOOLEAN');
  })();

  return monitoringSchemaReadyPromise;
}

async function ensureFiscalYearExists(yearValue) {
  const year = Number.parseInt(yearValue, 10);
  if (!Number.isFinite(year)) {
    throw new Error('Fiscal year is required');
  }

  await db.query(
    `INSERT INTO fiscal_years (year, is_active)
     VALUES ($1, TRUE)
     ON CONFLICT (year) DO NOTHING`,
    [year]
  );

  return year;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase() || null;
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function assertStrongPassword(password, context = 'Password') {
  const value = String(password || '');
  const checks = [
    { ok: value.length >= 10, text: 'at least 10 characters' },
    { ok: /[a-z]/.test(value), text: 'one lowercase letter' },
    { ok: /[A-Z]/.test(value), text: 'one uppercase letter' },
    { ok: /\d/.test(value), text: 'one number' },
    { ok: /[^A-Za-z0-9]/.test(value), text: 'one special character' },
  ];

  const failed = checks.filter(c => !c.ok).map(c => c.text);
  if (failed.length) {
    throw new Error(`${context} must include ${failed.join(', ')}.`);
  }
}

function getLoginAttemptState(username) {
  const key = normalizeUsername(username);
  const state = loginAttempts.get(key);
  if (!state) return null;

  if (state.lockedUntil && state.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
    return null;
  }

  return state;
}

function recordFailedLogin(username) {
  const key = normalizeUsername(username);
  const now = Date.now();
  const current = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  current.count += 1;

  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    current.lockedUntil = now + LOGIN_LOCK_MS;
  }

  loginAttempts.set(key, current);
  return current;
}

function clearFailedLogins(username) {
  loginAttempts.delete(normalizeUsername(username));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const iterations = 120000;
  const digest = 'sha512';
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, digest).toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.startsWith('pbkdf2$')) {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHash = parts[3];

  if (!Number.isFinite(iterations) || !salt || !expectedHash) {
    return false;
  }

  try {
    const computedHash = crypto
      .pbkdf2Sync(password, salt, iterations, 64, 'sha512')
      .toString('hex');

    const computedBuffer = Buffer.from(computedHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (computedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function parseBooleanLike(value) {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'on', 'checked'].includes(normalized)) return true;
    if (['false', 'f', '0', 'no', 'off', 'unchecked'].includes(normalized)) return false;
  }

  return null;
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

async function ensureDefaultUsers() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(150),
      full_name VARCHAR(150) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff')),
      password_hash TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150)');

  await db.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
  await db.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL'
  );

  const countRes = await db.query('SELECT COUNT(*)::int AS total FROM users');
  const totalUsers = countRes.rows[0]?.total || 0;
  if (totalUsers > 0) {
    return;
  }

  // Only create default users if explicit passwords are provided via environment
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  const staffPassword = process.env.DEFAULT_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    console.warn('⚠️  DEFAULT_ADMIN_PASSWORD and DEFAULT_STAFF_PASSWORD environment variables not set.');
    console.warn('⚠️  No default users will be created. Please create users manually or set environment variables.');
    return;
  }

  const adminRes = await db.query(
    `INSERT INTO users (username, full_name, role, password_hash)
     VALUES ($1, $2, 'admin', $3)
     RETURNING id`,
    ['admin', 'System Administrator', hashPassword(adminPassword)]
  );

  await db.query(
    `INSERT INTO users (username, full_name, role, password_hash, created_by)
     VALUES ($1, $2, 'staff', $3, $4)`,
    ['staff', 'Staff User', hashPassword(staffPassword), adminRes.rows[0].id]
  );
}

function requireSession(sessionToken) {
  const token = String(sessionToken || '').trim();
  const session = sessions.get(token);

  if (!session) {
    throw new Error('Unauthorized. Please login again.');
  }

  if (!session.expiresAt || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    throw new Error('Session expired. Please login again.');
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;

  return session;
}

function requireAdmin(sessionToken) {
  const session = requireSession(sessionToken);
  if (session.role !== 'admin') {
    throw new Error('Only admin users can perform this action.');
  }
  return session;
}

function registerAllHandlers() {
  registerAuthHandlers();
  registerAgencyHandlers();
  registerVenueHandlers();
  registerJfaHandlers();
  registerJobFairHandlers();
  registerMonitoringHandlers();
  registerSummaryHandlers();
  registerDashboardHandlers();
}

// ============================================================================
// AUTH + USER MANAGEMENT HANDLERS
// ============================================================================
function registerAuthHandlers() {
  ipcMain.handle('auth:initialize', async () => {
    await ensureDefaultUsers();
    return { ok: true };
  });

  ipcMain.handle('auth:login', async (_, credentials) => {
    console.log('[AUTH] Login attempt started');
    await ensureDefaultUsers();

    const username = normalizeUsername(credentials?.username);
    const password = String(credentials?.password || '');

    console.log(`[AUTH] Username: ${username}, Password length: ${password.length}`);

    if (!username || !password) {
      console.log('[AUTH] FAILED: Username or password missing');
      throw new Error('Username and password are required.');
    }

    const attemptState = getLoginAttemptState(username);
    if (attemptState?.lockedUntil && attemptState.lockedUntil > Date.now()) {
      console.log('[AUTH] FAILED: Too many login attempts');
      throw new Error('Too many failed login attempts. Try again later.');
    }

    console.log('[AUTH] Querying database for user...');
    const userRes = await db.query(
      `SELECT id, username, email, full_name, role, is_active, password_hash, created_at
       FROM users
       WHERE username = $1`,
      [username]
    );

    const user = userRes.rows[0];
    console.log(`[AUTH] User found: ${user ? 'YES' : 'NO'}`);

    if (user) {
      console.log(`[AUTH] User active: ${user.is_active}, Hash length: ${user.password_hash.length}`);
      const passwordMatch = verifyPassword(password, user.password_hash);
      console.log(`[AUTH] Password match: ${passwordMatch}`);
    }

    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      recordFailedLogin(username);
      console.log('[AUTH] FAILED: Invalid credentials');
      throw new Error('Invalid username or password.');
    }

    clearFailedLogins(username);
    console.log('[AUTH] Creating session token...');

    const sessionToken = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionToken, {
      token: sessionToken,
      userId: user.id,
      role: user.role,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    console.log('[AUTH] LOGIN SUCCESS');
    return {
      sessionToken,
      user: sanitizeUser(user),
    };
  });

  ipcMain.handle('auth:logout', async (_, sessionToken) => {
    const token = String(sessionToken || '').trim();
    if (token) {
      sessions.delete(token);
    }
    return { success: true };
  });

  ipcMain.handle('auth:getSessionUser', async (_, sessionToken) => {
    const token = String(sessionToken || '').trim();
    if (!token) {
      return null;
    }

    const session = sessions.get(token);
    if (!session) {
      return null;
    }

    if (!session.expiresAt || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }

    // Sliding session expiration while user is active.
    session.expiresAt = Date.now() + SESSION_TTL_MS;

    const userRes = await db.query(
      `SELECT id, username, email, full_name, role, is_active, created_at
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [session.userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      sessions.delete(session.token);
      return null;
    }

    // Keep role in sync with the database in case it was changed.
    session.role = user.role;

    return sanitizeUser(user);
  });

  ipcMain.handle('user:getAll', async (_, sessionToken) => {
    requireAdmin(sessionToken);

    const res = await db.query(
      `SELECT id, username, email, full_name, role, is_active, created_at
       FROM users
       ORDER BY role DESC, username ASC`
    );

    return res.rows;
  });

  ipcMain.handle('user:create', async (_, payload) => {
    const session = requireAdmin(payload?.sessionToken);

    const username = normalizeUsername(payload?.username);
    const email = normalizeEmail(payload?.email);
    const fullName = String(payload?.full_name || '').trim();
    const password = String(payload?.password || '');
    const role = String(payload?.role || '').trim().toLowerCase();

    if (!username) {
      throw new Error('Username is required.');
    }
    if (!fullName) {
      throw new Error('Full name is required.');
    }
    if (!['admin', 'staff'].includes(role)) {
      throw new Error('Role must be admin or staff.');
    }
    if (email && !isValidEmail(email)) {
      throw new Error('Please provide a valid email address.');
    }
    assertStrongPassword(password);

    const res = await db.query(
      `INSERT INTO users (username, email, full_name, role, password_hash, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username, email, fullName, role, hashPassword(password), session.userId]
    );

    return res.rows[0];
  });

  ipcMain.handle('user:updateRole', async (_, payload) => {
    const session = requireAdmin(payload?.sessionToken);
    const targetUserId = Number(payload?.userId);
    const nextRole = String(payload?.role || '').trim().toLowerCase();
    const requestedActive = parseBooleanLike(payload?.isActive);

    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      throw new Error('Invalid user ID.');
    }

    if (!['admin', 'staff'].includes(nextRole)) {
      throw new Error('Role must be admin or staff.');
    }

    const userRes = await db.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1`,
      [targetUserId]
    );

    const targetUser = userRes.rows[0];
    if (!targetUser) {
      throw new Error('User not found.');
    }

    const nextIsActive = requestedActive === null ? targetUser.is_active : requestedActive;

    if (targetUser.id === session.userId && (nextRole !== 'admin' || nextIsActive === false)) {
      throw new Error('You cannot remove your own admin role or deactivate your own account.');
    }

    if (targetUser.role === nextRole && targetUser.is_active === nextIsActive) {
      return { success: true, unchanged: true };
    }

    if (targetUser.role === 'admin' && (nextRole === 'staff' || nextIsActive === false)) {
      const adminCountRes = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM users
         WHERE role = 'admin' AND is_active = TRUE`
      );
      const adminCount = adminCountRes.rows[0]?.total || 0;
      if (adminCount <= 1) {
        throw new Error('Cannot demote the last active admin.');
      }
    }

    await db.query(
      `UPDATE users
       SET role = $1,
           is_active = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [nextRole, nextIsActive, targetUserId]
    );

    if (nextIsActive === false) {
      for (const [token, activeSession] of sessions.entries()) {
        if (activeSession?.userId === targetUserId) {
          sessions.delete(token);
        }
      }
    }

    return { success: true };
  });

  ipcMain.handle('user:delete', async (_, payload) => {
    const session = requireAdmin(payload?.sessionToken);
    const targetUserId = Number(payload?.userId);
    const adminPassword = String(payload?.adminPassword || '');

    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      throw new Error('Invalid user ID.');
    }

    if (!adminPassword) {
      throw new Error('Password is required to delete a user.');
    }

    const adminRes = await db.query(
      `SELECT password_hash
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [session.userId]
    );

    const adminUser = adminRes.rows[0];
    if (!adminUser || !verifyPassword(adminPassword, adminUser.password_hash)) {
      throw new Error('Incorrect password. User was not deleted.');
    }

    if (targetUserId === session.userId) {
      throw new Error('You cannot delete your own account.');
    }

    const targetRes = await db.query(
      `SELECT id, role
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [targetUserId]
    );

    const targetUser = targetRes.rows[0];
    if (!targetUser) {
      throw new Error('User not found.');
    }

    if (targetUser.role === 'admin') {
      const adminCountRes = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM users
         WHERE role = 'admin' AND is_active = TRUE`
      );
      const adminCount = adminCountRes.rows[0]?.total || 0;
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last active admin.');
      }
    }

    await db.query(
      `DELETE FROM users
       WHERE id = $1`,
      [targetUserId]
    );

    for (const [token, activeSession] of sessions.entries()) {
      if (activeSession?.userId === targetUserId) {
        sessions.delete(token);
      }
    }

    return { success: true };
  });

  ipcMain.handle('user:updateOwnProfile', async (_, payload) => {
    const session = requireSession(payload?.sessionToken);

    const username = normalizeUsername(payload?.username);
    const email = normalizeEmail(payload?.email);
    const fullName = String(payload?.full_name || '').trim();

    if (!username) {
      throw new Error('Username is required.');
    }

    if (!fullName) {
      throw new Error('Full name is required.');
    }

    if (email && !isValidEmail(email)) {
      throw new Error('Please provide a valid email address.');
    }

    const res = await db.query(
      `UPDATE users
       SET username = $1,
           email = $2,
           full_name = $3,
           updated_at = NOW()
       WHERE id = $4 AND is_active = TRUE
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username, email, fullName, session.userId]
    );

    if (!res.rows.length) {
      throw new Error('Unable to update account info.');
    }

    return sanitizeUser(res.rows[0]);
  });

  ipcMain.handle('user:changeOwnPassword', async (_, payload) => {
    const session = requireSession(payload?.sessionToken);
    const currentPassword = String(payload?.currentPassword || '');
    const newPassword = String(payload?.newPassword || '');

    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required.');
    }

    assertStrongPassword(newPassword, 'New password');

    const userRes = await db.query(
      `SELECT password_hash
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [session.userId]
    );

    const user = userRes.rows[0];
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      throw new Error('Current password is incorrect.');
    }

    if (verifyPassword(newPassword, user.password_hash)) {
      throw new Error('New password must be different from current password.');
    }

    await db.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [hashPassword(newPassword), session.userId]
    );

    return { success: true };
  });
}

// ============================================================================
// AGENCY HANDLERS
// ============================================================================
function registerAgencyHandlers() {
  ipcMain.handle('agency:getAll', async () => {
    const res = await db.query(
      'SELECT * FROM agencies ORDER BY created_at DESC, id DESC'
    );
    return res.rows;
  });

  ipcMain.handle('agency:getByType', async (_, type) => {
    const res = await db.query(
      'SELECT * FROM agencies WHERE agency_type = $1 ORDER BY agency_name',
      [type]
    );
    return res.rows;
  });

  ipcMain.handle('agency:getById', async (_, id) => {
    if (!id || isNaN(id)) {
      throw new Error('Invalid agency ID');
    }
    const res = await db.query(
      'SELECT * FROM agencies WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) {
      throw new Error('Agency not found');
    }
    return res.rows[0];
  });

  ipcMain.handle('agency:create', async (_, data) => {
    // VALIDATION: Check required fields
    if (!data.agency_name || !data.agency_name.trim()) {
      throw new Error('Agency name is required');
    }

    if (!data.agency_type || !data.agency_type.trim()) {
      throw new Error('Agency type is required');
    }

    const isActive = typeof data.is_active === 'boolean' ? data.is_active : true;

    const res = await db.query(
      `INSERT INTO agencies (agency_name, agency_type, is_active)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.agency_name.trim(), data.agency_type.trim(), isActive]
    );
    return res.rows[0];
  });

  ipcMain.handle('agency:update', async (_, data) => {
    // VALIDATION: Check for NULL ID
    if (!data.id || isNaN(data.id)) {
      throw new Error('Invalid agency ID for update');
    }
    if (!data.agency_name || !data.agency_name.trim()) {
      throw new Error('Agency name is required');
    }
    
    const isActive = typeof data.is_active === 'boolean' ? data.is_active : true;

    const res = await db.query(
      `UPDATE agencies SET agency_name=$1, agency_type=$2, is_active=$3
       WHERE id=$4 RETURNING *`,
      [data.agency_name.trim(), data.agency_type, isActive, data.id]
    );
    
    if (!res.rows.length) {
      throw new Error('Agency not found or update failed');
    }
    return res.rows[0];
  });

  ipcMain.handle('agency:delete', async (_, id) => {
    await db.query('DELETE FROM agencies WHERE id = $1', [id]);
    return { success: true };
  });
}

// ============================================================================
// VENUE HANDLERS
// ============================================================================
function registerVenueHandlers() {
  ipcMain.handle('venue:getAll', async () => {
    const res = await db.query(
      'SELECT * FROM venues ORDER BY venue_name'
    );
    return res.rows;
  });

  ipcMain.handle('venue:getById', async (_, id) => {
    if (!id || isNaN(id)) {
      throw new Error('Invalid venue ID');
    }
    const res = await db.query(
      'SELECT * FROM venues WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) {
      throw new Error('Venue not found');
    }
    return res.rows[0];
  });

  ipcMain.handle('venue:create', async (_, data) => {
    // VALIDATION: Check required fields
    if (!data.venue_name || !data.venue_name.trim()) {
      throw new Error('Venue name is required');
    }
    
    const res = await db.query(
      `INSERT INTO venues (venue_name, city_municipality, province, region)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.venue_name.trim(), data.city_municipality || null, data.province || null, data.region || null]
    );
    return res.rows[0];
  });

  ipcMain.handle('venue:update', async (_, data) => {
    // VALIDATION: Check for NULL ID
    if (!data.id || isNaN(data.id)) {
      throw new Error('Invalid venue ID for update');
    }
    if (!data.venue_name || !data.venue_name.trim()) {
      throw new Error('Venue name is required');
    }
    
    const res = await db.query(
      `UPDATE venues SET venue_name=$1, city_municipality=$2, province=$3, region=$4
       WHERE id=$5 RETURNING *`,
      [data.venue_name.trim(), data.city_municipality, data.province, data.region, data.id]
    );
    
    if (!res.rows.length) {
      throw new Error('Venue not found or update failed');
    }
    return res.rows[0];
  });

  ipcMain.handle('venue:delete', async (_, id) => {
    await db.query('DELETE FROM venues WHERE id = $1', [id]);
    return { success: true };
  });
}

// ============================================================================
// JFA RECORD HANDLERS
// ============================================================================
function registerJfaHandlers() {
  ipcMain.handle('jfa:getAll', async (_, filters) => {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (filters?.fiscal_year) {
      where += ` AND j.fiscal_year = $${idx++}`;
      params.push(filters.fiscal_year);
    }
    if (filters?.month) {
      where += ` AND j.month = $${idx++}`;
      params.push(filters.month);
    }
    if (filters?.status) {
      where += ` AND j.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters?.agency_id) {
      where += ` AND j.agency_id = $${idx++}`;
      params.push(filters.agency_id);
    }

    const res = await db.query(
      `SELECT j.*, a.agency_name, a.agency_type, v.venue_name,
              d.invitation_letter_date, d.affidavit_date, d.job_orders_date,
              d.representative_id_date, d.terminal_report_date,
              d.status_of_applicants, d.status_date, d.is_complete
       FROM jfa_records j
       JOIN agencies a ON j.agency_id = a.id
       LEFT JOIN venues v ON j.venue_id = v.id
       LEFT JOIN jfa_documents d ON j.id = d.jfa_id
       ${where}
       ORDER BY j.fiscal_year DESC, j.month DESC, j.jfa_no`,
      params
    );
    return res.rows;
  });

  ipcMain.handle('jfa:getById', async (_, id) => {
    const res = await db.query(
      `SELECT j.*, a.agency_name, v.venue_name,
              d.invitation_letter_date, d.affidavit_date, d.job_orders_date,
              d.representative_id_date, d.terminal_report_date,
              d.status_of_applicants, d.status_date, d.is_complete
       FROM jfa_records j
       JOIN agencies a ON j.agency_id = a.id
       LEFT JOIN venues v ON j.venue_id = v.id
       LEFT JOIN jfa_documents d ON j.id = d.jfa_id
       WHERE j.id = $1`,
      [id]
    );
    return res.rows[0];
  });

  ipcMain.handle('jfa:create', async (_, data) => {
    if (!data.jfa_no || !data.jfa_no.trim()) {
      throw new Error('JFA No. is required');
    }
    if (!data.agency_id || isNaN(data.agency_id)) {
      throw new Error('Agency is required');
    }
    if (!data.fiscal_year || isNaN(data.fiscal_year)) {
      throw new Error('Fiscal year is required');
    }
    if (!data.month || isNaN(data.month) || data.month < 1 || data.month > 12) {
      throw new Error('Valid month is required');
    }

    const res = await db.query(
      `INSERT INTO jfa_records
       (jfa_no, agency_id, fiscal_year, month, job_fair_date_start, job_fair_date_end,
        venue_id, available_job_orders, job_site, job_orders_balance, status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.jfa_no.trim(), data.agency_id, data.fiscal_year, data.month,
       data.job_fair_date_start || null, data.job_fair_date_end || null,
       data.venue_id || null, data.available_job_orders || 0,
       data.job_site || null, data.job_orders_balance || 0,
       data.status || 'active', data.remarks || null]
    );
    return res.rows[0];
  });

  ipcMain.handle('jfa:update', async (_, data) => {
    if (!data.id || isNaN(data.id)) {
      throw new Error('Invalid JFA ID for update');
    }
    if (!data.jfa_no || !data.jfa_no.trim()) {
      throw new Error('JFA No. is required');
    }
    if (!data.agency_id || isNaN(data.agency_id)) {
      throw new Error('Agency is required');
    }
    if (!data.fiscal_year || isNaN(data.fiscal_year)) {
      throw new Error('Fiscal year is required');
    }
    if (!data.month || isNaN(data.month) || data.month < 1 || data.month > 12) {
      throw new Error('Valid month is required');
    }

    const res = await db.query(
      `UPDATE jfa_records SET
       jfa_no=$1, agency_id=$2, fiscal_year=$3, month=$4,
       job_fair_date_start=$5, job_fair_date_end=$6,
       venue_id=$7, available_job_orders=$8, job_site=$9,
       job_orders_balance=$10, status=$11, remarks=$12
       WHERE id=$13 RETURNING *`,
      [data.jfa_no.trim(), data.agency_id, data.fiscal_year, data.month,
       data.job_fair_date_start || null, data.job_fair_date_end || null,
       data.venue_id || null, data.available_job_orders || 0,
       data.job_site || null, data.job_orders_balance || 0,
       data.status, data.remarks || null, data.id]
    );

    if (!res.rows.length) {
      throw new Error('JFA record not found or update failed');
    }
    return res.rows[0];
  });

  ipcMain.handle('jfa:delete', async (_, id) => {
    await db.query('DELETE FROM jfa_records WHERE id = $1', [id]);
    return { success: true };
  });

  ipcMain.handle('jfa:updateDocuments', async (_, data) => {
    const res = await db.query(
      `UPDATE jfa_documents SET
       invitation_letter_date=$1, affidavit_date=$2, job_orders_date=$3,
       representative_id_date=$4, terminal_report_date=$5,
       status_of_applicants=$6, status_date=$7
       WHERE jfa_id=$8 RETURNING *`,
      [data.invitation_letter_date || null, data.affidavit_date || null,
       data.job_orders_date || null, data.representative_id_date || null,
       data.terminal_report_date || null, data.status_of_applicants || null,
       data.status_date || null, data.jfa_id]
    );
    return res.rows[0];
  });

  ipcMain.handle('jfa:getDocumentStatus', async (_, filters) => {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (filters?.fiscal_year) {
      where += ` AND fiscal_year = $${idx++}`;
      params.push(filters.fiscal_year);
    }
    if (filters?.month) {
      where += ` AND month = $${idx++}`;
      params.push(filters.month);
    }

    const res = await db.query(
      `SELECT * FROM v_jfa_document_status ${where}
       ORDER BY fiscal_year DESC, month, jfa_no`,
      params
    );
    return res.rows;
  });
}

// ============================================================================
// JOB FAIR EVENT HANDLERS
// ============================================================================
function registerJobFairHandlers() {
  // Get all events with details
  ipcMain.handle('jobfair:getAll', async (_, filters) => {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (filters?.fiscal_year) {
      where += ` AND e.fiscal_year = $${idx++}`;
      params.push(filters.fiscal_year);
    }
    if (filters?.month) {
      where += ` AND e.month = $${idx++}`;
      params.push(filters.month);
    }

    const res = await db.query(
      `SELECT e.*, org.agency_name AS organizer_name, v.venue_name,
              COALESCE(SUM(p.registered_applicants_male), 0) AS total_male,
              COALESCE(SUM(p.registered_applicants_female), 0) AS total_female,
              COALESCE(SUM(p.registered_applicants_male + p.registered_applicants_female), 0) AS total_applicants,
              COUNT(DISTINCT p.id) AS total_agencies
       FROM job_fair_events e
       LEFT JOIN agencies org ON e.organizer_id = org.id
       LEFT JOIN venues v ON e.venue_id = v.id
       LEFT JOIN job_fair_participants p ON e.id = p.event_id
       ${where}
       GROUP BY e.id, org.agency_name, v.venue_name
       ORDER BY e.fiscal_year DESC, e.month DESC, e.job_fair_date_start`,
      params
    );
    return res.rows;
  });

  // Get single event with participants
  ipcMain.handle('jobfair:getById', async (_, id) => {
    const eventRes = await db.query(
      `SELECT e.*, org.agency_name AS organizer_name, v.venue_name
       FROM job_fair_events e
       LEFT JOIN agencies org ON e.organizer_id = org.id
       LEFT JOIN venues v ON e.venue_id = v.id
       WHERE e.id = $1`,
      [id]
    );

    const participantRes = await db.query(
      `SELECT p.*, a.agency_name, j.jfa_no
       FROM job_fair_participants p
       JOIN agencies a ON p.agency_id = a.id
       LEFT JOIN jfa_records j ON p.jfa_id = j.id
       WHERE p.event_id = $1
       ORDER BY a.agency_name`,
      [id]
    );

    return {
      event: eventRes.rows[0],
      participants: participantRes.rows
    };
  });

  // Create event
  ipcMain.handle('jobfair:create', async (_, data) => {
    // VALIDATION: Check required fields
    if (!data.fiscal_year || isNaN(data.fiscal_year)) {
      throw new Error('Fiscal year is required');
    }
    if (!data.month || isNaN(data.month) || data.month < 1 || data.month > 12) {
      throw new Error('Valid month is required');
    }
    if (!data.job_fair_date_start) {
      throw new Error('Job Fair start date is required');
    }
    
    const res = await db.query(
      `INSERT INTO job_fair_events
       (fiscal_year, month, organizer_id, job_fair_date_start, job_fair_date_end,
        venue_id, num_job_fairs_facilitated, monitored_by, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.fiscal_year, data.month, data.organizer_id || null,
       data.job_fair_date_start, data.job_fair_date_end || null,
       data.venue_id || null, data.num_job_fairs_facilitated || 1,
       data.monitored_by || null, data.remarks || null]
    );
    return res.rows[0];
  });

  // Update event
  ipcMain.handle('jobfair:update', async (_, data) => {
    // VALIDATION: Check for NULL ID
    if (!data.id || isNaN(data.id)) {
      throw new Error('Invalid event ID for update');
    }
    if (!data.fiscal_year || isNaN(data.fiscal_year)) {
      throw new Error('Fiscal year is required');
    }
    if (!data.month || isNaN(data.month) || data.month < 1 || data.month > 12) {
      throw new Error('Valid month is required');
    }
    if (!data.job_fair_date_start) {
      throw new Error('Job Fair start date is required');
    }
    
    const res = await db.query(
      `UPDATE job_fair_events SET
       fiscal_year=$1, month=$2, organizer_id=$3,
       job_fair_date_start=$4, job_fair_date_end=$5,
       venue_id=$6, num_job_fairs_facilitated=$7,
       monitored_by=$8, remarks=$9
       WHERE id=$10 RETURNING *`,
      [data.fiscal_year, data.month, data.organizer_id || null,
       data.job_fair_date_start, data.job_fair_date_end || null,
       data.venue_id || null, data.num_job_fairs_facilitated || 1,
       data.monitored_by || null, data.remarks || null, data.id]
    );
    
    if (!res.rows.length) {
      throw new Error('Event not found or update failed');
    }
    return res.rows[0];
  });

  // Delete event
  ipcMain.handle('jobfair:delete', async (_, id) => {
    await db.query('DELETE FROM job_fair_events WHERE id = $1', [id]);
    return { success: true };
  });

  // Add participant to event
  ipcMain.handle('jobfair:addParticipant', async (_, data) => {
    if (!data.agency_category || !data.agency_category.trim()) {
      throw new Error('Agency category is required (land-based or sea-based)');
    }

    const res = await db.query(
      `INSERT INTO job_fair_participants
       (event_id, agency_id, jfa_id, agency_category,
        registered_applicants_male, registered_applicants_female,
        terminal_report_male, terminal_report_female)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (event_id, agency_id)
       DO UPDATE SET
         jfa_id = EXCLUDED.jfa_id,
         agency_category = EXCLUDED.agency_category,
         registered_applicants_male = EXCLUDED.registered_applicants_male,
         registered_applicants_female = EXCLUDED.registered_applicants_female,
         terminal_report_male = EXCLUDED.terminal_report_male,
         terminal_report_female = EXCLUDED.terminal_report_female
       RETURNING *`,
      [data.event_id, data.agency_id, data.jfa_id || null,
       data.agency_category.trim(),
       data.registered_applicants_male || 0,
       data.registered_applicants_female || 0,
       data.terminal_report_male || 0,
       data.terminal_report_female || 0]
    );
    return res.rows[0];
  });

  // Update participant
  ipcMain.handle('jobfair:updateParticipant', async (_, data) => {
    if (!data.agency_category || !data.agency_category.trim()) {
      throw new Error('Agency category is required (land-based or sea-based)');
    }

    const res = await db.query(
      `UPDATE job_fair_participants SET
       agency_id=$1, jfa_id=$2, agency_category=$3,
       registered_applicants_male=$4, registered_applicants_female=$5,
       terminal_report_male=$6, terminal_report_female=$7
       WHERE id=$8 RETURNING *`,
      [data.agency_id, data.jfa_id || null,
       data.agency_category.trim(),
       data.registered_applicants_male || 0,
       data.registered_applicants_female || 0,
       data.terminal_report_male || 0,
       data.terminal_report_female || 0,
       data.id]
    );
    return res.rows[0];
  });

  // Delete participant
  ipcMain.handle('jobfair:deleteParticipant', async (_, id) => {
    await db.query('DELETE FROM job_fair_participants WHERE id = $1', [id]);
    return { success: true };
  });
}

// ============================================================================
// MONITORING HANDLERS
// ============================================================================
function registerMonitoringHandlers() {
  ipcMain.handle('monitoring:pickEvidencePath', async (_, mode = 'files') => {
    const focusedWindow = BrowserWindow.getFocusedWindow() || undefined;
    const isFolderMode = mode === 'folder';

    const options = {
      title: isFolderMode ? 'Select Evidence Folder' : 'Select Evidence File(s)',
      properties: isFolderMode
        ? ['openDirectory']
        : ['openFile', 'multiSelections'],
      buttonLabel: isFolderMode ? 'Select Folder' : 'Select File(s)',
    };

    const result = await dialog.showOpenDialog(focusedWindow, options);
    if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return { canceled: true, paths: [] };
    }

    return { canceled: false, paths: result.filePaths };
  });

  ipcMain.handle('monitoring:openEvidencePath', async (_, targetPath) => {
    const pathValue = String(targetPath || '').trim();
    if (!pathValue) {
      return { success: false, error: 'Invalid path' };
    }

    const errorMessage = await shell.openPath(pathValue);
    if (errorMessage) {
      return { success: false, error: errorMessage };
    }

    return { success: true };
  });

  ipcMain.handle('monitoring:getAll', async (_, filters) => {
    await ensureMonitoringSchema();

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (filters?.fiscal_year) {
      where += ` AND m.fiscal_year = $${idx++}`;
      params.push(filters.fiscal_year);
    }
    if (filters?.month) {
      where += ` AND m.month = $${idx++}`;
      params.push(filters.month);
    }

    const res = await db.query(
      `SELECT m.*, a.agency_name AS implementing_agency, v.venue_name
       FROM monitoring_records m
       LEFT JOIN agencies a ON m.implementing_agency_id = a.id
       LEFT JOIN venues v ON m.venue_id = v.id
       ${where}
       ORDER BY m.fiscal_year, m.month, m.job_fair_date_start`,
      params
    );
    return res.rows;
  });

  ipcMain.handle('monitoring:getById', async (_, id) => {
    await ensureMonitoringSchema();

    if (!id || isNaN(id)) {
      throw new Error('Invalid monitoring record ID');
    }
    const res = await db.query(
      `SELECT m.*, a.agency_name AS implementing_agency, v.venue_name
       FROM monitoring_records m
       LEFT JOIN agencies a ON m.implementing_agency_id = a.id
       LEFT JOIN venues v ON m.venue_id = v.id
       WHERE m.id = $1`,
      [id]
    );
    if (res.rows.length === 0) {
      throw new Error('Monitoring record not found');
    }
    return res.rows[0];
  });

  ipcMain.handle('monitoring:create', async (_, data) => {
    await ensureMonitoringSchema();

    // VALIDATION: Check required fields
    if (!data.implementing_agency_id || isNaN(data.implementing_agency_id)) {
      throw new Error('Implementing agency is required');
    }
    if (!data.job_fair_date_start) {
      throw new Error('Job Fair date is required');
    }
    if (!data.fiscal_year || isNaN(data.fiscal_year)) {
      throw new Error('Fiscal year is required');
    }
    if (!data.month || isNaN(data.month) || data.month < 1 || data.month > 12) {
      throw new Error('Valid month is required');
    }

    const fiscalYear = await ensureFiscalYearExists(data.fiscal_year);
    
    const res = await db.query(
      `INSERT INTO monitoring_records
       (event_id, implementing_agency_id, job_fair_date_start, job_fair_date_end,
        venue_id, celebration_event, job_fair_monitoring, conduct_of_peos,
        communication_letter_received, invitation_emailed, confirmation_deadline,
        transmittal_letter_date, evidence_path, monitored_by, remarks, fiscal_year, month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [data.event_id || null, data.implementing_agency_id,
       data.job_fair_date_start, data.job_fair_date_end || null,
       data.venue_id || null, data.celebration_event || null,
        parseBooleanLike(data.job_fair_monitoring),
        parseBooleanLike(data.conduct_of_peos),
       data.communication_letter_received || null,
       data.invitation_emailed || null, data.confirmation_deadline || null,
       data.transmittal_letter_date || null, data.evidence_path || null,
       data.monitored_by || null, data.remarks || null, fiscalYear, data.month]
    );
    return res.rows[0];
  });

  ipcMain.handle('monitoring:update', async (_, data) => {
    await ensureMonitoringSchema();

    // VALIDATION: Check for NULL ID
    if (!data.id || isNaN(data.id)) {
      throw new Error('Invalid monitoring record ID for update');
    }
    if (!data.implementing_agency_id || isNaN(data.implementing_agency_id)) {
      throw new Error('Implementing agency is required');
    }
    if (!data.job_fair_date_start) {
      throw new Error('Job Fair date is required');
    }
    if (!data.fiscal_year || isNaN(data.fiscal_year)) {
      throw new Error('Fiscal year is required');
    }
    if (!data.month || isNaN(data.month) || data.month < 1 || data.month > 12) {
      throw new Error('Valid month is required');
    }

    const fiscalYear = await ensureFiscalYearExists(data.fiscal_year);
    
    const res = await db.query(
      `UPDATE monitoring_records SET
       implementing_agency_id=$1, job_fair_date_start=$2, job_fair_date_end=$3,
       venue_id=$4, celebration_event=$5, job_fair_monitoring=$6, conduct_of_peos=$7,
       communication_letter_received=$8, invitation_emailed=$9, confirmation_deadline=$10,
       transmittal_letter_date=$11, evidence_path=$12, monitored_by=$13, remarks=$14,
       fiscal_year=$15, month=$16
       WHERE id=$17 RETURNING *`,
      [data.implementing_agency_id, data.job_fair_date_start,
       data.job_fair_date_end || null, data.venue_id || null,
       data.celebration_event || null,
        parseBooleanLike(data.job_fair_monitoring),
        parseBooleanLike(data.conduct_of_peos),
       data.communication_letter_received || null,
       data.invitation_emailed || null,
       data.confirmation_deadline || null,
       data.transmittal_letter_date || null,
       data.evidence_path || null,
       data.monitored_by || null,
       data.remarks || null,
       fiscalYear, data.month, data.id]
    );
    
    if (!res.rows.length) {
      throw new Error('Monitoring record not found or update failed');
    }
    return res.rows[0];
  });

  ipcMain.handle('monitoring:delete', async (_, id) => {
    await db.query('DELETE FROM monitoring_records WHERE id = $1', [id]);
    return { success: true };
  });
}

// ============================================================================
// SUMMARY HANDLERS (Auto-computed views)
// ============================================================================
function registerSummaryHandlers() {
  // JFA Summary (replaces SUMMARY sheets in JFA files)
  ipcMain.handle('summary:jfa', async (_, fiscalYear) => {
    const res = await db.query(
      `SELECT * FROM v_jfa_summary WHERE fiscal_year = $1`,
      [fiscalYear]
    );
    return res.rows;
  });

  // Job Fair Summary (replaces SUMMARY sheets in Job Fair Report files)
  ipcMain.handle('summary:jobfair', async (_, fiscalYear) => {
    const res = await db.query(
      `SELECT * FROM v_job_fair_summary WHERE fiscal_year = $1`,
      [fiscalYear]
    );
    return res.rows;
  });

  // Monitoring Overview
  ipcMain.handle('summary:monitoring', async (_, fiscalYear) => {
    const res = await db.query(
      `SELECT * FROM v_monitoring_overview WHERE fiscal_year = $1`,
      [fiscalYear]
    );
    return res.rows;
  });

  // Event Details View
  ipcMain.handle('summary:eventDetails', async (_, filters) => {
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (filters?.fiscal_year) {
      where += ` AND fiscal_year = $${idx++}`;
      params.push(filters.fiscal_year);
    }
    if (filters?.month) {
      where += ` AND month = $${idx++}`;
      params.push(filters.month);
    }

    const res = await db.query(
      `SELECT * FROM v_job_fair_event_details ${where}`,
      params
    );
    return res.rows;
  });

  // Yearly totals
  ipcMain.handle('summary:yearlyTotals', async (_, fiscalYear) => {
    const jfaRes = await db.query(
      `SELECT fiscal_year,
              COUNT(*) AS total_jfa,
              COUNT(*) FILTER (WHERE status='completed') AS completed,
              COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
              COUNT(*) FILTER (WHERE status='not_participated') AS not_participated,
              COUNT(*) FILTER (WHERE status='active') AS active
       FROM jfa_records WHERE fiscal_year = $1
       GROUP BY fiscal_year`,
      [fiscalYear]
    );

    const jfRes = await db.query(
      `SELECT e.fiscal_year,
              COALESCE(SUM(e.num_job_fairs_facilitated), 0) AS total_job_fairs,
              COALESCE(SUM(p.registered_applicants_male), 0) AS total_male,
              COALESCE(SUM(p.registered_applicants_female), 0) AS total_female,
              COALESCE(SUM(p.registered_applicants_male + p.registered_applicants_female), 0) AS total_applicants,
              COUNT(DISTINCT CASE WHEN p.agency_category='land-based' THEN p.id END) AS land_based,
              COUNT(DISTINCT CASE WHEN p.agency_category='sea-based' THEN p.id END) AS sea_based,
              COUNT(DISTINCT p.id) AS total_agencies
       FROM job_fair_events e
       LEFT JOIN job_fair_participants p ON e.id = p.event_id
       WHERE e.fiscal_year = $1
       GROUP BY e.fiscal_year`,
      [fiscalYear]
    );

    return {
      jfa: jfaRes.rows[0] || {},
      jobFair: jfRes.rows[0] || {}
    };
  });
}

// ============================================================================
// DASHBOARD HANDLERS
// ============================================================================
function registerDashboardHandlers() {
  ipcMain.handle('dashboard:stats', async () => {
    // Get totals for all years
    const jfaTotal = await db.query(
      `SELECT fiscal_year, COUNT(*) AS count FROM jfa_records GROUP BY fiscal_year ORDER BY fiscal_year`
    );

    const eventTotal = await db.query(
      `SELECT fiscal_year, COALESCE(SUM(num_job_fairs_facilitated),0) AS count
       FROM job_fair_events GROUP BY fiscal_year ORDER BY fiscal_year`
    );

    const applicantTotal = await db.query(
      `SELECT e.fiscal_year,
              COALESCE(SUM(p.registered_applicants_male),0) AS male,
              COALESCE(SUM(p.registered_applicants_female),0) AS female,
              COALESCE(SUM(p.registered_applicants_male + p.registered_applicants_female),0) AS total
       FROM job_fair_events e
       LEFT JOIN job_fair_participants p ON e.id = p.event_id
       GROUP BY e.fiscal_year ORDER BY e.fiscal_year`
    );

    const agencyTotal = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE agency_type='recruitment') AS recruitment,
              COUNT(*) FILTER (WHERE agency_type='lgu') AS lgu,
              COUNT(*) FILTER (WHERE agency_type='school') AS school,
              COUNT(*) FILTER (WHERE agency_type='dole') AS dole
       FROM agencies`
    );

    const recentJfa = await db.query(
      `SELECT j.jfa_no, a.agency_name, j.job_fair_date_start, j.status, j.fiscal_year, j.month
       FROM jfa_records j JOIN agencies a ON j.agency_id = a.id
       ORDER BY j.created_at DESC LIMIT 10`
    );

    const monthlyTrend = await db.query(
      `SELECT e.fiscal_year, e.month,
              COALESCE(SUM(p.registered_applicants_male + p.registered_applicants_female),0) AS applicants
       FROM job_fair_events e
       LEFT JOIN job_fair_participants p ON e.id = p.event_id
       GROUP BY e.fiscal_year, e.month
       ORDER BY e.fiscal_year, e.month`
    );

    return {
      jfaByYear: jfaTotal.rows,
      eventsByYear: eventTotal.rows,
      applicantsByYear: applicantTotal.rows,
      agencyStats: agencyTotal.rows[0],
      recentJfa: recentJfa.rows,
      monthlyTrend: monthlyTrend.rows
    };
  });

  // Get fiscal years
  ipcMain.handle('db:getFiscalYears', async () => {
    const res = await db.query('SELECT * FROM fiscal_years ORDER BY year');
    return res.rows;
  });
}

module.exports = { registerAllHandlers };
