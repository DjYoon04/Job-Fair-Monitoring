// src/js/renderer.js
// ============================================================================
// JOB FAIR MONITORING SYSTEM - Frontend Renderer
// ============================================================================

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

let currentPage = 'dashboard';
let sessionToken = null;
let currentUser = null;
let appInitialized = false;
let authContext = 'public';
let currentSearchQuery = '';
let availableFiscalYears = [];
let topbarClockIntervalId = null;
let topbarUpcomingNotifications = [];
let jfTopScrollResizeObserver = null;
let jfaTopScrollResizeObserver = null;
const seenTopbarNotificationIds = new Set();
const PERSISTABLE_PAGES = new Set([
  'dashboard',
  'jfa-tracking',
  'job-fair-report',
  'monitoring',
  'summaries',
  'agencies',
  'venues',
  'users',
]);

function getLastVisitedPageStorageKey() {
  const userKey = currentUser?.id || currentUser?.username || 'default';
  return `lastVisitedPage:${userKey}`;
}

function persistLastVisitedPage(page) {
  if (!PERSISTABLE_PAGES.has(page)) return;
  try {
    sessionStorage.setItem(getLastVisitedPageStorageKey(), page);
  } catch {
    // Ignore storage write errors.
  }
}

function getLastVisitedPage() {
  try {
    const page = sessionStorage.getItem(getLastVisitedPageStorageKey());
    return PERSISTABLE_PAGES.has(page) ? page : null;
  } catch {
    return null;
  }
}

function getTopbarSeenNotificationsStorageKey() {
  const userKey = currentUser?.id || currentUser?.username || 'default';
  return `topbarSeenNotifications:${userKey}`;
}

function loadSeenTopbarNotifications() {
  seenTopbarNotificationIds.clear();

  try {
    const raw = localStorage.getItem(getTopbarSeenNotificationsStorageKey());
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    parsed.forEach((id) => {
      if (typeof id === 'string' && id.trim()) {
        seenTopbarNotificationIds.add(id);
      }
    });
  } catch {
    // Ignore storage/parse errors and continue with an empty seen set.
  }
}

function persistSeenTopbarNotifications() {
  try {
    localStorage.setItem(
      getTopbarSeenNotificationsStorageKey(),
      JSON.stringify(Array.from(seenTopbarNotificationIds).slice(-200))
    );
  } catch {
    // Ignore storage write errors.
  }
}

// Helper function to format dates for input fields (handles Date objects and strings)
function formatDateForInput(date) {
  if (!date) return '';
  if (typeof date === 'string') return date.substring(0, 10);
  if (date instanceof Date) return date.toISOString().substring(0, 10);
  return '';
}

function setStartupLoading(isVisible, message = 'Loading...') {
  const loadingEl = document.getElementById('startupLoadingScreen');
  const textEl = document.getElementById('startupLoadingText');
  if (!loadingEl) return;

  if (textEl) {
    textEl.textContent = message;
  }

  loadingEl.style.display = isVisible ? 'flex' : 'none';
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📋 Page loaded, starting authentication...');
  setupAuthHandlers();
  document.body.classList.add('auth-required');
  setStartupLoading(true, 'Loading...');

  try {
    await window.api.initializeAuth();

    const storedToken = localStorage.getItem('sessionToken');
    if (storedToken) {
      try {
        const user = await window.api.getSessionUser(storedToken);
        if (!user) {
          localStorage.removeItem('sessionToken');
          setStartupLoading(false);
          showAuthScreen('login', 'public');
          return;
        }

        sessionToken = storedToken;
        currentUser = user;
        await bootstrapAppAfterLogin();
        return;
      } catch {
        localStorage.removeItem('sessionToken');
      }
    }

    setStartupLoading(false);
    showAuthScreen('login', 'public');
  } catch (err) {
    console.error('❌ Initialization error:', err);
    setAuthMessage(err.message || 'Failed to initialize authentication.');
    setStartupLoading(false);
    showAuthScreen('login', 'public');
  }
});

async function bootstrapAppAfterLogin() {
  if (!appInitialized) {
    setupSidebarToggle();
    setupNavigation();
    setupModalHandlers();
    setupUserMenuHandlers();
    setupGlobalSearch();
    setupNetworkStatus();
    setupPageHandlers();
    appInitialized = true;
  }

  updateCurrentUserUI();
  applyRoleAccess();
  document.body.classList.remove('auth-required');

  await checkDbConnection();

  const savedPage = getLastVisitedPage();
  const initialPage = currentUser?.role !== 'admin' && savedPage === 'users'
    ? 'dashboard'
    : (savedPage || 'dashboard');

  switchPage(initialPage);
  setStartupLoading(false);
}

function setupAuthHandlers() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const signupCancel = document.getElementById('signupCancel');
  const logoutBtn = document.getElementById('logoutBtn');

  setupPasswordToggles();

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  if (signupForm) {
    signupForm.addEventListener('submit', handleSignupSubmit);
  }

  if (signupCancel) {
    signupCancel.addEventListener('click', () => {
      setAuthMessage('');
      if (authContext === 'admin-create') {
        document.body.classList.remove('auth-required');
        showAuthScreen('login', 'public');
      } else {
        showAuthScreen('login', authContext);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

function setupPasswordToggles() {
  const toggleIcons = document.querySelectorAll('.toggle-password');

  toggleIcons.forEach((icon) => {
    icon.addEventListener('click', (event) => {
      event.preventDefault();
      const input = icon.closest('.auth-input-wrap')?.querySelector('input');
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      icon.classList.toggle('fa-eye', !isPassword);
      icon.classList.toggle('fa-eye-slash', isPassword);

      const toggleBtn = icon.closest('.toggle-password-btn');
      if (toggleBtn) {
        const nextLabel = isPassword ? 'Hide password' : 'Show password';
        toggleBtn.setAttribute('aria-label', nextLabel);
        toggleBtn.setAttribute('title', nextLabel);
      }
    });
  });
}

function showAuthScreen(mode = 'login', context = 'public') {
  if (mode === 'signup' && context !== 'admin-create') {
    mode = 'login';
    context = 'public';
  }

  authContext = context;

  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const authHeading = document.getElementById('authHeading');
  const subtitle = document.getElementById('authSubtitle');

  if (loginForm) loginForm.style.display = mode === 'login' ? 'block' : 'none';
  if (signupForm) signupForm.style.display = mode === 'signup' ? 'block' : 'none';

  if (authHeading) {
    authHeading.textContent = mode === 'signup' ? 'Create User' : 'Welcome Back';
  }

  if (subtitle) {
    subtitle.textContent = mode === 'signup'
      ? 'Admin signup: create a new user account'
      : 'Sign in to access the system';
  }

  if (mode === 'signup') {
    document.body.classList.add('auth-required');
    if (signupForm) signupForm.reset();
  }
}

function setAuthMessage(message = '', type = 'error') {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = message;
  el.style.color = type === 'success' ? '#16a34a' : '#dc2626';
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  setAuthMessage('');

  const username = getFormValue('loginUsername');
  const password = document.getElementById('loginPassword')?.value || '';

  if (!username || !password) {
    setAuthMessage('Username and password are required.');
    return;
  }

  try {
    const result = await window.api.login({ username, password });
    sessionToken = result.sessionToken;
    currentUser = result.user;
    localStorage.setItem('sessionToken', sessionToken);

    document.getElementById('loginPassword').value = '';
    setAuthMessage('');
    await bootstrapAppAfterLogin();
  } catch (err) {
    setAuthMessage(err.message || 'Login failed.');
  }
}

async function handleSignupSubmit(e) {
  e.preventDefault();
  setAuthMessage('');

  if (!sessionToken || currentUser?.role !== 'admin') {
    setAuthMessage('Only an authenticated admin can create users.');
    return;
  }

  const fullName = getFormValue('signupFullName');
  const username = getFormValue('signupUsername');
  const password = document.getElementById('signupPassword')?.value || '';
  const confirmPassword = document.getElementById('signupConfirmPassword')?.value || '';
  const role = getFormValue('signupRole');

  if (!fullName || !username || !password || !confirmPassword || !role) {
    setAuthMessage('Please complete all signup fields.');
    return;
  }

  if (password !== confirmPassword) {
    setAuthMessage('Passwords do not match.');
    return;
  }

  try {
    await window.api.createUser({
      sessionToken,
      full_name: fullName,
      username,
      password,
      role,
    });

    const signupForm = document.getElementById('signupForm');
    if (signupForm) signupForm.reset();

    if (authContext === 'admin-create') {
      document.body.classList.remove('auth-required');
      setAuthMessage('');
      showToast('User created', 'success');
      await loadUsers();
      return;
    }

    setAuthMessage('User created successfully.', 'success');
  } catch (err) {
    setAuthMessage(err.message || 'Signup failed.');
  }
}

async function handleLogout() {
  try {
    if (sessionToken) {
      await window.api.logout(sessionToken);
    }
  } catch {
    // Ignore logout API errors and clear local state anyway.
  }

  try {
    sessionStorage.removeItem(getLastVisitedPageStorageKey());
  } catch {
    // Ignore storage remove errors.
  }

  sessionToken = null;
  currentUser = null;
  seenTopbarNotificationIds.clear();
  topbarUpcomingNotifications = [];
  localStorage.removeItem('sessionToken');
  document.body.classList.add('auth-required');
  showAuthScreen('login', 'public');
  setAuthMessage('');

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.reset();
}

function updateCurrentUserUI() {
  const initialEl = document.getElementById('sidebarUserInitial');
  const nameEl = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');

  const fullName = currentUser?.full_name || '';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || '--';

  if (initialEl) initialEl.textContent = initials;
  if (nameEl) nameEl.textContent = fullName || 'Not signed in';
  if (roleEl) roleEl.textContent = currentUser?.role === 'admin' ? 'Administrator' : 'Staff';
}

function canCurrentUserWrite() {
  return currentUser?.role === 'admin';
}

function ensureCanWrite(action = 'perform this action') {
  if (canCurrentUserWrite()) {
    return true;
  }

  showToast(`Staff accounts are view-only and cannot ${action}.`, 'error');
  return false;
}

function applyRoleAccess() {
  const isAdmin = currentUser?.role === 'admin';
  const navUsers = document.getElementById('navUsers');
  const userAddBtn = document.getElementById('userAddBtn');
  const writeButtons = ['jfaAddBtn', 'jfAddBtn', 'monAddBtn', 'agencyAddBtn', 'venueAddBtn'];

  if (navUsers) {
    navUsers.style.display = isAdmin ? '' : 'none';
  }

  if (userAddBtn) {
    userAddBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  writeButtons.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.display = isAdmin ? 'inline-flex' : 'none';
    }
  });

  if (!isAdmin && currentPage === 'users') {
    switchPage('dashboard');
  }
}

// ============================================================================
// NAVIGATION
// ============================================================================
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  console.log(`Found ${navItems.length} nav items`);
  
  navItems.forEach((item, index) => {
    const page = item.dataset.page;
    if (!page) {
      console.warn(`Nav item ${index} has no data-page attribute`);
      return;
    }
    
    item.addEventListener('click', (e) => {
      console.log(`Clicked nav item: ${page}`);
      e.preventDefault();
      e.stopPropagation();
      switchPage(page);
    });
  });

  updateTopbarTitle(currentPage);
}

function updateTopbarTitle(page) {
  const titleEl = document.querySelector('.proc-topbar-title');
  if (!titleEl) return;

  const navItem = document.querySelector(`.nav-item[data-page="${page}"] span`);
  if (navItem?.textContent?.trim()) {
    titleEl.textContent = navItem.textContent.trim().toUpperCase();
    return;
  }

  titleEl.textContent = page.replace(/-/g, ' ').toUpperCase();
}

async function switchPage(page) {
  if (!PERSISTABLE_PAGES.has(page)) {
    page = 'dashboard';
  }

  if (page === 'users' && currentUser?.role !== 'admin') {
    showToast('Only admins can access Users page', 'error');
    return;
  }

  currentPage = page;
  persistLastVisitedPage(page);
  updateGlobalSearchVisibility(currentPage);
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  updateTopbarTitle(page);
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.add('active');
  } else {
    console.warn(`Page element not found: page-${page}`);
  }
  // Load page data
  try {
    await loadPageData(page);
    applyPageSearch(page, currentSearchQuery);
  } catch (err) {
    console.error(`Error loading page ${page}:`, err);
    showToast(`Error loading ${page} page`, 'error');
  }
}

async function loadPageData(page) {
  try {
    switch (page) {
      case 'dashboard': await loadDashboard(); break;
      case 'jfa-tracking': await loadJfaTracking(); break;
      case 'job-fair-report': await loadJobFairReport(); break;
      case 'monitoring': await loadMonitoring(); break;
      case 'summaries': break; // loaded on button click
      case 'agencies': await loadAgencies(); break;
      case 'venues': await loadVenues(); break;
      case 'users': await loadUsers(); break;
    }
  } catch (err) {
    console.error(`Error in loadPageData(${page}):`, err);
    // Show error but don't break the page
  }
}

// ============================================================================
// DB CONNECTION
// ============================================================================
async function checkDbConnection() {
  const statusEl = document.getElementById('dbStatus');
  if (!statusEl) return;

  try {
    const ok = await window.api.testConnection();
    if (ok) {
      statusEl.className = 'db-status connected';
      statusEl.innerHTML = '<i class="fas fa-circle"></i><span>DB Connected</span>';
    } else {
      throw new Error('Not connected');
    }
  } catch {
    statusEl.className = 'db-status disconnected';
    statusEl.innerHTML = '<i class="fas fa-circle"></i><span>DB Disconnected</span>';
  }
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (!toggleBtn) return;

  try {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  } catch {
    // Ignore localStorage access errors
  }

  updateSidebarToggleButton(toggleBtn);

  toggleBtn.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');

    try {
      localStorage.setItem('sidebarCollapsed', String(collapsed));
    } catch {
      // Ignore localStorage access errors
    }

    updateSidebarToggleButton(toggleBtn);
  });
}

function setupUserMenuHandlers() {
  const menuBtn = document.getElementById('sidebarUserMenuBtn');
  const menu = document.getElementById('sidebarUserMenu');
  const accountBtn = document.getElementById('userAccountInfoBtn');
  const passwordBtn = document.getElementById('userChangePasswordBtn');

  if (!menuBtn || !menu) return;

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.style.display === 'grid';
    menu.style.display = isOpen ? 'none' : 'grid';
  });

  if (accountBtn) {
    accountBtn.addEventListener('click', () => {
      menu.style.display = 'none';
      openAccountInfoModal();
    });
  }

  if (passwordBtn) {
    passwordBtn.addEventListener('click', () => {
      menu.style.display = 'none';
      openChangePasswordModal();
    });
  }

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
}

function setupGlobalSearch() {
  const searchInput = document.getElementById('globalPageSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value || '';
    applyPageSearch(currentPage, currentSearchQuery);
  });
}

function updateGlobalSearchVisibility(page) {
  const searchWrap = document.getElementById('globalSearchWrap');
  if (!searchWrap) return;

  searchWrap.style.display = page === 'dashboard' ? 'none' : 'inline-flex';
}

function applyPageSearch(page, query) {
  const pageEl = document.getElementById(`page-${page}`);
  if (!pageEl) return;

  if (page === 'dashboard') {
    pageEl.querySelectorAll('tbody tr, .simple-list li, .stat-card').forEach((el) => {
      el.style.display = '';
    });
    return;
  }

  const term = String(query || '').trim().toLowerCase();
  const hasTerm = term.length > 0;

  // Filter data rows in all tables on the active page.
  pageEl.querySelectorAll('tbody tr').forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = !hasTerm || text.includes(term) ? '' : 'none';
  });

  // Filter list items used by dashboard summaries.
  pageEl.querySelectorAll('.simple-list li').forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = !hasTerm || text.includes(term) ? '' : 'none';
  });

  // Filter dashboard stat cards as part of page-wide search.
  pageEl.querySelectorAll('.stat-card').forEach((card) => {
    const text = card.textContent.toLowerCase();
    card.style.display = !hasTerm || text.includes(term) ? '' : 'none';
  });
}

async function setupNetworkStatus() {
  try {
    const config = await window.api.getNetworkConfig();
    const indicator = document.getElementById('networkStatusIndicator');
    const dot = document.querySelector('.network-status-dot');
    const label = document.getElementById('networkStatusLabel');

    if (!indicator || !dot || !label) return;

    if (config.role === 'server') {
      dot.className = 'network-status-dot server';
      label.textContent = `Server (${config.localIp})`;
      indicator.title = `Server PC - API running at ${config.localIp}:${config.apiPort}`;

      // Show the dashboard IP banner
      const banner = document.getElementById('serverIpBanner');
      const addrEl = document.getElementById('serverIpBannerAddress');
      const copyBtn = document.getElementById('serverIpCopyBtn');
      if (banner && addrEl) {
        addrEl.textContent = `${config.localIp}:${config.apiPort}`;
        banner.style.display = 'flex';
      }
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const text = `${config.localIp}:${config.apiPort}`;
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
          }).catch(() => {
            showToast('Could not copy to clipboard', 'error');
          });
        });
      }
    } else if (config.role === 'client') {
      dot.className = 'network-status-dot client';
      label.textContent = `Client (${config.serverIp})`;
      indicator.title = `Connected to server at ${config.serverIp}:${config.apiPort}`;
    } else {
      dot.className = 'network-status-dot offline';
      label.textContent = 'Unconfigured';
    }
  } catch (err) {
    console.error('Failed to update network status:', err);
  }
}

function openAccountInfoModal() {
  if (!sessionToken || !currentUser) {
    showToast('Please login first', 'error');
    return;
  }

  const html = `
    <div class="form-row">
      <div class="form-group">
        <label>Full Name</label>
        <input class="form-input" id="accFullName" value="${currentUser.full_name || ''}">
      </div>
      <div class="form-group">
        <label>Username</label>
        <input class="form-input" id="accUsername" value="${currentUser.username || ''}">
      </div>
    </div>
    <div class="form-group">
      <label>Email</label>
      <input class="form-input" id="accEmail" type="email" value="${currentUser.email || ''}" placeholder="name@example.com">
    </div>
    <div class="form-group">
      <label>Role</label>
      <input class="form-input" value="${currentUser.role === 'admin' ? 'Administrator' : 'Staff'}" disabled>
    </div>
  `;

  openModal('Account Info', html, async () => {
    const fullName = getFormValue('accFullName');
    const username = getFormValue('accUsername');
    const email = getFormValue('accEmail');

    if (!fullName || !username || !email) {
      showToast('Full name, username, and email are required', 'error');
      return;
    }

    try {
      const updated = await window.api.updateOwnProfile({
        sessionToken,
        full_name: fullName,
        username,
        email,
      });

      currentUser = updated;
      updateCurrentUserUI();
      closeModal();
      showToast('Account info updated', 'success');
      if (currentPage === 'users' && currentUser.role === 'admin') {
        loadUsers();
      }
    } catch (err) {
      if (isMissingIpcHandlerError(err)) {
        showToast('App update detected. Please restart the application.', 'error');
        return;
      }
      showToast('Failed to update account: ' + err.message, 'error');
    }
  });
}

function openChangePasswordModal() {
  if (!sessionToken || !currentUser) {
    showToast('Please login first', 'error');
    return;
  }

  const html = `
    <div class="form-group">
      <label>Current Password</label>
      <input class="form-input" id="accCurrentPassword" type="password" autocomplete="current-password">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>New Password</label>
        <input class="form-input" id="accNewPassword" type="password" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label>Confirm New Password</label>
        <input class="form-input" id="accConfirmPassword" type="password" autocomplete="new-password">
      </div>
    </div>
  `;

  openModal('Change Password', html, async () => {
    const currentPassword = document.getElementById('accCurrentPassword')?.value || '';
    const newPassword = document.getElementById('accNewPassword')?.value || '';
    const confirmPassword = document.getElementById('accConfirmPassword')?.value || '';

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Please complete all password fields', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    try {
      await window.api.changeOwnPassword({
        sessionToken,
        currentPassword,
        newPassword,
      });
      closeModal();
      showToast('Password updated successfully', 'success');
    } catch (err) {
      if (isMissingIpcHandlerError(err)) {
        showToast('App update detected. Please restart the application.', 'error');
        return;
      }
      showToast('Failed to change password: ' + err.message, 'error');
    }
  });
}

function updateSidebarToggleButton(toggleBtn) {
  const collapsed = document.body.classList.contains('sidebar-collapsed');
  toggleBtn.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
  toggleBtn.setAttribute('title', collapsed ? 'Show sidebar' : 'Hide sidebar');
  toggleBtn.innerHTML = collapsed
    ? '<i class="fas fa-bars"></i>'
    : '<i class="fas fa-bars"></i>';
}

// ============================================================================
// TOAST
// ============================================================================
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn('Toast element not found');
    return;
  }
  toast.className = `toast ${type}`;
  document.getElementById('toastMsg').textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { 
    if (toast) toast.style.display = 'none'; 
  }, 3000);
}

function isMissingIpcHandlerError(err) {
  const message = String(err?.message || '');
  return message.includes('No handler registered for');
}

// ============================================================================
// MODAL
// ============================================================================
let modalSaveCallback = null;

function setupModalHandlers() {
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  const modalSave = document.getElementById('modalSave');
  const modal = document.getElementById('modal');
  
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (modalSave) modalSave.addEventListener('click', () => {
    if (modalSaveCallback) modalSaveCallback();
  });
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
}

function openModal(title, bodyHtml, onSave, modalSizeClass = '', hideCancel = false) {
  const modalContainer = document.querySelector('#modal .modal-container');

  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  modalSaveCallback = onSave || null;

  if (modalContainer) {
    modalContainer.className = 'modal-container';
    if (modalSizeClass) {
      modalContainer.classList.add(modalSizeClass);
    }
  }

  const modalSave = document.getElementById('modalSave');
  const modalCancel = document.getElementById('modalCancel');
  if (modalSave) {
    modalSave.textContent = 'Save';
    modalSave.classList.remove('btn-danger');
    modalSave.classList.add('btn-primary');
    modalSave.style.display = onSave ? 'inline-flex' : 'none';
  }
  if (modalCancel) {
    modalCancel.style.display = hideCancel ? 'none' : 'inline-flex';
  }
  document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
  const modalContainer = document.querySelector('#modal .modal-container');
  document.getElementById('modal').style.display = 'none';
  modalSaveCallback = null;

  if (modalContainer) {
    modalContainer.className = 'modal-container';
  }

  const modalSave = document.getElementById('modalSave');
  const modalCancel = document.getElementById('modalCancel');
  if (modalSave) {
    modalSave.textContent = 'Save';
    modalSave.classList.remove('btn-danger');
    modalSave.classList.add('btn-primary');
    modalSave.style.display = 'inline-flex';
  }
  if (modalCancel) {
    modalCancel.style.display = 'inline-flex';
  }
}

function getFormValue(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  return el.value.trim() || null;
}

function getFormInt(id) {
  const v = getFormValue(id);
  return v ? parseInt(v) : 0;
}

function setupResizableTableColumns(tableId, storageKey) {
  const table = document.getElementById(tableId);
  if (!table || table.dataset.resizeReady === 'true') return;

  const thead = table.querySelector('thead');
  if (!thead || !thead.rows.length) return;

  // Build a logical header grid that respects rowSpan/colSpan so each leaf column can be resized.
  const rows = Array.from(thead.rows);
  const grid = [];

  rows.forEach((row, rowIndex) => {
    if (!grid[rowIndex]) grid[rowIndex] = [];
    let col = 0;

    Array.from(row.cells).forEach((cell) => {
      while (grid[rowIndex][col]) col += 1;

      const colSpan = Number(cell.colSpan || 1);
      const rowSpan = Number(cell.rowSpan || 1);

      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        if (!grid[r]) grid[r] = [];
        for (let c = col; c < col + colSpan; c += 1) {
          grid[r][c] = cell;
        }
      }

      col += colSpan;
    });
  });

  const leafRow = grid[grid.length - 1] || [];
  const leafCount = leafRow.length;
  if (!leafCount) return;

  let colgroup = table.querySelector('colgroup[data-resizable="true"]');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    colgroup.dataset.resizable = 'true';
    for (let i = 0; i < leafCount; i += 1) {
      colgroup.appendChild(document.createElement('col'));
    }
    table.insertBefore(colgroup, table.firstChild);
  }

  const cols = Array.from(colgroup.querySelectorAll('col'));
  if (cols.length !== leafCount) {
    colgroup.innerHTML = '';
    for (let i = 0; i < leafCount; i += 1) {
      colgroup.appendChild(document.createElement('col'));
    }
  }

  const resolvedCols = Array.from(colgroup.querySelectorAll('col'));
  const minWidth = 28;
  const specialMinWidths = {};

  if (tableId === 'jfTable') {
    specialMinWidths[leafCount - 1] = 88;
    specialMinWidths[leafCount - 2] = 60;
  } else if (tableId === 'jfaTable' || tableId === 'monTable') {
    specialMinWidths[leafCount - 1] = 88;
  }

  const getMinWidthForColumn = (columnIndex) => {
    if (Number.isFinite(specialMinWidths[columnIndex])) {
      return specialMinWidths[columnIndex];
    }
    return minWidth;
  };

  const applyStoredWidths = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== leafCount) return false;

      parsed.forEach((value, index) => {
        const width = Number(value);
        if (!Number.isFinite(width) || width <= 0) return;
        resolvedCols[index].style.width = `${Math.max(getMinWidthForColumn(index), width)}px`;
      });

      return true;
    } catch {
      return false;
    }
  };

  const applyDefaultWidths = () => {
    if (tableId === 'jfaTable' && leafCount === 11) {
      const jfaDefaults = [56, 120, 220, 180, 300, 170, 150, 170, 150, 130, 88];
      jfaDefaults.forEach((width, index) => {
        resolvedCols[index].style.width = `${Math.max(getMinWidthForColumn(index), width)}px`;
      });
      return true;
    }

    return false;
  };

  const captureInitialWidths = () => {
    const hasStored = applyStoredWidths();
    if (hasStored) return;

    const hasDefaults = applyDefaultWidths();
    if (hasDefaults) return;

    const firstBodyRow = table.querySelector('tbody tr');
    const bodyCells = firstBodyRow ? Array.from(firstBodyRow.cells) : [];

    for (let i = 0; i < leafCount; i += 1) {
      const headerCell = leafRow[i];
      const width = bodyCells[i]?.getBoundingClientRect().width || headerCell?.getBoundingClientRect().width;
      if (width && Number.isFinite(width)) {
        resolvedCols[i].style.width = `${Math.max(getMinWidthForColumn(i), Math.round(width))}px`;
      }
    }
  };

  const persistWidths = () => {
    try {
      const widths = resolvedCols.map((col, index) => {
        const width = parseFloat(col.style.width) || col.getBoundingClientRect().width || minWidth;
        return Math.max(getMinWidthForColumn(index), width);
      });
      localStorage.setItem(storageKey, JSON.stringify(widths));

      if (tableId === 'jfaTable') {
        setupJfaTopScrollbar();
      }
    } catch {
      // Ignore storage failures.
    }
  };

  const buildLogicalGrid = (rowsForGrid) => {
    const logicalGrid = [];

    rowsForGrid.forEach((row, rowIndex) => {
      if (!logicalGrid[rowIndex]) logicalGrid[rowIndex] = [];
      let col = 0;

      Array.from(row.cells).forEach((cell) => {
        while (logicalGrid[rowIndex][col]) col += 1;

        const colSpan = Number(cell.colSpan || 1);
        const rowSpan = Number(cell.rowSpan || 1);

        for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
          if (!logicalGrid[r]) logicalGrid[r] = [];
          for (let c = col; c < col + colSpan; c += 1) {
            logicalGrid[r][c] = cell;
          }
        }

        col += colSpan;
      });
    });

    return logicalGrid;
  };

  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  const bodyGrid = buildLogicalGrid(bodyRows);

  const autoFitColumn = (columnIndex) => {
    const col = resolvedCols[columnIndex];
    if (!col) return;

    const uniqueCells = new Set();
    const headerCell = leafRow[columnIndex];
    if (headerCell) uniqueCells.add(headerCell);

    bodyGrid.forEach((row) => {
      const cell = row?.[columnIndex];
      if (cell) uniqueCells.add(cell);
    });

    let maxContentWidth = getMinWidthForColumn(columnIndex);
    uniqueCells.forEach((cell) => {
      const cs = window.getComputedStyle(cell);
      const horizontalPadding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const horizontalBorders = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      const contentWidth = Math.ceil(cell.scrollWidth + horizontalPadding + horizontalBorders + 4);
      if (contentWidth > maxContentWidth) {
        maxContentWidth = contentWidth;
      }
    });

    col.style.width = `${Math.max(getMinWidthForColumn(columnIndex), maxContentWidth)}px`;
    persistWidths();
  };

  captureInitialWidths();

  const handleByColumn = new Map();

  for (let i = 0; i < leafCount - 1; i += 1) {
    const headerCell = leafRow[i];
    if (!headerCell || handleByColumn.has(i)) continue;

    headerCell.style.position = 'relative';

    const handle = document.createElement('span');
    handle.className = 'col-resize-handle';
    handle.title = 'Drag to resize column';
    handle.dataset.columnIndex = String(i);
    headerCell.appendChild(handle);
    handleByColumn.set(i, handle);

    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();

      // Handle double-click before drag setup so auto-fit always wins.
      if (event.detail === 2) {
        autoFitColumn(i);
        return;
      }

      const currentCol = resolvedCols[i];
      const nextCol = resolvedCols[i + 1];
      if (!currentCol || !nextCol) return;

      const startX = event.clientX;
      const startCurrent = currentCol.getBoundingClientRect().width;
      const startNext = nextCol.getBoundingClientRect().width;

      document.body.classList.add('col-resizing');

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        let nextCurrent = startCurrent + dx;
        let nextNext = startNext - dx;

        const currentMin = getMinWidthForColumn(i);
        const nextMin = getMinWidthForColumn(i + 1);

        if (nextCurrent < currentMin) {
          nextCurrent = currentMin;
          nextNext = startCurrent + startNext - nextCurrent;
        }

        if (nextNext < nextMin) {
          nextNext = nextMin;
          nextCurrent = startCurrent + startNext - nextNext;
        }

        currentCol.style.width = `${Math.round(nextCurrent)}px`;
        nextCol.style.width = `${Math.round(nextNext)}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.classList.remove('col-resizing');
        persistWidths();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    handle.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      autoFitColumn(i);
    });
  }

  table.dataset.resizeReady = 'true';
}

function resetResizableTableColumns(tableId, storageKey) {
  const table = document.getElementById(tableId);
  if (!table) return;

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures.
  }

  table.querySelectorAll('.col-resize-handle').forEach((handle) => handle.remove());
  table.querySelectorAll('colgroup[data-resizable="true"]').forEach((group) => group.remove());
  delete table.dataset.resizeReady;

  setupResizableTableColumns(tableId, storageKey);
}

function generateFiscalYearOptions(selectedYear) {
  if (!availableFiscalYears || availableFiscalYears.length === 0) {
    return '<option value="">No fiscal years available</option>';
  }
  return availableFiscalYears
    .sort((a, b) => b - a)
    .map(year => `<option value="${year}" ${selectedYear === year ? 'selected' : ''}>${year}</option>`)
    .join('');
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
}

function formatJobFairDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '<span class="missing-data">No date</span>';
  if (startDate && !endDate) return formatDate(startDate);
  if (!startDate && endDate) return formatDate(endDate);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

function docBadge(isComplete) {
  return isComplete
    ? '<span class="badge badge-complete">Complete</span>'
    : '<span class="badge badge-incomplete">Incomplete</span>';
}

function checklistCell(value, editable = false, recordId = null, fieldName = '') {
  const checked = isCheckedValue(value) ? 'checked' : '';
  const disabled = editable ? '' : 'disabled';
  const dataAttrs = editable && recordId && fieldName
    ? `data-id="${recordId}" data-field="${fieldName}"`
    : '';

  return `
    <label class="table-checklist" aria-label="Checklist status">
      <input type="checkbox" class="mon-check-toggle" ${dataAttrs} ${disabled} ${checked}>
    </label>
  `;
}

function isCheckedValue(value) {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function getMonitoringDateValue(value) {
  return formatDateForInput(value) || null;
}

// ============================================================================
// PDF EXPORT FUNCTIONS
// ============================================================================

function createPdfHeader(title, scale = 1) {
  const logoSize        = Math.round(100 * scale);
  const rightLogoWidth  = Math.round(120 * scale);
  const centerWidth     = Math.round(680 * scale);
  const republicFontSize    = Math.round(13 * scale);
  const departmentFontSize  = Math.round(30 * scale);
  const officeFontSize      = Math.round(16 * scale);
  const addressFontSize     = Math.round(11 * scale);
  const titleFontSize       = Math.round(15 * scale);

  return `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px 10px; border-bottom:2px solid #1b3457; margin-bottom:10px;">
      <!-- Left Logo (DMW) -->
      <div style="flex:0 0 ${logoSize}px; display:flex; align-items:center; justify-content:center;">
        <img src="img/dmw_logo.png" style="width:${logoSize}px; height:${logoSize}px; object-fit:contain;" alt="DMW Logo">
      </div>

      <!-- Center Content -->
      <div style="flex:1; max-width:${centerWidth}px; text-align:center; padding:0 10px;">
        <p style="margin:0 0 2px 0; font-size:${republicFontSize}px; color:#1b3457; font-style:italic; font-weight:400;">Republic of the Philippines</p>
        <h1 style="margin:0 0 2px 0; font-size:${departmentFontSize}px; line-height:1.1; color:#1b3457; font-family:'Old English Text MT','UnifrakturCook','UnifrakturMaguntia','MedievalSharp',serif; font-weight:700;">Department of Migrant Workers</h1>
        <h2 style="margin:2px 0 3px 0; font-size:${officeFontSize}px; color:#1b3457; font-weight:700; letter-spacing:0.3px;">Regional Office - XIII (Caraga)</h2>
        <p style="margin:0 0 5px 0; font-size:${addressFontSize}px; color:#555;">3rd Floor Esquina Dos Building, J.C. Aquino Avenue corner Doongan Road, Butuan City, Agusan del Norte, 8600</p>
        <p style="margin:0; font-size:${titleFontSize}px; color:#1b3457; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${title}</p>
      </div>

      <!-- Right Logo (Bagong Pilipinas) -->
      <div style="flex:0 0 ${rightLogoWidth}px; display:flex; align-items:center; justify-content:center;">
        <img src="img/Bagong_Pilipinas_logo.png" style="width:${rightLogoWidth}px; height:${logoSize}px; object-fit:contain;" alt="Bagong Pilipinas Logo">
      </div>
    </div>
  `;
}

function normalizeExportHeader(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function applyMonitoringPdfLayout(table) {
  const headerRow = table.querySelector('thead tr');
  if (!headerRow) {
    return;
  }

  const workbookHeaderMap = {
    AGENCY: 'IMPLEMENTING AGENCY',
    'DATE(S)': 'JOB FAIR DATE/S',
    VENUE: 'JOB FAIR VENUE',
    'CELEBRATION/EVENT': 'CELEBRATION/EVENT',
    'JOB FAIR MONITORING': 'JOB FAIR MONITORING',
    'CONDUCT OF PEOS': 'CONDUCT OF PEOS',
    'COMM. LETTER': 'COMMUNICATION LETTER RECEIVED',
    INVITATION: 'EMAILED THE INVITATION LETTERS TO RECRUITMENT AGENCIES',
    DEADLINE: 'CONFIRMATION DEADLINE IN THE IMPLEMENTING AGENCY',
    TRANSMITTAL: 'EMAILED THE TRANSMITTAL LETTER WITH JOB ORDER SUMMARY',
    EVIDENCE: 'EVIDENCE',
    'MONITORED BY': 'MONITORED BY',
    REMARKS: 'REMARKS',
  };

  const headers = Array.from(headerRow.querySelectorAll('th'));
  headers.forEach((header) => {
    const key = normalizeExportHeader(header.textContent);
    if (workbookHeaderMap[key]) {
      header.textContent = workbookHeaderMap[key];
    }
  });

  const numberHeader = document.createElement('th');
  numberHeader.textContent = 'NO.';
  headerRow.insertBefore(numberHeader, headerRow.firstChild);

  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  let seq = 1;

  bodyRows.forEach((row) => {
    const isMessageRow = row.children.length === 1;
    const numberCell = document.createElement('td');

    if (isMessageRow) {
      numberCell.textContent = '-';
      row.insertBefore(numberCell, row.firstChild);
      return;
    }

    numberCell.textContent = String(seq++);
    row.insertBefore(numberCell, row.firstChild);
  });
}

async function exportTableToPdf(tableSelector, filename) {
  try {
    const element = document.querySelector(tableSelector);
    if (!element) { showToast('Table not found', 'error'); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) { showToast('PDF library not loaded', 'error'); return; }

    const { jsPDF } = window.jspdf;

    const isJfaExport        = tableSelector === '#jfaTable';
    const isJobFairExport     = tableSelector === '#jfTable';
    const isMonitoringExport  = tableSelector === '#monTable';
    const isJfaSummaryExport  = filename === 'JFA_Summary.pdf';
    const isJobFairSummaryExport = filename === 'Job_Fair_Summary.pdf';
    const isLargeHeaderExport = filename === 'Job_Fair_Reports.pdf';
    const isJfaTrackingExport = filename === 'JFA_Tracking.pdf';

    // ── Page format ──────────────────────────────────────────────────────────
    // Wide tables (JFA, Job Fair, Monitoring) use A3 landscape for more columns.
    // Summary tables use A4 landscape. All use landscape orientation.
    let pageFormat = 'a4';
    if (isJfaExport)       pageFormat = 'a3';
    if (isJobFairExport)   pageFormat = 'a2';

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: pageFormat, compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 8;
    const contentW = pageW - margin * 2;

    // ── Title & "FOR THE MONTH OF …" subtitle ────────────────────────────────
    // Each export reads its own year/month filter fields so the header always
    // reflects exactly what the user has filtered — or omits the subtitle when
    // no specific month is selected.
    let title = filename.replace(/_/g, ' ').replace('.pdf', '').toUpperCase();
    let monitoringMonthSubtitle = '';   // "FOR THE MONTH OF <MONTH>" — all exports

    function buildMonthSubtitle(monthFieldId) {
      const raw = getFormValue(monthFieldId) || '';
      if (!raw || raw === '' || raw === '0') return '';
      const monthName = MONTHS[parseInt(raw, 10)] || '';
      return monthName ? `FOR THE MONTH OF ${monthName.toUpperCase()}` : '';
    }

    if (isMonitoringExport) {
      const selectedYear = getFormValue('monFilterYear') || new Date().getFullYear();
      title = `${selectedYear} JOB FAIR MONITORING`;
      monitoringMonthSubtitle = buildMonthSubtitle('monFilterMonth');

    } else if (isJfaTrackingExport) {
      const selectedYear = getFormValue('jfaFilterYear') || new Date().getFullYear();
      title = `${selectedYear} JFA TRACKING`;
      monitoringMonthSubtitle = buildMonthSubtitle('jfaFilterMonth');

    } else if (isLargeHeaderExport) {   // Job Fair Reports
      const selectedYear = getFormValue('jfFilterYear') || new Date().getFullYear();
      title = `${selectedYear} JOB FAIR REPORTS`;
      monitoringMonthSubtitle = buildMonthSubtitle('jfFilterMonth');

    } else if (isJfaSummaryExport) {
      const selectedYear = getFormInt('sumYear') || new Date().getFullYear();
      title = `${selectedYear} JFA SUMMARY`;
      // Summary has no month filter — subtitle intentionally left blank

    } else if (isJobFairSummaryExport) {
      const selectedYear = getFormInt('sumYear') || new Date().getFullYear();
      title = `${selectedYear} JOB FAIR SUMMARY`;
      // Summary has no month filter — subtitle intentionally left blank
    }

    // ── Draw letterhead on every page ───────────────────────────────────────
    // If a month subtitle is present the header needs 5 mm extra to fit it.
    const headerH = monitoringMonthSubtitle ? 36 : 30; // mm — must be >= logo height (22mm) + text rows

    function drawHeader(doc, pageNum, totalPages) {
      const y0 = margin;

      // ── Logo sizing & vertical centering ──────────────────────────────────
      const logoSize = 22;          // mm — DMW logo (square)
      const logoY    = y0 + (headerH - logoSize) / 2;

      // Left logo (DMW seal)
      try {
        const leftImg = document.querySelector('img[alt="DMW Logo"]') ||
                        document.querySelector('img[src*="dmw_logo"]');
        if (leftImg && leftImg.complete) {
          const canvas = document.createElement('canvas');
          canvas.width  = leftImg.naturalWidth  || 80;
          canvas.height = leftImg.naturalHeight || 80;
          canvas.getContext('2d').drawImage(leftImg, 0, 0);
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, logoY, logoSize, logoSize);
        }
      } catch(_) {}

      // Right logo (Bagong Pilipinas) — preserve aspect ratio
      try {
        const rightImg = document.querySelector('img[alt="Bagong Pilipinas Logo"]') ||
                         document.querySelector('img[src*="Bagong_Pilipinas"]');
        if (rightImg && rightImg.complete) {
          const canvas = document.createElement('canvas');
          canvas.width  = rightImg.naturalWidth  || 110;
          canvas.height = rightImg.naturalHeight || 80;
          canvas.getContext('2d').drawImage(rightImg, 0, 0);
          const aspect = (rightImg.naturalWidth || 110) / (rightImg.naturalHeight || 80);
          const rW = logoSize * aspect;
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', pageW - margin - rW, logoY, rW, logoSize);
        }
      } catch(_) {}

      // ── Center text block ─────────────────────────────────────────────────
      const cx = pageW / 2;

      // "Republic of the Philippines" — italic, dark navy
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(27, 52, 87);
      doc.text('Republic of the Philippines', cx, y0 + 5, { align: 'center' });

      // "Department of Migrant Workers" — bold, large, dark navy
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(27, 52, 87);
      doc.text('Department of Migrant Workers', cx, y0 + 11.5, { align: 'center' });

      // "Regional Office - XIII (Caraga)" — bold, medium, dark navy
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(27, 52, 87);
      doc.text('Regional Office - XIII (Caraga)', cx, y0 + 17, { align: 'center' });

      // Address — normal, small, medium gray
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(85, 85, 85);
      doc.text(
        '3rd Floor Esquina Dos Building, J.C. Aquino Avenue corner Doongan Road, Butuan City, Agusan del Norte, 8600',
        cx, y0 + 21.5, { align: 'center' }
      );

      // ── Document title — bold, dark navy, same color as header text ───────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(27, 52, 87);
      doc.text(title, cx, y0 + 26, { align: 'center' });

      // Month subtitle (monitoring only, when a specific month is filtered)
      if (monitoringMonthSubtitle) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(27, 52, 87);
        doc.text(monitoringMonthSubtitle, cx, y0 + 31, { align: 'center' });
      }

      // ── Separator line (thick, dark navy — matches the reference image) ───
      const sepY = monitoringMonthSubtitle ? y0 + 33.5 : y0 + 28.5;
      doc.setDrawColor(27, 52, 87);
      doc.setLineWidth(0.6);
      doc.line(margin, sepY, pageW - margin, sepY);

      // ── Footer ────────────────────────────────────────────────────────────
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 7, pageW - margin, pageH - 7);

      // Footer center note
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text('This document was automatically generated by the Job Fair Monitoring System', cx, pageH - 3.5, { align: 'center' });

      // Page number (bottom right)
      doc.setFontSize(7);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
    }

    // ── Clone & clean table ──────────────────────────────────────────────────
    const clonedTable = element.cloneNode(true);

    // Convert evidence buttons to plain text
    if (isMonitoringExport) {
      clonedTable.querySelectorAll('.mon-evidence-link, .mon-evidence-download-all').forEach((btn) => {
        const text = btn.textContent.trim() || btn.getAttribute('title') || '-';
        const span = document.createElement('span');
        span.textContent = text;
        btn.replaceWith(span);
      });
      applyMonitoringPdfLayout(clonedTable);
    }

    // Remove buttons and action cells
    clonedTable.querySelectorAll('button').forEach(btn => btn.remove());
    clonedTable.querySelectorAll('.actions-cell').forEach(cell => cell.remove());

    // Remove Actions header
    clonedTable.querySelectorAll('thead th').forEach(th => {
      if (th.textContent.trim().toUpperCase() === 'ACTIONS') th.remove();
    });

    // ── Extract head rows & body rows ────────────────────────────────────────
    function cellText(cell) {
      // Collapse whitespace; strip HTML
      return cell.textContent.replace(/\s+/g, ' ').trim();
    }

    // Build head array (supports multi-row headers)
    const headRows = [];
    clonedTable.querySelectorAll('thead tr').forEach(tr => {
      headRows.push(Array.from(tr.querySelectorAll('th')).map(th => ({
        content: cellText(th),
        colSpan: parseInt(th.getAttribute('colspan') || '1'),
        rowSpan: parseInt(th.getAttribute('rowspan') || '1'),
        styles: { halign: 'center', fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' }
      })));
    });

    // Build body rows
    const bodyRows = [];
    clonedTable.querySelectorAll('tbody tr').forEach((tr, rowIdx) => {
      const isSubtotal   = tr.classList.contains('jf-subtotal-row') || tr.classList.contains('summary-subtotal-row');
      const isGrandTotal = tr.classList.contains('jf-grand-total-row');
      const rowCells     = Array.from(tr.querySelectorAll('td, th'));

      const cells = rowCells.map((cell, ci) => {
        const text    = cellText(cell);
        const isNum   = /^\d+$/.test(text) || text === '-';
        const colSpan = parseInt(cell.getAttribute('colspan') || '1');
        const rowSpan = parseInt(cell.getAttribute('rowspan') || '1');

        const cellDef = {
          content: text,
          colSpan,
          rowSpan,
          styles: { halign: isNum ? 'center' : 'left', overflow: 'linebreak' }
        };

        if (isGrandTotal) {
          cellDef.styles.fillColor = [219, 234, 254];
          cellDef.styles.fontStyle = 'bold';
        } else if (isSubtotal) {
          cellDef.styles.fillColor = [255, 250, 205];
          cellDef.styles.fontStyle = 'bold';
        } else if (rowIdx % 2 === 0) {
          cellDef.styles.fillColor = [255, 255, 255];
        } else {
          cellDef.styles.fillColor = [236, 240, 241];
        }

        return cellDef;
      });

      bodyRows.push(cells);
    });

    // ── Font size & column widths ────────────────────────────────────────────
    let bodyFontSize = 7.5;
    let headFontSize = 7;
    if (isJfaExport)       { bodyFontSize = 8;   headFontSize = 7.5; }
    if (isJobFairExport)   { bodyFontSize = 7;   headFontSize = 6.5; }
    if (isMonitoringExport){ bodyFontSize = 6.5; headFontSize = 6;   }

    // All percentage arrays MUST sum to exactly 100 so the table fills
    // contentW with no blank space on the right side of the page.
    let columnStyles = {};

    if (isJfaExport) {
      // 10 cols: No. | JFA No. | Agency | Date | Venue | Affidavit | Job Orders | Rep ID | Terminal | Remarks
      const jfaPcts = [3, 9, 16, 9, 17, 9, 9, 9, 9, 10];   // Σ = 100
      jfaPcts.forEach((p, i) => { columnStyles[i] = { cellWidth: contentW * p / 100 }; });

    } else if (isJobFairExport) {
      // 15 cols: Agency | Date | Venue | Rec.Agencies | #JFs | M | F | T | M | F | T | Land | Sea | Total | JFANo
      const jfPcts = [14, 6, 11, 11, 6, 4, 4, 4, 4, 4, 4, 6, 6, 4, 12];   // Σ = 100
      jfPcts.forEach((p, i) => { columnStyles[i] = { cellWidth: contentW * p / 100 }; });

    } else if (isMonitoringExport) {
      // 14 cols: NO. | Agency | Date | Venue | Celebration | JF Mon. | PEOS | Comm.Letter | Invitation | Deadline | Transmittal | Evidence | Monitored By | Remarks
      const monPcts = [3, 9, 7, 11, 7, 6, 6, 7, 7, 7, 7, 7, 8, 8];   // Σ = 100
      monPcts.forEach((p, i) => { columnStyles[i] = { cellWidth: contentW * p / 100 }; });

    } else if (isJfaSummaryExport) {
      // 6 cols: Month | JFA Issued | Completed | Cancelled | Not Participated | Active
      const jfaSumPcts = [20, 16, 16, 16, 16, 16];   // Σ = 100
      jfaSumPcts.forEach((p, i) => { columnStyles[i] = { cellWidth: contentW * p / 100 }; });

    } else if (isJobFairSummaryExport) {
      // 8 cols: Month | No. of Job Fairs | Male | Female | Total Applicants | Land-Based | Sea-Based | Total Agencies
      const jfSumPcts = [14, 14, 12, 12, 12, 12, 12, 12];   // Σ = 100
      jfSumPcts.forEach((p, i) => { columnStyles[i] = { cellWidth: contentW * p / 100 }; });

    } else {
      // Agencies, Venues, and any other single-section exports:
      // 'wrap' tells jsPDF-AutoTable to distribute all columns evenly across contentW
      columnStyles['*'] = { cellWidth: 'wrap' };
    }

    // ── Run autoTable ────────────────────────────────────────────────────────
    doc.autoTable({
      head:         headRows,
      body:         bodyRows,
      startY:       margin + headerH,       // start below letterhead
      margin:       { top: margin + headerH, bottom: 12, left: margin, right: margin },
      tableWidth:   'fixed',   // forces table to fill exactly contentW — no right-side blank space
      styles: {
        fontSize:    bodyFontSize,
        cellPadding: 1.5,
        overflow:    'linebreak',
        lineColor:   [187, 187, 187],
        lineWidth:   0.2,
        valign:      'middle',
      },
      headStyles: {
        fontSize:    headFontSize,
        fillColor:   [52, 73, 94],
        textColor:   255,
        fontStyle:   'bold',
        halign:      'center',
        cellPadding: 2,
        valign:      'middle',
      },
      columnStyles,
      // Repeat header on every new page
      showHead:    'everyPage',
      // Draw the letterhead on every page (including continuation pages)
      didDrawPage: (data) => {
        drawHeader(doc, data.pageNumber, '{TOTAL}');
      },
    });

    // ── Signature block (monitoring export — last page only) ────────────────
    if (isMonitoringExport) {
      const totalPagesBeforeSig = doc.internal.getNumberOfPages();
      doc.setPage(totalPagesBeforeSig);

      const tableEndY  = doc.lastAutoTable.finalY;
      const sigH       = 38;   // height of the entire signature block in mm
      const footerZone = 12;   // mm reserved for footer at bottom of page
      const availableY = pageH - footerZone - sigH;

      // If table ends too close to the footer, start the sig block on a fresh page
      let sigY = tableEndY + 8;
      if (sigY > availableY) {
        doc.addPage();
        drawHeader(doc, doc.internal.getNumberOfPages(), '{TOTAL}');
        sigY = margin + 28 + 8;   // below letterhead on the new page
      }

      const leftX   = margin;
      const rightX  = pageW / 2 + 4;   // right column starts at centre + small gap
      const colW    = pageW / 2 - margin - 4;

      // ── Labels row ─────────────────────────────────────────────────────────
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text('Prepared by:', leftX, sigY);
      doc.text('Reviewed By:', rightX, sigY);

      // ── Name lines (bold, ~14mm below label) ──────────────────────────────
      const nameY = sigY + 14;

      // Set font/size BEFORE measuring so getTextWidth() returns the correct value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      const leftName  = 'AURORA JEAN A. TORRALBA';
      const rightName = 'REGIENALD S. ESPALDON, CPA';
      doc.text(leftName,  leftX,  nameY);
      doc.text(rightName, rightX, nameY);

      // Measure AFTER setting the same font/size — width is now accurate
      const leftNameW  = doc.getTextWidth(leftName);
      const rightNameW = doc.getTextWidth(rightName);

      // Draw underline 1 mm below the text baseline (sits flush under the letters)
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(leftX,  nameY + 1, leftX  + leftNameW,  nameY + 1);
      doc.line(rightX, nameY + 1, rightX + rightNameW, nameY + 1);

      // ── Titles (italic, just below names) ────────────────────────────────
      const titleY = nameY + 5.5;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text('Labor and Employment Officer I',              leftX,  titleY);
      doc.text('OIC-Assistant Regional Director',             rightX, titleY);
      doc.text('and OIC- Chief Labor and Employment Officer', rightX, titleY + 4.5);
    }

    // ── Replace placeholder page-count ──────────────────────────────────────
    // autoTable fires didDrawPage as pages are created; we don't know total until done.
    // Patch all pages afterwards.
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      // White out the placeholder and redraw the correct count
      doc.setFillColor(255, 255, 255);
      doc.rect(pageW - margin - 28, pageH - 8, 30, 5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 4, { align: 'right' });
    }

    doc.save(filename || 'export.pdf');
    showToast(`✅ Exported to ${filename}`, 'success');

  } catch (err) {
    console.error('PDF export error:', err);
    showToast('Error exporting PDF: ' + err.message, 'error');
  }
}

// ============================================================================
// SETUP PAGE HANDLERS
// ============================================================================
function setupPageHandlers() {
  // JFA
  const jfaFilterBtn = document.getElementById('jfaFilterBtn');
  const jfaAddBtn = document.getElementById('jfaAddBtn');
  const jfaResetColWidthsBtn = document.getElementById('jfaResetColWidthsBtn');
  if (jfaFilterBtn) jfaFilterBtn.addEventListener('click', loadJfaTracking);
  if (jfaAddBtn) jfaAddBtn.addEventListener('click', () => openJfaForm());
  if (jfaResetColWidthsBtn) {
    jfaResetColWidthsBtn.addEventListener('click', () => {
      resetResizableTableColumns('jfaTable', 'jfaTableColumnWidths');
      showToast('JFA Tracking column sizes reset to default', 'success');
      setupJfaTopScrollbar();
    });
  }
  
  // Job Fair
  const jfFilterBtn = document.getElementById('jfFilterBtn');
  const jfAddBtn = document.getElementById('jfAddBtn');
  const jfResetColWidthsBtn = document.getElementById('jfResetColWidthsBtn');
  if (jfFilterBtn) jfFilterBtn.addEventListener('click', loadJobFairReport);
  if (jfAddBtn) jfAddBtn.addEventListener('click', () => openJobFairForm());
  if (jfResetColWidthsBtn) {
    jfResetColWidthsBtn.addEventListener('click', () => {
      resetResizableTableColumns('jfTable', 'jfTableColumnWidths');
      showToast('Job Fair column sizes reset to default', 'success');
    });
  }
  
  // Monitoring
  const monFilterBtn = document.getElementById('monFilterBtn');
  const monAddBtn = document.getElementById('monAddBtn');
  const monResetColWidthsBtn = document.getElementById('monResetColWidthsBtn');
  if (monFilterBtn) monFilterBtn.addEventListener('click', loadMonitoring);
  if (monAddBtn) monAddBtn.addEventListener('click', () => openMonitoringForm());
  if (monResetColWidthsBtn) {
    monResetColWidthsBtn.addEventListener('click', () => {
      resetResizableTableColumns('monTable', 'monTableColumnWidths');
      showToast('Monitoring column sizes reset to default', 'success');
    });
  }
  
  // Summaries
  const sumLoadBtn = document.getElementById('sumLoadBtn');
  if (sumLoadBtn) sumLoadBtn.addEventListener('click', loadSummaries);
  
  // Agencies
  const agencyAddBtn = document.getElementById('agencyAddBtn');
  if (agencyAddBtn) agencyAddBtn.addEventListener('click', () => openAgencyForm());
  
  // Venues
  const venueAddBtn = document.getElementById('venueAddBtn');
  if (venueAddBtn) venueAddBtn.addEventListener('click', () => openVenueForm());

  // Users
  const userAddBtn = document.getElementById('userAddBtn');
  if (userAddBtn) {
    userAddBtn.addEventListener('click', () => {
      if (currentUser?.role !== 'admin') {
        showToast('Only admins can add users', 'error');
        return;
      }

      showAuthScreen('signup', 'admin-create');
      setAuthMessage('');
      const signupRole = document.getElementById('signupRole');
      if (signupRole) signupRole.value = 'staff';
    });
  }

  // Export PDF buttons
  setupExportButtons();

  // Topbar clock + notifications
  setupTopbarMeta();

  // Calendar selectors
  const dashCalendarYear = document.getElementById('dashCalendarYear');
  const dashCalendarMonth = document.getElementById('dashCalendarMonth');
  if (dashCalendarYear) {
    dashCalendarYear.addEventListener('change', renderDashboardCalendar);
  }
  if (dashCalendarMonth) {
    dashCalendarMonth.addEventListener('change', renderDashboardCalendar);
  }

  setupResizableTableColumns('jfTable', 'jfTableColumnWidths');
  setupResizableTableColumns('jfaTable', 'jfaTableColumnWidths');
  setupResizableTableColumns('monTable', 'monTableColumnWidths');
  setupJfTopScrollbar();
  setupJfaTopScrollbar();
}

function setupJfaTopScrollbar() {
  const topScroll = document.getElementById('jfaTopScroll');
  const topScrollInner = document.getElementById('jfaTopScrollInner');
  const tableContainer = document.getElementById('jfaTableScrollContainer');
  const table = document.getElementById('jfaTable');

  if (!topScroll || !topScrollInner || !tableContainer || !table) return;

  const syncState = { isSyncing: false };

  const refresh = () => {
    const tableElement = tableContainer.querySelector('table') || table;
    const tableWidth = Math.ceil(Math.max(tableElement.scrollWidth, tableElement.getBoundingClientRect().width));
    const containerWidth = tableContainer.clientWidth;

    topScrollInner.style.width = `${tableWidth}px`;
    const hasHorizontalOverflow = tableWidth > containerWidth + 1;
    topScroll.style.display = hasHorizontalOverflow ? 'block' : 'none';
    topScroll.scrollLeft = tableContainer.scrollLeft;
  };

  if (topScroll.dataset.bound !== 'true') {
    topScroll.addEventListener('scroll', () => {
      if (syncState.isSyncing) return;
      syncState.isSyncing = true;
      tableContainer.scrollLeft = topScroll.scrollLeft;
      syncState.isSyncing = false;
    });

    tableContainer.addEventListener('scroll', () => {
      if (syncState.isSyncing) return;
      syncState.isSyncing = true;
      topScroll.scrollLeft = tableContainer.scrollLeft;
      syncState.isSyncing = false;
    });

    window.addEventListener('resize', refresh);
    topScroll.dataset.bound = 'true';
  }

  if (typeof ResizeObserver !== 'undefined') {
    if (jfaTopScrollResizeObserver) {
      jfaTopScrollResizeObserver.disconnect();
    }

    jfaTopScrollResizeObserver = new ResizeObserver(refresh);
    jfaTopScrollResizeObserver.observe(tableContainer);
    jfaTopScrollResizeObserver.observe(table);
  }

  refresh();
  requestAnimationFrame(refresh);
  setTimeout(refresh, 0);
}

function setupJfTopScrollbar() {
  const topScroll = document.getElementById('jfTopScroll');
  const topScrollInner = document.getElementById('jfTopScrollInner');
  const tableContainer = document.getElementById('jfTableScrollContainer');
  const table = document.getElementById('jfTable');

  if (!topScroll || !topScrollInner || !tableContainer || !table) return;

  const syncState = { isSyncing: false };

  const refresh = () => {
    const tableElement = tableContainer.querySelector('table') || table;
    const tableWidth = Math.ceil(Math.max(tableElement.scrollWidth, tableElement.getBoundingClientRect().width));
    const containerWidth = tableContainer.clientWidth;

    topScrollInner.style.width = `${tableWidth}px`;
    const hasHorizontalOverflow = tableWidth > containerWidth + 1;
    topScroll.style.display = hasHorizontalOverflow ? 'block' : 'none';
    topScroll.scrollLeft = tableContainer.scrollLeft;
  };

  if (topScroll.dataset.bound !== 'true') {
    topScroll.addEventListener('scroll', () => {
      if (syncState.isSyncing) return;
      syncState.isSyncing = true;
      tableContainer.scrollLeft = topScroll.scrollLeft;
      syncState.isSyncing = false;
    });

    tableContainer.addEventListener('scroll', () => {
      if (syncState.isSyncing) return;
      syncState.isSyncing = true;
      topScroll.scrollLeft = tableContainer.scrollLeft;
      syncState.isSyncing = false;
    });

    window.addEventListener('resize', refresh);
    topScroll.dataset.bound = 'true';
  }

  if (typeof ResizeObserver !== 'undefined') {
    if (jfTopScrollResizeObserver) {
      jfTopScrollResizeObserver.disconnect();
    }

    jfTopScrollResizeObserver = new ResizeObserver(refresh);
    jfTopScrollResizeObserver.observe(tableContainer);
    jfTopScrollResizeObserver.observe(table);
  }

  refresh();
  requestAnimationFrame(refresh);
  setTimeout(refresh, 0);
}

function setupTopbarMeta() {
  const notifBtn = document.getElementById('topbarNotifBtn');
  const notifPanel = document.getElementById('topbarNotifPanel');
  const notifList = document.getElementById('topbarNotifList');

  loadSeenTopbarNotifications();
  startTopbarClock();
  refreshTopbarNotifications();

  if (!notifBtn || !notifPanel || notifBtn.dataset.bound === 'true') {
    return;
  }

  notifBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isVisible = notifPanel.style.display === 'block';
    notifPanel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      await refreshTopbarNotifications();
      markTopbarNotificationsAsSeen();
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!notifPanel.contains(target) && !notifBtn.contains(target)) {
      notifPanel.style.display = 'none';
    }
  });

  if (notifList && notifList.dataset.bound !== 'true') {
    notifList.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const notifItem = target.closest('li[data-notif-id]');
      if (!notifItem || !notifList.contains(notifItem)) return;

      const notifId = String(notifItem.dataset.notifId || '').trim();
      if (!notifId) return;

      const selected = topbarUpcomingNotifications.find((item) => item.id === notifId);
      if (!selected?.activityType || !selected?.activityId) return;

      notifPanel.style.display = 'none';
      seenTopbarNotificationIds.add(notifId);
      persistSeenTopbarNotifications();

      await openCalendarActivityRecord(
        selected.activityType,
        Number(selected.activityId),
        Number(selected.year),
        Number(selected.month)
      );

      renderTopbarNotifications(topbarUpcomingNotifications);
    });

    notifList.dataset.bound = 'true';
  }

  notifBtn.dataset.bound = 'true';
}

function startTopbarClock() {
  updateTopbarDateTime();

  if (topbarClockIntervalId) {
    clearInterval(topbarClockIntervalId);
  }

  topbarClockIntervalId = setInterval(updateTopbarDateTime, 30000);
}

function updateTopbarDateTime() {
  const dateEl = document.getElementById('topbarDateTime');
  if (!dateEl) return;

  const now = new Date();
  dateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderTopbarNotifications(items) {
  const notifList = document.getElementById('topbarNotifList');
  const notifCount = document.getElementById('topbarNotifCount');
  if (!notifList || !notifCount) return;

  topbarUpcomingNotifications = items;

  if (!items.length) {
    notifList.innerHTML = '<li><span class="topbar-notif-title">No new notifications</span><span class="topbar-notif-meta">Everything is up to date.</span></li>';
    notifCount.style.display = 'none';
    notifCount.textContent = '0';
    return;
  }

  notifList.innerHTML = items.map((item) => `
    <li data-notif-id="${item.id}" class="topbar-notif-item" role="button" tabindex="0" title="Open activity">
      <span class="topbar-notif-title">${item.title}</span>
      <span class="topbar-notif-meta">${item.meta}</span>
    </li>
  `).join('');

  const unseenCount = items.filter(item => !seenTopbarNotificationIds.has(item.id)).length;
  notifCount.textContent = String(unseenCount);
  notifCount.style.display = unseenCount > 0 ? 'inline-block' : 'none';
}

function markTopbarNotificationsAsSeen() {
  const notifCount = document.getElementById('topbarNotifCount');
  topbarUpcomingNotifications.forEach(item => seenTopbarNotificationIds.add(item.id));
  persistSeenTopbarNotifications();
  if (notifCount) {
    notifCount.style.display = 'none';
    notifCount.textContent = '0';
  }
}

function getLocalDayStart(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysUntilActivity(startDateValue, referenceDate = new Date()) {
  const startDay = getLocalDayStart(startDateValue);
  const refDay = getLocalDayStart(referenceDate);
  if (!startDay || !refDay) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((startDay.getTime() - refDay.getTime()) / dayMs);
}

function getActivityLeadLabel(daysUntil) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

async function refreshTopbarNotifications() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const targetYears = [currentYear, currentYear + 1];

    const [eventsByYear, jfaByYear, monitoringByYear] = await Promise.all([
      Promise.all(targetYears.map((year) => window.api.getJobFairEvents({ fiscal_year: year }))),
      Promise.all(targetYears.map((year) => window.api.getJfaRecords({ fiscal_year: year }))),
      Promise.all(targetYears.map((year) => window.api.getMonitoringRecords({ fiscal_year: year }))),
    ]);

    const events = eventsByYear.flat();
    const jfaRecords = jfaByYear.flat();
    const monitoringRecords = monitoringByYear.flat();

    const upcoming = [];

    const pushUpcoming = (item) => {
      const daysUntil = getDaysUntilActivity(item.startDate, now);
      if (daysUntil === null || daysUntil < 0 || daysUntil > 7) return;

      upcoming.push({
        ...item,
        daysUntil,
      });
    };

    events.forEach((event) => {
      if (!event.job_fair_date_start) return;
      const notifId = `event-${event.id || event.organizer_name || 'unknown'}-${String(event.job_fair_date_start)}`;
      const daysUntil = getDaysUntilActivity(event.job_fair_date_start, now);
      if (daysUntil === null) return;

      pushUpcoming({
        id: notifId,
        startDate: event.job_fair_date_start,
        activityType: 'job-fair',
        activityId: Number(event.id) || null,
        year: Number(event.fiscal_year) || new Date(event.job_fair_date_start).getFullYear(),
        month: Number(event.month) || (new Date(event.job_fair_date_start).getMonth() + 1),
        title: `${getActivityLeadLabel(daysUntil)}: Job Fair - ${event.organizer_name || 'Organizer'}`,
        meta: `${formatJobFairDateRange(event.job_fair_date_start, event.job_fair_date_end)} at ${event.venue_name || 'Venue not set'}`,
      });
    });

    jfaRecords.forEach((jfa) => {
      if (!jfa.job_fair_date_start) return;
      const notifId = `jfa-${jfa.id || jfa.jfa_no || 'unknown'}-${String(jfa.job_fair_date_start)}`;
      const daysUntil = getDaysUntilActivity(jfa.job_fair_date_start, now);
      if (daysUntil === null) return;

      pushUpcoming({
        id: notifId,
        startDate: jfa.job_fair_date_start,
        activityType: 'jfa',
        activityId: Number(jfa.id) || null,
        year: Number(jfa.fiscal_year) || new Date(jfa.job_fair_date_start).getFullYear(),
        month: Number(jfa.month) || (new Date(jfa.job_fair_date_start).getMonth() + 1),
        title: `${getActivityLeadLabel(daysUntil)}: JFA - ${jfa.jfa_no || 'No JFA #'}`,
        meta: `${formatDate(jfa.job_fair_date_start)} at ${jfa.venue_name || 'Venue not set'}${jfa.agency_name ? ` (${jfa.agency_name})` : ''}`,
      });
    });

    monitoringRecords.forEach((record) => {
      if (!record.job_fair_date_start) return;
      const notifId = `monitoring-${record.id || record.implementing_agency || 'unknown'}-${String(record.job_fair_date_start)}`;
      const daysUntil = getDaysUntilActivity(record.job_fair_date_start, now);
      if (daysUntil === null) return;

      pushUpcoming({
        id: notifId,
        startDate: record.job_fair_date_start,
        activityType: 'monitoring',
        activityId: Number(record.id) || null,
        year: Number(record.fiscal_year) || new Date(record.job_fair_date_start).getFullYear(),
        month: Number(record.month) || (new Date(record.job_fair_date_start).getMonth() + 1),
        title: `${getActivityLeadLabel(daysUntil)}: Monitoring - ${record.implementing_agency || 'Implementing agency'}`,
        meta: `${formatDate(record.job_fair_date_start)} at ${record.venue_name || 'Venue not set'}`,
      });
    });

    upcoming.sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      return a.title.localeCompare(b.title);
    });

    const notifications = upcoming.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      meta: item.meta,
      activityType: item.activityType,
      activityId: item.activityId,
      year: item.year,
      month: item.month,
    }));

    // Keep only currently relevant notification IDs in persisted seen state.
    const currentIds = new Set(notifications.map(item => item.id));
    Array.from(seenTopbarNotificationIds).forEach((id) => {
      if (!currentIds.has(id)) {
        seenTopbarNotificationIds.delete(id);
      }
    });
    persistSeenTopbarNotifications();

    renderTopbarNotifications(notifications);
  } catch (err) {
    console.error('Topbar notifications error:', err);
    renderTopbarNotifications([]);
  }
}

function setupExportButtons() {
  document.querySelectorAll('.btn-export-pdf').forEach(btn => {
    btn.addEventListener('click', () => {
      const tableSelector = btn.dataset.table;
      const filename = btn.dataset.filename;
      exportTableToPdf(tableSelector, filename);
    });
  });
}

// ============================================================================
// DASHBOARD
// ============================================================================
async function loadDashboard() {
  try {
    const stats = await window.api.getDashboardStats();

    // Extract available fiscal years from stats data
    availableFiscalYears = Array.from(new Set([
      ...stats.jfaByYear.map(r => Number(r.fiscal_year)),
      ...stats.eventsByYear.map(r => Number(r.fiscal_year)),
      ...stats.applicantsByYear.map(r => Number(r.fiscal_year)),
    ])).sort((a, b) => b - a);

    // Stat cards
    const totalJfa = stats.jfaByYear.reduce((s, r) => s + parseInt(r.count), 0);
    const totalEvents = stats.eventsByYear.reduce((s, r) => s + parseInt(r.count), 0);
    const totalApplicants = stats.applicantsByYear.reduce((s, r) => s + parseInt(r.total || 0), 0);

    document.getElementById('statTotalJfa').textContent = totalJfa;
    document.getElementById('statTotalEvents').textContent = totalEvents;
    document.getElementById('statTotalApplicants').textContent = totalApplicants.toLocaleString();
    document.getElementById('statTotalAgencies').textContent = stats.agencyStats?.total || 0;

    // Recent JFA table
    const tbody = document.getElementById('recentJfaTable');
    tbody.innerHTML = stats.recentJfa.map(r => `
      <tr>
        <td><strong>${r.jfa_no}</strong></td>
        <td>${r.agency_name}</td>
        <td>${formatJobFairDateRange(r.job_fair_date_start, r.job_fair_date_end)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No data</td></tr>';

    renderDashboardSummaries(stats);
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load dashboard', 'error');
  }
}

function renderDashboardSummaries(stats) {
  const yearRows = document.getElementById('dashboardYearRows');
  const genderList = document.getElementById('dashboardGenderSummary');
  const monthList = document.getElementById('dashboardMonthSummary');

  if (!yearRows || !genderList || !monthList) return;

  const years = Array.from(new Set([
    ...stats.jfaByYear.map(r => Number(r.fiscal_year)),
    ...stats.eventsByYear.map(r => Number(r.fiscal_year)),
    ...stats.applicantsByYear.map(r => Number(r.fiscal_year)),
  ])).sort((a, b) => b - a);

  yearRows.innerHTML = years.map((year) => {
    const jfa = stats.jfaByYear.find(r => Number(r.fiscal_year) === year);
    const events = stats.eventsByYear.find(r => Number(r.fiscal_year) === year);
    const applicants = stats.applicantsByYear.find(r => Number(r.fiscal_year) === year);

    return `
      <tr>
        <td><strong>${year}</strong></td>
        <td>${parseInt(jfa?.count || 0, 10)}</td>
        <td>${parseInt(events?.count || 0, 10)}</td>
        <td>${parseInt(applicants?.total || 0, 10).toLocaleString()}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="4">No data</td></tr>';

  const totalMale = stats.applicantsByYear.reduce((s, r) => s + parseInt(r.male || 0, 10), 0);
  const totalFemale = stats.applicantsByYear.reduce((s, r) => s + parseInt(r.female || 0, 10), 0);
  const totalApplicants = totalMale + totalFemale;

  genderList.innerHTML = `
    <li><span>Male</span><strong>${totalMale.toLocaleString()}</strong></li>
    <li><span>Female</span><strong>${totalFemale.toLocaleString()}</strong></li>
    <li><span>Total</span><strong>${totalApplicants.toLocaleString()}</strong></li>
  `;

  const monthlyTotals = Array(12).fill(0);
  stats.monthlyTrend.forEach((row) => {
    const monthIndex = Number(row.month) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      monthlyTotals[monthIndex] += parseInt(row.applicants || 0, 10);
    }
  });

  const topMonths = monthlyTotals
    .map((count, index) => ({ label: MONTHS[index + 1], count }))
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  monthList.innerHTML = topMonths.map((row) => `
    <li><span>${row.label}</span><strong>${row.count.toLocaleString()}</strong></li>
  `).join('') || '<li><span>No monthly applicant data</span><strong>0</strong></li>';

  // Load calendar (fire async without waiting)
  renderDashboardCalendar();
}

async function renderDashboardCalendar() {
  try {
    const calendarContainer = document.getElementById('dashboardCalendar');
    const yearSelect = document.getElementById('dashCalendarYear');
    const monthSelect = document.getElementById('dashCalendarMonth');
    const now = new Date();

    if (!calendarContainer || !yearSelect || !monthSelect) {
      console.warn('Calendar elements not found');
      return;
    }

    // Populate year selector dynamically if it doesn't have option elements
    const existingOptions = yearSelect.querySelectorAll('option');
    if (existingOptions.length === 0) {
      try {
        const events = await window.api.getJobFairEvents({});
        const jfaRecords = await window.api.getJfaRecords({});

        const years = new Set();
        events.forEach(e => {
          if (e.fiscal_year) years.add(e.fiscal_year);
        });
        jfaRecords.forEach(j => {
          if (j.fiscal_year) years.add(j.fiscal_year);
        });

        // Add current and surrounding years
        const currentYear = new Date().getFullYear();
        years.add(currentYear - 1);
        years.add(currentYear);
        years.add(currentYear + 1);

        yearSelect.innerHTML = Array.from(years)
          .sort((a, b) => b - a)
          .map(y => `<option value="${y}">${y}</option>`)
          .join('');

        // Set to current year
        yearSelect.value = currentYear;
      } catch (err) {
        console.error('Error populating year selector:', err);
      }
    }

    // Initialize selectors once so dashboard opens on current month/year.
    if (!yearSelect.dataset.initialized) {
      const currentYear = String(now.getFullYear());
      if (yearSelect.querySelector(`option[value="${currentYear}"]`)) {
        yearSelect.value = currentYear;
      }
      yearSelect.dataset.initialized = 'true';
    }

    if (!monthSelect.dataset.initialized) {
      monthSelect.value = String(now.getMonth() + 1);
      monthSelect.dataset.initialized = 'true';
    }

    const year = parseInt(yearSelect.value) || now.getFullYear();
    const month = parseInt(monthSelect.value) || now.getMonth() + 1;

    // Get event data for the selected year and month
    const events = await window.api.getJobFairEvents({ fiscal_year: year });
    const jfaRecords = await window.api.getJfaRecords({ fiscal_year: year });

    // Count activities by day
    const dailyActivityCount = {};

    events.forEach(event => {
      if (event.job_fair_date_start) {
        const date = new Date(event.job_fair_date_start);
        if (date.getFullYear() === year && (date.getMonth() + 1) === month) {
          const day = date.getDate();
          dailyActivityCount[day] = (dailyActivityCount[day] || 0) + 1;
        }
      }
    });

    jfaRecords.forEach(jfa => {
      if (jfa.job_fair_date_start) {
        const date = new Date(jfa.job_fair_date_start);
        if (date.getFullYear() === year && (date.getMonth() + 1) === month) {
          const day = date.getDate();
          dailyActivityCount[day] = (dailyActivityCount[day] || 0) + 1;
        }
      }
    });

    // Generate calendar grid
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    let calendarHtml = '';

    // Weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
      calendarHtml += `<div class="calendar-weekday-header">${day}</div>`;
    });

    // Previous month's days (grayed out)
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      calendarHtml += `
        <div class="calendar-day other-month">
          <div class="calendar-day-number">${day}</div>
        </div>
      `;
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const count = dailyActivityCount[day] || 0;
      let activityClass = 'no-activity';

      if (count > 0) {
        activityClass = count >= 2 ? 'high-activity' : 'has-activity';
      }

      const label = count === 0 ? 'No activity' : count === 1 ? '1 activity' : `${count} activities`;

      calendarHtml += `
        <div class="calendar-day ${activityClass}" title="${label}" data-day="${day}" data-month="${month}" data-year="${year}" data-clickable="true">
          <div class="calendar-day-number">${day}</div>
          ${count > 0 ? `<div class="calendar-day-count">${count}</div>` : ''}
          ${count > 0 ? `<div class="calendar-day-label">${label}</div>` : ''}
        </div>
      `;
    }

    // Next month's days (grayed out)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remainingCells; day++) {
      calendarHtml += `
        <div class="calendar-day other-month">
          <div class="calendar-day-number">${day}</div>
        </div>
      `;
    }

    calendarContainer.innerHTML = calendarHtml;

    // Add click handlers to days with activities
    const clickableDays = calendarContainer.querySelectorAll('[data-clickable="true"]');
    clickableDays.forEach(dayElement => {
      dayElement.style.cursor = 'pointer';
      dayElement.addEventListener('click', async () => {
        const day = parseInt(dayElement.dataset.day);
        const month = parseInt(dayElement.dataset.month);
        const year = parseInt(dayElement.dataset.year);
        await showActivityDetailsModal(year, month, day, events, jfaRecords);
      });
    });

  } catch (err) {
    console.error('Calendar render error:', err);
    const container = document.getElementById('dashboardCalendar');
    if (container) {
      container.innerHTML = `<p style="color: red; grid-column: 1 / -1; text-align: center;">Error loading calendar: ${err.message}</p>`;
    }
  }
}

async function showActivityDetailsModal(year, month, day, allEvents, allJfaRecords) {
  try {
    // Filter activities for the selected day
    const dayDate = new Date(year, month - 1, day);
    const dayDateString = dayDate.toISOString().split('T')[0];

    const dayEvents = allEvents.filter(event => {
      if (!event.job_fair_date_start) return false;
      const eventDate = new Date(event.job_fair_date_start).toISOString().split('T')[0];
      return eventDate === dayDateString;
    });

    const dayJfas = allJfaRecords.filter(jfa => {
      if (!jfa.job_fair_date_start) return false;
      const jfaDate = new Date(jfa.job_fair_date_start).toISOString().split('T')[0];
      return jfaDate === dayDateString;
    });

    const dateDisplay = new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let html = `
      <div style="margin-bottom: 20px;">
        <h4 style="margin-bottom: 10px; color: #2563eb; font-size: 16px;">Activities on ${dateDisplay}</h4>
    `;

    // Job Fair Events
    if (dayEvents.length > 0) {
      html += `
        <div style="margin-bottom: 15px;">
          <h5 style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 8px;">📅 Job Fair Events (${dayEvents.length})</h5>
          <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 10px; border-radius: 4px;">
      `;

      dayEvents.forEach(event => {
        html += `
          <div
            class="calendar-activity-link"
            data-activity-type="job-fair"
            data-activity-id="${event.id || ''}"
            role="button"
            tabindex="0"
            style="margin-bottom: 8px; padding: 8px; border-bottom: 1px solid #e0e7ff; border-radius: 4px; cursor: pointer;"
            title="Open this Job Fair event"
          >
            <strong style="color: #1e3a8a;">${event.organizer_name || 'N/A'}</strong><br>
            <span style="font-size: 12px; color: #64748b;">
              📍 ${event.venue_name || 'N/A'} |
              👥 ${event.num_job_fairs_facilitated || 0} fairs |
              📊 ${event.total_applicants || 0} applicants
            </span>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    // JFA Records
    if (dayJfas.length > 0) {
      html += `
        <div style="margin-bottom: 15px;">
          <h5 style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 8px;">📋 JFA Records (${dayJfas.length})</h5>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px; border-radius: 4px;">
      `;

      dayJfas.forEach(jfa => {
        html += `
          <div
            class="calendar-activity-link"
            data-activity-type="jfa"
            data-activity-id="${jfa.id || ''}"
            role="button"
            tabindex="0"
            style="margin-bottom: 8px; padding: 8px; border-bottom: 1px solid #dcfce7; border-radius: 4px; cursor: pointer;"
            title="Open this JFA record"
          >
            <strong style="color: #15803d;">JFA: ${jfa.jfa_no || 'N/A'}</strong><br>
            <span style="font-size: 12px; color: #64748b;">
              🏢 ${jfa.agency_name || 'N/A'} |
              📍 ${jfa.venue_name || 'N/A'} |
              ${jfa.available_job_orders || 0} job orders
            </span>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    if (dayEvents.length === 0 && dayJfas.length === 0) {
      html += `<p style="color: #64748b;">No activities found for this day.</p>`;
    }

    html += `</div>`;

    openModal(`Activities - ${dateDisplay}`, html, null);

    const modalBody = document.getElementById('modalBody');
    if (modalBody) {
      const links = modalBody.querySelectorAll('.calendar-activity-link[data-activity-type][data-activity-id]');

      links.forEach((item) => {
        const navigate = async () => {
          const type = item.dataset.activityType;
          const id = parseInt(item.dataset.activityId || '', 10);
          if (!type || Number.isNaN(id) || id <= 0) return;

          closeModal();
          await openCalendarActivityRecord(type, id, year, month);
        };

        item.addEventListener('click', navigate);
        item.addEventListener('keydown', async (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            await navigate();
          }
        });
      });
    }

  } catch (err) {
    console.error('Error showing activity details:', err);
    showToast('Error loading activity details', 'error');
  }
}

function setSelectValue(selectEl, value) {
  if (!selectEl) return;
  const normalized = String(value || '');
  if (!selectEl.querySelector(`option[value="${normalized}"]`)) {
    const option = document.createElement('option');
    option.value = normalized;
    option.textContent = normalized;
    selectEl.appendChild(option);
  }
  selectEl.value = normalized;
}

function setSelectToAll(selectEl, emptyLabel) {
  if (!selectEl) return;

  let allOption = selectEl.querySelector('option[value=""]');
  if (!allOption) {
    allOption = document.createElement('option');
    allOption.value = '';
    selectEl.insertBefore(allOption, selectEl.firstChild);
  }

  allOption.textContent = emptyLabel;
  selectEl.value = '';
}

function highlightActivityRow(tableBodySelector, rowSelector) {
  const tbody = document.querySelector(tableBodySelector);
  if (!tbody) return false;

  tbody.querySelectorAll('.table-row-activity-highlight').forEach((row) => {
    row.classList.remove('table-row-activity-highlight');
  });

  const matches = Array.from(tbody.querySelectorAll(rowSelector));
  if (!matches.length) return false;

  // For grouped rows (e.g. Job Fair with participant rows), prefer the anchor row.
  const row = matches.find((candidate) => candidate.querySelector('td[rowspan]')) || matches[0];
  if (!row) return false;

  row.classList.add('table-row-activity-highlight');

  const mainContent = document.getElementById('mainContent');
  if (mainContent && mainContent.contains(row)) {
    const rowRect = row.getBoundingClientRect();
    const containerRect = mainContent.getBoundingClientRect();
    const currentTop = mainContent.scrollTop;
    const targetTop = currentTop + (rowRect.top - containerRect.top) - (mainContent.clientHeight / 2) + (rowRect.height / 2);

    mainContent.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
  } else {
    row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  const scrollParent = row.closest('.jfa-table-scroll-container, .jf-table-scroll-container, .table-responsive');
  if (scrollParent) {
    const rowTop = row.offsetTop;
    const targetTop = Math.max(0, rowTop - (scrollParent.clientHeight / 2) + (row.clientHeight / 2));
    scrollParent.scrollTo({ top: targetTop, behavior: 'smooth' });
  }

  return true;
}

async function highlightActivityRowWithRetry(tableBodySelector, rowSelector, maxAttempts = 8, delayMs = 120) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (highlightActivityRow(tableBodySelector, rowSelector)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}

function setupActivityHighlightDismissal(tableBodySelector) {
  const tbody = document.querySelector(tableBodySelector);
  if (!tbody || tbody.dataset.highlightDismissBound === 'true') return;

  tbody.addEventListener('click', (event) => {
    const clickedRow = event.target.closest('tr');
    if (!clickedRow || !tbody.contains(clickedRow)) return;

    const activeRow = tbody.querySelector('.table-row-activity-highlight');
    if (!activeRow) return;

    if (clickedRow !== activeRow) {
      activeRow.classList.remove('table-row-activity-highlight');
    }
  });

  tbody.dataset.highlightDismissBound = 'true';
}

async function openCalendarActivityRecord(type, id, year, month) {
  try {
    if (Number.isNaN(Number(id)) || Number(id) <= 0) {
      showToast('Selected activity is no longer available', 'info');
      return;
    }

    if (type === 'job-fair') {
      const jfYear = document.getElementById('jfFilterYear');
      const jfMonth = document.getElementById('jfFilterMonth');
      if (jfYear) {
        jfYear.dataset.currentDefaultSet = 'true';
      }
      setSelectToAll(jfYear, 'All Years');
      setSelectToAll(jfMonth, 'All Months');

      await switchPage('job-fair-report');

      const found = await highlightActivityRowWithRetry('#jfTableBody', `tr[data-jobfair-id="${id}"]`);
      if (!found) {
        showToast('Selected Job Fair activity is not visible in the current table view', 'info');
      }
      return;
    }

    if (type === 'jfa') {
      setSelectToAll(document.getElementById('jfaFilterYear'), 'All Years');
      setSelectToAll(document.getElementById('jfaFilterMonth'), 'All Months');

      await switchPage('jfa-tracking');

      const found = await highlightActivityRowWithRetry('#jfaTableBody', `tr[data-jfa-id="${id}"]`);
      if (!found) {
        showToast('Selected JFA activity is not visible in the current table view', 'info');
      }
      return;
    }

    if (type === 'monitoring') {
      setSelectToAll(document.getElementById('monFilterYear'), 'All Years');
      setSelectToAll(document.getElementById('monFilterMonth'), 'All Months');

      await switchPage('monitoring');

      const found = await highlightActivityRowWithRetry('#monTableBody', `tr[data-monitoring-id="${id}"]`);
      if (!found) {
        showToast('Selected Monitoring activity is not visible in the current table view', 'info');
      }
      return;
    }
  } catch (err) {
    console.error('Error opening calendar activity record:', err);
    showToast('Unable to open selected activity', 'error');
  }
}

// ============================================================================
// JFA TRACKING
// ============================================================================

function getJfaSortKey(jfaNo) {
  const value = String(jfaNo || '').trim();
  const match = value.match(/^BUT-(\d{2})-(\d{4})-(\d+)$/i);

  if (!match) {
    return null;
  }

  const yy = parseInt(match[1], 10);
  const mmdd = parseInt(match[2], 10);
  const sequence = parseInt(match[3], 10);

  if ([yy, mmdd, sequence].some(Number.isNaN)) {
    return null;
  }

  return { yy, mmdd, sequence };
}

async function loadJfaTracking() {
  const filters = {
    fiscal_year: getFormValue('jfaFilterYear') || undefined,
    month: getFormValue('jfaFilterMonth') || undefined,
  };

  try {
    const canWrite = canCurrentUserWrite();
    const records = await window.api.getJfaRecords(filters);

    // Show newest records first so recently added JFAs appear at the top.
    records.sort((a, b) => {
      const aTs = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTs = new Date(b.updated_at || b.created_at || 0).getTime();

      if (bTs !== aTs) {
        return bTs - aTs;
      }

      const aId = Number(a.id) || 0;
      const bId = Number(b.id) || 0;
      if (bId !== aId) {
        return bId - aId;
      }

      const aKey = getJfaSortKey(a.jfa_no);
      const bKey = getJfaSortKey(b.jfa_no);
      if (aKey && bKey) {
        if (bKey.yy !== aKey.yy) return bKey.yy - aKey.yy;
        if (bKey.mmdd !== aKey.mmdd) return bKey.mmdd - aKey.mmdd;
        if (bKey.sequence !== aKey.sequence) return bKey.sequence - aKey.sequence;
      }

      return (b.jfa_no || '').localeCompare(a.jfa_no || '');
    });

    const tbody = document.getElementById('jfaTableBody');
    tbody.innerHTML = records.map((r, index) => `
      <tr data-jfa-id="${r.id}">
        <td>${index + 1}</td>
        <td><strong>${r.jfa_no || '<span class="missing-data">No JFA #</span>'}</strong></td>
        <td>${r.agency_name || '<span class="missing-data">No agency</span>'}</td>
        <td>${formatJobFairDateRange(r.job_fair_date_start, r.job_fair_date_end)}</td>
        <td>${r.venue_name || '<span class="missing-data">No venue</span>'}</td>
        <td>${r.affidavit_date ? formatDate(r.affidavit_date) : '<span class="missing-data">-</span>'}</td>
        <td>${r.job_orders_date ? formatDate(r.job_orders_date) : '<span class="missing-data">-</span>'}</td>
        <td>${r.representative_id_date ? formatDate(r.representative_id_date) : '<span class="missing-data">-</span>'}</td>
        <td>${r.terminal_report_date ? formatDate(r.terminal_report_date) : '<span class="missing-data">-</span>'}</td>
        <td>${r.remarks || '<span class="missing-data">-</span>'}</td>
        <td class="actions-cell">
          ${canWrite
            ? `<button class="btn-icon btn-edit-jfa" data-id="${r.id}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger btn-delete-jfa" data-id="${r.id}" title="Delete"><i class="fas fa-trash"></i></button>`
            : ''}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="11">No JFA records found</td></tr>';

    // Attach JFA event listeners
    document.querySelectorAll('.btn-edit-jfa').forEach(btn => {
      btn.addEventListener('click', () => openJfaForm(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.btn-delete-jfa').forEach(btn => {
      btn.addEventListener('click', () => deleteJfa(parseInt(btn.dataset.id)));
    });

    setupActivityHighlightDismissal('#jfaTableBody');

    setupJfaTopScrollbar();
  } catch (err) {
    console.error(err);
    showToast('Failed to load JFA records', 'error');
  }
}

async function openJfaForm(id = null) {
  if (!ensureCanWrite('add or edit JFA records')) return;

  const agencies = await window.api.getAgencies();
  const venues = await window.api.getVenues();
  let jfa = null;
  if (id) jfa = await window.api.getJfaById(id);

  const agencyOpts = agencies.map(a =>
    `<option value="${a.id}" ${jfa && jfa.agency_id === a.id ? 'selected' : ''}>${a.agency_name} (${a.agency_type})</option>`
  ).join('');
  const venueOpts = `<option value="">-- Select --</option>` + venues.map(v =>
    `<option value="${v.id}" ${jfa && jfa.venue_id === v.id ? 'selected' : ''}>${v.venue_name}</option>`
  ).join('');

  const html = `
    <div class="form-row">
      <div class="form-group">
        <label>JFA No.</label>
        <input class="form-input" id="fJfaNo" value="${jfa?.jfa_no || ''}" placeholder="BUT-26-0304-021">
      </div>
      <div class="form-group">
        <label>Agency</label>
        <select class="form-select" id="fJfaAgency">${agencyOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Date Start</label>
        <input class="form-input" type="date" id="fJfaDateStart" value="${formatDateForInput(jfa?.job_fair_date_start)}">
      </div>
      <div class="form-group">
        <label>Date End</label>
        <input class="form-input" type="date" id="fJfaDateEnd" value="${formatDateForInput(jfa?.job_fair_date_end)}">
      </div>
    </div>
    <div class="form-group">
      <label>Venue</label>
      <select class="form-select" id="fJfaVenue">${venueOpts}</select>
    </div>
    <div class="form-group">
      <label>Remarks</label>
      <textarea class="form-textarea" id="fJfaRemarks">${jfa?.remarks || ''}</textarea>
    </div>

    <div class="form-group" style="margin-top: 14px;">
      <label style="font-size: 0.82rem; color: var(--text);">Document Tracking</label>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Affidavit of Undertaking</label>
        <input class="form-input" type="date" id="fJfaDocAff" value="${formatDateForInput(jfa?.affidavit_date)}">
      </div>
      <div class="form-group">
        <label>Job Orders Received</label>
        <input class="form-input" type="date" id="fJfaDocJo" value="${formatDateForInput(jfa?.job_orders_date)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Representative Company</label>
        <input class="form-input" type="date" id="fJfaDocRep" value="${formatDateForInput(jfa?.representative_id_date)}">
      </div>
      <div class="form-group">
        <label>Terminal Report</label>
        <input class="form-input" type="date" id="fJfaDocTr" value="${formatDateForInput(jfa?.terminal_report_date)}">
      </div>
    </div>
  `;

  openModal(id ? 'Edit JFA Record' : 'Add JFA Record', html, async () => {
    // Validate required fields
    const jfaNo = getFormValue('fJfaNo');
    const agencyId = getFormInt('fJfaAgency');
    const startDate = getFormValue('fJfaDateStart') || null;
    const endDate = getFormValue('fJfaDateEnd') || null;

    // Keep fiscal fields internal by deriving them from the entered date range.
    const sourceDateValue = startDate
      || endDate
      || jfa?.job_fair_date_start
      || jfa?.job_fair_date_end
      || null;
    const sourceDate = sourceDateValue ? new Date(sourceDateValue) : null;
    const hasValidSourceDate = sourceDate && !Number.isNaN(sourceDate.getTime());
    const year = hasValidSourceDate ? sourceDate.getFullYear() : Number(jfa?.fiscal_year) || new Date().getFullYear();
    const month = hasValidSourceDate ? sourceDate.getMonth() + 1 : Number(jfa?.month) || (new Date().getMonth() + 1);
    
    if (!jfaNo) { showToast('JFA No. is required', 'error'); return; }
    if (!agencyId || agencyId === 0) { showToast('Agency is required', 'error'); return; }
    if (!year || year === 0) { showToast('Unable to determine fiscal year from date fields', 'error'); return; }
    if (!month || month === 0) { showToast('Unable to determine month from date fields', 'error'); return; }

    const baseData = {
      jfa_no: jfaNo,
      agency_id: agencyId,
      fiscal_year: year,
      month: month,
      job_fair_date_start: startDate,
      job_fair_date_end: endDate,
      venue_id: getFormValue('fJfaVenue') ? getFormInt('fJfaVenue') : null,
      available_job_orders: jfa?.available_job_orders || 0,
      job_site: jfa?.job_site || null,
      job_orders_balance: jfa?.job_orders_balance || 0,
      status: jfa?.status || 'active',
      remarks: getFormValue('fJfaRemarks') || null,
    };

    const documentData = {
      invitation_letter_date: jfa?.invitation_letter_date || null,
      affidavit_date: getFormValue('fJfaDocAff'),
      job_orders_date: getFormValue('fJfaDocJo'),
      representative_id_date: getFormValue('fJfaDocRep'),
      terminal_report_date: getFormValue('fJfaDocTr'),
      status_of_applicants: jfa?.status_of_applicants || null,
      status_date: jfa?.status_date || null,
    };

    try {
      let savedRecord;
      if (id) {
        savedRecord = await window.api.updateJfa({ ...baseData, id });
      } else {
        savedRecord = await window.api.createJfa(baseData);
      }

      if (savedRecord?.id) {
        await window.api.updateJfaDocuments({
          jfa_id: savedRecord.id,
          ...documentData,
        });
      }

      closeModal();
      showToast(id ? 'JFA updated' : 'JFA created', 'success');
      loadJfaTracking();
      await refreshTopbarNotifications();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }, 'modal-jfa-add');
}

async function deleteJfa(id) {
  if (!ensureCanWrite('delete JFA records')) return;

  if (!confirm('Delete this JFA record? This cannot be undone.')) return;
  try {
    await window.api.deleteJfa(id);
    showToast('JFA deleted', 'success');
    loadJfaTracking();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// View JFA Details Modal with Tabs
async function viewJfaDetails(id) {
  const jfa = await window.api.getJfaById(id);

  // Build timeline items
  const timelineItems = [
    { label: 'Invitation Letter', date: jfa.invitation_letter_date, icon: 'fa-envelope' },
    { label: 'Affidavit of Undertaking', date: jfa.affidavit_date, icon: 'fa-file-signature' },
    { label: 'Job Orders Received', date: jfa.job_orders_date, icon: 'fa-briefcase' },
    { label: 'Representative ID', date: jfa.representative_id_date, icon: 'fa-id-card' },
    { label: 'Terminal Report', date: jfa.terminal_report_date, icon: 'fa-file-alt' },
    { label: 'Status of Applicants', date: jfa.status_of_applicants, icon: 'fa-users' }
  ];

  // Sort timeline by date (submitted first)
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  const html = `
    <div class="jfa-view-modal">

      <div class="jfa-tab-content" id="jfaTabDetails">
        <div class="jfa-detail-hero">
          <div class="jfa-detail-row jfa-detail-row-id">
            <span class="jfa-detail-label">JFA ID</span>
            <span class="jfa-detail-value jfa-detail-value-id">${jfa.jfa_no || '<span class="missing-data">Not set</span>'}</span>
          </div>
          <div class="jfa-detail-row">
            <span class="jfa-detail-label">Agency</span>
            <span class="jfa-detail-value">${jfa.agency_name || '<span class="missing-data">Unknown agency</span>'}</span>
          </div>
        </div>

        <div class="jfa-detail-sections">
          <section class="jfa-detail-card">
            <h4>Basic Info</h4>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Fiscal Year</span>
              <span class="jfa-detail-value">${jfa.fiscal_year || '<span class="missing-data">Not set</span>'}</span>
            </div>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Month</span>
              <span class="jfa-detail-value">${jfa.month ? MONTHS[jfa.month] : '<span class="missing-data">Not set</span>'}</span>
            </div>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Available Job Orders</span>
              <span class="jfa-detail-value">${jfa.available_job_orders || 0}</span>
            </div>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Job Orders Balance</span>
              <span class="jfa-detail-value">${jfa.job_orders_balance || 0}</span>
            </div>
          </section>

          <section class="jfa-detail-card">
            <h4>Schedule</h4>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Date Start</span>
              <span class="jfa-detail-value">${jfa.job_fair_date_start ? formatDate(jfa.job_fair_date_start) : '<span class="missing-data">Not set</span>'}</span>
            </div>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Date End</span>
              <span class="jfa-detail-value">${jfa.job_fair_date_end ? formatDate(jfa.job_fair_date_end) : '<span class="missing-data">Not set</span>'}</span>
            </div>
          </section>

          <section class="jfa-detail-card">
            <h4>Location</h4>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Venue</span>
              <span class="jfa-detail-value">${jfa.venue_name || '<span class="missing-data">No venue</span>'}</span>
            </div>
            <div class="jfa-detail-row">
              <span class="jfa-detail-label">Job Site</span>
              <span class="jfa-detail-value">${jfa.job_site || '<span class="missing-data">No job site</span>'}</span>
            </div>
          </section>
        </div>
      </div>

      <div class="jfa-tab-content" id="jfaTabJoborders" style="display:none;">
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Available Job Orders</span>
            <span class="detail-value">${jfa.available_job_orders || 0}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Balance</span>
            <span class="detail-value">${jfa.job_orders_balance || 0}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Status of Applicants</span>
            <span class="detail-value">${jfa.status_of_applicants || '<span class="missing-data">Not set</span>'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Status Date</span>
            <span class="detail-value">${jfa.status_date ? formatDate(jfa.status_date) : '<span class="missing-data">Not set</span>'}</span>
          </div>
        </div>
      </div>

      <div class="jfa-tab-content" id="jfaTabTimeline" style="display:none;">
        <div class="timeline-view">
          ${sortedTimeline.map(item => `
            <div class="timeline-item ${item.date ? 'completed' : 'pending'}">
              <div class="timeline-icon"><i class="fas ${item.icon}"></i></div>
              <div class="timeline-content">
                <div class="timeline-label">${item.label}</div>
                <div class="timeline-date">${item.date ? formatDate(item.date) : '<span class="missing-data">Not submitted</span>'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="jfa-tab-content" id="jfaTabRemarks" style="display:none;">
        <div class="remarks-section">
          ${jfa.remarks ? `<p>${jfa.remarks}</p>` : '<p class="missing-data">No notes or remarks added.</p>'}
        </div>
      </div>
    </div>
  `;

  openModal(`JFA Details - ${jfa.jfa_no}`, html, null, 'modal-jfa');
}

// Tab switching for JFA details modal
function switchJfaTab(tabName) {
  // Hide all tabs
  const tabs = ['details', 'joborders', 'timeline', 'remarks'];
  const tabIds = {
    details: 'jfaTabDetails',
    joborders: 'jfaTabJoborders',
    timeline: 'jfaTabTimeline',
    remarks: 'jfaTabRemarks'
  };

  tabs.forEach(t => {
    const el = document.getElementById(tabIds[t]);
    if (el) el.style.display = 'none';
  });

  // Show selected tab
  const activeTab = document.getElementById(tabIds[tabName]);
  if (activeTab) activeTab.style.display = 'block';

  // Update tab button styles
  document.querySelectorAll('.jfa-tab').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.jfa-tab[onclick="switchJfaTab('${tabName}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

// ============================================================================
// JOB FAIR REPORT
// ============================================================================
async function loadJobFairReport() {
  const yearSelect = document.getElementById('jfFilterYear');
  const monthSelect = document.getElementById('jfFilterMonth');

  // Initialize filter defaults once so report opens on the current month/year.
  if (yearSelect && monthSelect && yearSelect.dataset.currentDefaultSet !== 'true') {
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonth = String(now.getMonth() + 1);

    if (!yearSelect.querySelector(`option[value="${currentYear}"]`)) {
      const option = document.createElement('option');
      option.value = currentYear;
      option.textContent = currentYear;
      yearSelect.appendChild(option);
    }

    yearSelect.value = currentYear;
    monthSelect.value = currentMonth;
    yearSelect.dataset.currentDefaultSet = 'true';
  }

  const filters = {
    fiscal_year: getFormValue('jfFilterYear') || undefined,
    month: getFormValue('jfFilterMonth') || undefined,
  };

  try {
    const canWrite = canCurrentUserWrite();
    const events = await window.api.getJobFairEvents(filters);
    const tbody = document.getElementById('jfTableBody');

    if (!events.length) {
      tbody.innerHTML = '<tr><td colspan="16">No events found</td></tr>';
      setupJfTopScrollbar();
      return;
    }

    const details = await Promise.all(events.map(async (event) => {
      try {
        const detail = await window.api.getJobFairById(event.id);
        return { eventId: event.id, participants: detail?.participants || [] };
      } catch (err) {
        console.error(`Failed to load participants for event ${event.id}`, err);
        return { eventId: event.id, participants: [] };
      }
    }));

    const participantsByEvent = new Map(details.map((detail) => [detail.eventId, detail.participants]));
    const parseIntSafe = (value) => Number.parseInt(value, 10) || 0;

    const grandTotals = {
      fairs: 0,
      regMale: 0,
      regFemale: 0,
      regTotal: 0,
      termMale: 0,
      termFemale: 0,
      termTotal: 0,
      land: 0,
      sea: 0,
      agencies: 0,
    };

    const tableRows = [];

    for (const event of events) {
      const participants = participantsByEvent.get(event.id) || [];

      const eventTotals = {
        regMale: 0,
        regFemale: 0,
        regTotal: 0,
        termMale: 0,
        termFemale: 0,
        termTotal: 0,
        land: 0,
        sea: 0,
        agencies: participants.length,
      };

      const fairsCount = parseIntSafe(event.num_job_fairs_facilitated);
      grandTotals.fairs += fairsCount;

      if (!participants.length) {
        const actionCell = canWrite
          ? `<td rowspan="2" class="actions-cell jf-actions-cell">
               <button class="btn-icon btn-edit-jobfair" data-id="${event.id}" title="Edit"><i class="fas fa-edit"></i></button>
               <button class="btn-icon danger btn-delete-jobfair" data-id="${event.id}" title="Delete"><i class="fas fa-trash"></i></button>
             </td>`
          : '<td rowspan="2" class="actions-cell jf-actions-cell"><span style="color:var(--text-muted)">View only</span></td>';

        tableRows.push(`
          <tr data-jobfair-id="${event.id}">
            <td>${event.organizer_name || '-'}</td>
            <td>${formatJobFairDateRange(event.job_fair_date_start, event.job_fair_date_end)}</td>
            <td>${event.venue_name || '-'}</td>
            <td>-</td>
            <td class="jf-cell-center">${fairsCount}</td>
            <td class="jf-cell-center">0</td>
            <td class="jf-cell-center">0</td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center">0</td>
            <td class="jf-cell-center">0</td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center">0</td>
            <td class="jf-cell-center">0</td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td>-</td>
            ${actionCell}
          </tr>
          <tr class="jf-subtotal-row">
            <td colspan="4" class="jf-subtotal-label"><strong>Sub total:</strong></td>
            <td class="jf-cell-center"><strong>${fairsCount}</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
            <td class="jf-cell-center"><strong>0</strong></td>
          </tr>
        `);
        continue;
      }

      participants.forEach((participant, index) => {
        const regMale = parseIntSafe(participant.registered_applicants_male);
        const regFemale = parseIntSafe(participant.registered_applicants_female);
        const regTotal = parseIntSafe(participant.registered_applicants_total);
        const termMale = parseIntSafe(participant.terminal_report_male);
        const termFemale = parseIntSafe(participant.terminal_report_female);
        const termTotal = parseIntSafe(participant.terminal_report_total);
        const isSeaBased = String(participant.agency_category || '').toLowerCase() === 'sea-based';
        const landCount = isSeaBased ? 0 : 1;
        const seaCount = isSeaBased ? 1 : 0;

        eventTotals.regMale += regMale;
        eventTotals.regFemale += regFemale;
        eventTotals.regTotal += regTotal;
        eventTotals.termMale += termMale;
        eventTotals.termFemale += termFemale;
        eventTotals.termTotal += termTotal;
        eventTotals.land += landCount;
        eventTotals.sea += seaCount;

        const eventInfoCells = index === 0
          ? `
            <td rowspan="${participants.length}">${event.organizer_name || '-'}</td>
            <td rowspan="${participants.length}">${formatJobFairDateRange(event.job_fair_date_start, event.job_fair_date_end)}</td>
            <td rowspan="${participants.length}">${event.venue_name || '-'}</td>
          `
          : '';

        const fairsCell = index === 0 ? `<td rowspan="${participants.length}" class="jf-cell-center">${fairsCount}</td>` : '';
        const actionCell = index === 0
          ? (canWrite
            ? `<td rowspan="${participants.length + 1}" class="actions-cell jf-actions-cell">
                 <button class="btn-icon btn-edit-jobfair" data-id="${event.id}" title="Edit"><i class="fas fa-edit"></i></button>
                 <button class="btn-icon danger btn-delete-jobfair" data-id="${event.id}" title="Delete"><i class="fas fa-trash"></i></button>
               </td>`
            : `<td rowspan="${participants.length + 1}" class="actions-cell jf-actions-cell"><span style="color:var(--text-muted)">View only</span></td>`)
          : '';

        tableRows.push(`
          <tr data-jobfair-id="${event.id}">
            ${eventInfoCells}
            <td>${participant.agency_name || '-'}</td>
            ${fairsCell}
            <td class="jf-cell-center">${regMale}</td>
            <td class="jf-cell-center">${regFemale}</td>
            <td class="jf-cell-center"><strong>${regTotal}</strong></td>
            <td class="jf-cell-center">${termMale}</td>
            <td class="jf-cell-center">${termFemale}</td>
            <td class="jf-cell-center"><strong>${termTotal}</strong></td>
            <td class="jf-cell-center">${landCount}</td>
            <td class="jf-cell-center">${seaCount}</td>
            <td class="jf-cell-center"><strong>${landCount + seaCount}</strong></td>
            <td>${participant.jfa_no || '-'}</td>
            ${actionCell}
          </tr>
        `);
      });

      tableRows.push(`
        <tr class="jf-subtotal-row">
          <td colspan="4" class="jf-subtotal-label"><strong>Sub total:</strong></td>
          <td class="jf-cell-center"><strong>${fairsCount}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.regMale}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.regFemale}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.regTotal}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.termMale}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.termFemale}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.termTotal}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.land}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.sea}</strong></td>
          <td class="jf-cell-center"><strong>${eventTotals.agencies}</strong></td>
          <td></td>
        </tr>
      `);

      grandTotals.regMale += eventTotals.regMale;
      grandTotals.regFemale += eventTotals.regFemale;
      grandTotals.regTotal += eventTotals.regTotal;
      grandTotals.termMale += eventTotals.termMale;
      grandTotals.termFemale += eventTotals.termFemale;
      grandTotals.termTotal += eventTotals.termTotal;
      grandTotals.land += eventTotals.land;
      grandTotals.sea += eventTotals.sea;
      grandTotals.agencies += eventTotals.agencies;
    }

    tableRows.push(`
      <tr class="jf-grand-total-row">
        <td colspan="4" class="jf-subtotal-label"><strong>GRAND TOTAL:</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.fairs}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.regMale}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.regFemale}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.regTotal}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.termMale}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.termFemale}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.termTotal}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.land}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.sea}</strong></td>
        <td class="jf-cell-center"><strong>${grandTotals.agencies}</strong></td>
        <td colspan="2"></td>
      </tr>
    `);

    tbody.innerHTML = tableRows.join('');

    if (canWrite) {
      document.querySelectorAll('.btn-edit-jobfair').forEach(btn => {
        btn.addEventListener('click', () => openJobFairForm(parseInt(btn.dataset.id, 10)));
      });
      document.querySelectorAll('.btn-delete-jobfair').forEach(btn => {
        btn.addEventListener('click', () => deleteJobFair(parseInt(btn.dataset.id, 10)));
      });
    }

    setupActivityHighlightDismissal('#jfTableBody');

    setupJfTopScrollbar();
  } catch (err) {
    console.error(err);
    showToast('Failed to load job fair events', 'error');
  }
}

async function openJobFairForm(id = null) {
  if (!ensureCanWrite('add or edit job fair events')) return;

  const agencies = await window.api.getAgencies();
  const venues = await window.api.getVenues();
  const participantAgencyOptions = ['<option value="">-- Select agency --</option>',
    ...agencies.map((a) => `<option value="${a.id}">${a.agency_name}</option>`),
  ].join('');

  let evt = null;
  let participantsForEdit = [];
  const removedParticipantIds = new Set();

  if (id) {
    const detail = await window.api.getJobFairById(id);
    evt = detail.event;
    participantsForEdit = detail.participants || [];
  }

  const orgOpts = `<option value="">-- Select --</option>` + agencies.map(a =>
    `<option value="${a.id}" ${evt && evt.organizer_id === a.id ? 'selected' : ''}>${a.agency_name}</option>`
  ).join('');
  const venueOpts = `<option value="">-- Select --</option>` + venues.map(v =>
    `<option value="${v.id}" ${evt && evt.venue_id === v.id ? 'selected' : ''}>${v.venue_name}</option>`
  ).join('');

  const participantEditorRows = participantsForEdit.map((p) => `
    <tr data-participant-id="${p.id}">
      <td>
        <select class="form-select jf-part-agency" id="jfPartAgency-${p.id}">
          ${['<option value="">-- Select agency --</option>',
            ...agencies.map((a) => `<option value="${a.id}" ${a.id === p.agency_id ? 'selected' : ''}>${a.agency_name}</option>`),
          ].join('')}
        </select>
      </td>
      <td><input class="form-input jf-part-jfa" id="jfPartJfa-${p.id}" value="${p.jfa_no || ''}" placeholder="BUT-26-0203-002"></td>
      <td><input class="form-input jf-part-reg-male" type="number" id="jfPartRegMale-${p.id}" value="${p.registered_applicants_male || 0}"></td>
      <td><input class="form-input jf-part-reg-female" type="number" id="jfPartRegFemale-${p.id}" value="${p.registered_applicants_female || 0}"></td>
      <td><input class="form-input jf-part-tr-male" type="number" id="jfPartTrMale-${p.id}" value="${p.terminal_report_male || 0}"></td>
      <td><input class="form-input jf-part-tr-female" type="number" id="jfPartTrFemale-${p.id}" value="${p.terminal_report_female || 0}"></td>
      <td>
        <input class="form-input jf-part-land" type="number" min="0" step="1" id="jfPartLand-${p.id}" value="${p.agency_category === 'land-based' ? 1 : 0}">
      </td>
      <td>
        <input class="form-input jf-part-sea" type="number" min="0" step="1" id="jfPartSea-${p.id}" value="${p.agency_category === 'sea-based' ? 1 : 0}">
      </td>
      <td class="actions-cell">
        <button type="button" class="btn-icon danger btn-remove-jf-participant" data-participant-id="${p.id}" title="Remove from event"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');

  const participantEditorHtml = `
    <div class="form-group" style="margin-top:14px;">
      <label style="font-size: 0.82rem; color: var(--text);">Participant Details (Editable)</label>
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <button type="button" class="btn btn-primary" id="btnAddJfParticipantFromEventModal">Add Agency</button>
      </div>
      <table class="data-table compact jf-participant-editor-table">
        <colgroup>
          <col class="jf-col-agency">
          <col class="jf-col-jfa">
          <col class="jf-col-reg-male">
          <col class="jf-col-reg-female">
          <col class="jf-col-tr-male">
          <col class="jf-col-tr-female">
          <col class="jf-col-land">
          <col class="jf-col-sea">
          <col class="jf-col-action">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2">AGENCY</th>
            <th rowspan="2">JFA NO.</th>
            <th colspan="2">NUMBER OF REGISTERED APPLICANTS</th>
            <th colspan="2">NUMBER OF REGISTERED APPLICANTS PER TERMINAL REPORT</th>
            <th colspan="2">NUMBER OF PARTICIPATING AGENCIES</th>
            <th rowspan="2">ACTION</th>
          </tr>
          <tr>
            <th>MALE</th>
            <th>FEMALE</th>
            <th>MALE</th>
            <th>FEMALE</th>
            <th>LAND BASED<br>RECRUITMENT<br>AGENCY</th>
            <th>SEA BASED /<br>MANNING<br>AGENCY</th>
          </tr>
        </thead>
        <tbody id="jfParticipantEditorBody">
          ${participantEditorRows}
        </tbody>
      </table>
    </div>
  `;

  const html = `
    <div class="form-group">
      <label>Organizer / Institution</label>
      <select class="form-select" id="fJfOrganizer">${orgOpts}</select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Date Start</label>
        <input class="form-input" type="date" id="fJfDateStart" value="${formatDateForInput(evt?.job_fair_date_start)}">
      </div>
      <div class="form-group">
        <label>Date End</label>
        <input class="form-input" type="date" id="fJfDateEnd" value="${formatDateForInput(evt?.job_fair_date_end)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Venue</label>
        <select class="form-select" id="fJfVenue">${venueOpts}</select>
      </div>
      <div class="form-group">
        <label>No. of Job Fairs Facilitated</label>
        <input class="form-input" type="number" id="fJfNum" value="${evt?.num_job_fairs_facilitated || 1}" min="1">
      </div>
    </div>
    ${participantEditorHtml}
  `;

  openModal(id ? 'Edit Job Fair Event' : 'Add Job Fair Event', html, async () => {
    // Validate required fields
    const dateStart = getFormValue('fJfDateStart');

    if (!dateStart) { showToast('Job Fair Start Date is required', 'error'); return; }

    const parsedStartDate = new Date(dateStart);
    const year = Number.isNaN(parsedStartDate.getTime())
      ? (evt?.fiscal_year || new Date().getFullYear())
      : parsedStartDate.getFullYear();
    const month = Number.isNaN(parsedStartDate.getTime())
      ? (evt?.month || (new Date().getMonth() + 1))
      : (parsedStartDate.getMonth() + 1);

    const baseData = {
      fiscal_year: year,
      month: month,
      organizer_id: getFormValue('fJfOrganizer') ? getFormInt('fJfOrganizer') : null,
      job_fair_date_start: dateStart,
      job_fair_date_end: getFormValue('fJfDateEnd') || null,
      venue_id: getFormValue('fJfVenue') ? getFormInt('fJfVenue') : null,
      num_job_fairs_facilitated: getFormInt('fJfNum') || 1,
      monitored_by: evt?.monitored_by || null,
      remarks: evt?.remarks || null,
    };

    try {
      let targetEventId = id;
      if (id) {
        await window.api.updateJobFairEvent({ ...baseData, id });
      } else {
        const createdEvent = await window.api.createJobFairEvent(baseData);
        targetEventId = createdEvent?.id;
      }

      if (targetEventId) {
        const jfaRecords = await window.api.getJfaRecords({});
        const jfaIdByNo = new Map(
          jfaRecords
            .filter((r) => r?.jfa_no)
            .map((r) => [String(r.jfa_no).trim().toUpperCase(), r.id])
        );

        for (const participantId of removedParticipantIds) {
          await window.api.deleteParticipant(participantId);
        }

        const participantRows = document.querySelectorAll('#jfParticipantEditorBody tr');
        for (const row of participantRows) {
          const existingParticipantId = Number.parseInt(row.dataset.participantId || '', 10);

          const agencyId = Number.parseInt(row.querySelector('.jf-part-agency')?.value || '', 10);
          if (!agencyId) {
            continue;
          }

          const landBasedCount = Number.parseInt(row.querySelector('.jf-part-land')?.value || '0', 10) || 0;
          const seaBasedCount = Number.parseInt(row.querySelector('.jf-part-sea')?.value || '0', 10) || 0;
          const category = seaBasedCount > landBasedCount ? 'sea-based' : 'land-based';
          const jfaNo = String(row.querySelector('.jf-part-jfa')?.value || '').trim().toUpperCase();
          const resolvedJfaId = jfaNo ? (jfaIdByNo.get(jfaNo) || null) : null;

          const payload = {
            agency_id: agencyId,
            jfa_id: resolvedJfaId,
            agency_category: category,
            registered_applicants_male: Number.parseInt(row.querySelector('.jf-part-reg-male')?.value || '0', 10) || 0,
            registered_applicants_female: Number.parseInt(row.querySelector('.jf-part-reg-female')?.value || '0', 10) || 0,
            terminal_report_male: Number.parseInt(row.querySelector('.jf-part-tr-male')?.value || '0', 10) || 0,
            terminal_report_female: Number.parseInt(row.querySelector('.jf-part-tr-female')?.value || '0', 10) || 0,
          };

          if (!Number.isNaN(existingParticipantId)) {
            if (removedParticipantIds.has(existingParticipantId)) {
              continue;
            }

            await window.api.updateParticipant({
              id: existingParticipantId,
              ...payload,
            });
          } else {
            await window.api.addParticipant({
              event_id: targetEventId,
              ...payload,
            });
          }
        }
      }

      closeModal();
      showToast(id ? 'Event updated' : 'Event created', 'success');
      loadJobFairReport();
      await refreshTopbarNotifications();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }, 'modal-jobfair-event');

  const participantBody = document.getElementById('jfParticipantEditorBody');
  const addParticipantBtn = document.getElementById('btnAddJfParticipantFromEventModal');

  const bindRemoveParticipantButtons = () => {
    document.querySelectorAll('.btn-remove-jf-participant').forEach((btn) => {
      if (btn.dataset.bound === 'true') return;

      btn.addEventListener('click', () => {
        const participantId = Number.parseInt(btn.dataset.participantId || '', 10);
        if (!Number.isNaN(participantId)) {
          removedParticipantIds.add(participantId);
        }

        const row = btn.closest('tr');
        if (row) {
          row.remove();
        }
      });

      btn.dataset.bound = 'true';
    });
  };

  if (participantBody && addParticipantBtn) {
    let draftCounter = 0;

    addParticipantBtn.addEventListener('click', () => {
      draftCounter += 1;
      const draftId = `new-${Date.now()}-${draftCounter}`;

      participantBody.insertAdjacentHTML('beforeend', `
        <tr data-participant-id="${draftId}">
          <td>
            <select class="form-select jf-part-agency">
              ${participantAgencyOptions}
            </select>
          </td>
          <td><input class="form-input jf-part-jfa" placeholder="BUT-26-0203-002"></td>
          <td><input class="form-input jf-part-reg-male" type="number" value="0"></td>
          <td><input class="form-input jf-part-reg-female" type="number" value="0"></td>
          <td><input class="form-input jf-part-tr-male" type="number" value="0"></td>
          <td><input class="form-input jf-part-tr-female" type="number" value="0"></td>
          <td>
            <input class="form-input jf-part-land" type="number" min="0" step="1" value="1">
          </td>
          <td>
            <input class="form-input jf-part-sea" type="number" min="0" step="1" value="0">
          </td>
          <td class="actions-cell">
            <button type="button" class="btn-icon danger btn-remove-jf-participant" title="Remove from event"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `);

      bindRemoveParticipantButtons();
    });
  }

  bindRemoveParticipantButtons();
}

async function openJobFairDetail(eventId) {
  const canWrite = canCurrentUserWrite();
  const detail = await window.api.getJobFairById(eventId);
  const e = detail.event;
  const participants = detail.participants;
  const agencies = await window.api.getAgencies();

  const agencyOpts = agencies.filter(a => a.agency_type === 'recruitment' || a.agency_type === 'sea-based')
    .map(a => `<option value="${a.id}">${a.agency_name}</option>`).join('');

  let partRows = participants.map(p => `
    <tr>
      <td>${p.agency_name}</td>
      <td>${p.jfa_no || '-'}</td>
      <td><span class="badge badge-${p.agency_category === 'land-based' ? 'active' : 'completed'}">${p.agency_category}</span></td>
      <td>${p.registered_applicants_male}</td>
      <td>${p.registered_applicants_female}</td>
      <td><strong>${p.registered_applicants_total}</strong></td>
      <td>${p.terminal_report_male}</td>
      <td>${p.terminal_report_female}</td>
      <td><strong>${p.terminal_report_total}</strong></td>
      <td class="actions-cell">
        ${canWrite ? `<button class="btn-icon btn-edit-participant" title="Edit participant" data-participant-id="${p.id}" data-event-id="${eventId}"><i class="fas fa-edit"></i></button>
        <button class="btn-icon danger btn-delete-participant" title="Delete participant" data-participant-id="${p.id}" data-event-id="${eventId}"><i class="fas fa-trash"></i></button>` : ''}
      </td>
    </tr>
  `).join('');

  const totalMale = participants.reduce((s, p) => s + p.registered_applicants_male, 0);
  const totalFemale = participants.reduce((s, p) => s + p.registered_applicants_female, 0);

  const html = `
    <p><strong>${e.organizer_name || 'N/A'}</strong> — ${formatJobFairDateRange(e.job_fair_date_start, e.job_fair_date_end)} at ${e.venue_name || 'N/A'}</p>
    <div class="participant-section">
      <h4>Participating Agencies (${participants.length})</h4>
      <table class="data-table compact">
        <thead>
          <tr>
            <th>Agency</th><th>JFA No.</th><th>Category</th>
            <th>Male</th><th>Female</th><th>Total</th>
            <th>TR Male</th><th>TR Female</th><th>TR Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${partRows || '<tr><td colspan="10">No participants yet</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td colspan="3"><strong>GRAND TOTAL</strong></td>
            <td><strong>${totalMale}</strong></td>
            <td><strong>${totalFemale}</strong></td>
            <td><strong>${totalMale + totalFemale}</strong></td>
            <td colspan="4"></td>
          </tr>
        </tfoot>
      </table>

      ${canWrite ? `<h4 style="margin-top:16px">Add Participant</h4>
      <div class="form-row-3">
        <div class="form-group">
          <label>Agency</label>
          <select class="form-select" id="fPartAgency">${agencyOpts}</select>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select class="form-select" id="fPartCat">
            <option value="land-based">Land-Based</option>
            <option value="sea-based">Sea-Based</option>
          </select>
        </div>
        <div class="form-group">
          <label>JFA No. (optional)</label>
          <input class="form-input" id="fPartJfa" placeholder="BUT-26-0203-002">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Reg. Male</label>
          <input class="form-input" type="number" id="fPartMale" value="0">
        </div>
        <div class="form-group">
          <label>Reg. Female</label>
          <input class="form-input" type="number" id="fPartFemale" value="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Terminal Report Male</label>
          <input class="form-input" type="number" id="fPartTrMale" value="0">
        </div>
        <div class="form-group">
          <label>Terminal Report Female</label>
          <input class="form-input" type="number" id="fPartTrFemale" value="0">
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;">
        <button type="button" class="btn btn-primary" id="btnAddParticipant" data-event-id="${eventId}">Add Participant</button>
      </div>` : '<p style="margin-top:14px;color:var(--text-muted)">Staff access is view-only.</p>'}
    </div>
  `;

  if (!canWrite) {
    openModal('Job Fair Event Details', html, null, 'modal-xl', true);
    setTimeout(() => attachParticipantEventListeners(), 100);
    return;
  }

  openModal('Job Fair Event Details', html, null, 'modal-xl', true);

  setTimeout(() => attachParticipantEventListeners(), 100);
}

async function addParticipantFromDetail(eventId) {
  if (!ensureCanWrite('add participants')) return;

  const agencyId = getFormInt('fPartAgency');
  if (!agencyId) {
    showToast('Select an agency', 'error');
    return;
  }

  try {
    await window.api.addParticipant({
      event_id: eventId,
      agency_id: agencyId,
      jfa_id: null,
      agency_category: getFormValue('fPartCat'),
      registered_applicants_male: getFormInt('fPartMale'),
      registered_applicants_female: getFormInt('fPartFemale'),
      terminal_report_male: getFormInt('fPartTrMale'),
      terminal_report_female: getFormInt('fPartTrFemale'),
    });

    showToast('Participant added', 'success');
    openJobFairDetail(eventId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function deleteParticipant(partId, eventId) {
  if (!ensureCanWrite('delete participants')) return;

  if (!confirm('Remove this participant?')) return;
  try {
    await window.api.deleteParticipant(partId);
    showToast('Participant removed', 'success');
    openJobFairDetail(eventId);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function openParticipantEditModal(partId, eventId) {
  if (!ensureCanWrite('edit participants')) return;

  try {
    const detail = await window.api.getJobFairById(eventId);
    const participant = detail.participants.find(p => p.id === partId);

    if (!participant) {
      showToast('Participant not found', 'error');
      return;
    }

    const agencies = await window.api.getAgencies();
    const selectableAgencies = agencies.filter(a =>
      a.agency_type === 'recruitment' || a.agency_type === 'sea-based'
    );

    const agencyOpts = selectableAgencies
      .map(a => `<option value="${a.id}" ${a.id === participant.agency_id ? 'selected' : ''}>${a.agency_name}</option>`)
      .join('');

    const html = `
      <div class="form-row-3">
        <div class="form-group">
          <label>Agency</label>
          <select class="form-select" id="fEditPartAgency">${agencyOpts}</select>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select class="form-select" id="fEditPartCat">
            <option value="land-based" ${participant.agency_category === 'land-based' ? 'selected' : ''}>Land-Based</option>
            <option value="sea-based" ${participant.agency_category === 'sea-based' ? 'selected' : ''}>Sea-Based</option>
          </select>
        </div>
        <div class="form-group">
          <label>JFA No. (optional)</label>
          <input class="form-input" id="fEditPartJfa" value="${participant.jfa_no || ''}" placeholder="BUT-26-0203-002">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Reg. Male</label>
          <input class="form-input" type="number" id="fEditPartMale" value="${participant.registered_applicants_male || 0}">
        </div>
        <div class="form-group">
          <label>Reg. Female</label>
          <input class="form-input" type="number" id="fEditPartFemale" value="${participant.registered_applicants_female || 0}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Terminal Report Male</label>
          <input class="form-input" type="number" id="fEditPartTrMale" value="${participant.terminal_report_male || 0}">
        </div>
        <div class="form-group">
          <label>Terminal Report Female</label>
          <input class="form-input" type="number" id="fEditPartTrFemale" value="${participant.terminal_report_female || 0}">
        </div>
      </div>
    `;

    openModal('Edit Participant', html, async () => {
      const agencyId = getFormInt('fEditPartAgency');
      if (!agencyId) {
        showToast('Select an agency', 'error');
        return;
      }

      try {
        await window.api.updateParticipant({
          id: partId,
          agency_id: agencyId,
          jfa_id: null,
          agency_category: getFormValue('fEditPartCat'),
          registered_applicants_male: getFormInt('fEditPartMale'),
          registered_applicants_female: getFormInt('fEditPartFemale'),
          terminal_report_male: getFormInt('fEditPartTrMale'),
          terminal_report_female: getFormInt('fEditPartTrFemale'),
        });

        showToast('Participant updated', 'success');
        openJobFairDetail(eventId);
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  } catch (err) {
    showToast('Failed to load participant details', 'error');
  }
}

function attachParticipantEventListeners() {
  const addBtn = document.getElementById('btnAddParticipant');
  if (addBtn && addBtn.dataset.bound !== 'true') {
    addBtn.addEventListener('click', () => {
      const eventId = parseInt(addBtn.dataset.eventId, 10);
      if (!Number.isNaN(eventId)) {
        addParticipantFromDetail(eventId);
      }
    });
    addBtn.dataset.bound = 'true';
  }

  document.querySelectorAll('.btn-edit-participant').forEach(btn => {
    btn.addEventListener('click', () => {
      const participantId = parseInt(btn.dataset.participantId);
      const eventId = parseInt(btn.dataset.eventId);
      openParticipantEditModal(participantId, eventId);
    });
  });

  document.querySelectorAll('.btn-delete-participant').forEach(btn => {
    btn.addEventListener('click', () => {
      const participantId = parseInt(btn.dataset.participantId);
      const eventId = parseInt(btn.dataset.eventId);
      deleteParticipant(participantId, eventId);
    });
  }, 'modal-jobfair-event');
}

async function deleteJobFair(id) {
  if (!ensureCanWrite('delete job fair events')) return;

  if (!confirm('Delete this job fair event and all its participants?')) return;
  try {
    await window.api.deleteJobFairEvent(id);
    showToast('Event deleted', 'success');
    loadJobFairReport();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================================================
// MONITORING
// ============================================================================
function renderMonitoringEvidenceLinks(evidencePath) {
  const value = String(evidencePath || '').trim();
  if (!value) return '-';

  const paths = value
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);

  if (!paths.length) return '-';

  return paths.map((pathValue) => {
    const normalized = pathValue.replace(/[\\/]+$/, '');
    const parts = normalized.split(/[\\/]/).filter(Boolean);
    const displayName = parts.length ? parts[parts.length - 1] : pathValue;
    const encodedPath = encodeURIComponent(pathValue);
    return `<button type="button" class="mon-evidence-link" data-path="${encodedPath}" title="${pathValue}">${displayName}</button>`;
  }).join('<br>');
}

async function loadMonitoring() {
  const filters = {
    fiscal_year: getFormValue('monFilterYear') || undefined,
    month: getFormValue('monFilterMonth') || undefined,
  };

  try {
    const canWrite = canCurrentUserWrite();
    const records = await window.api.getMonitoringRecords(filters);
    const recordsById = new Map(records.map((record) => [Number(record.id), record]));
    const tbody = document.getElementById('monTableBody');
    tbody.innerHTML = records.map(r => `
      <tr data-monitoring-id="${r.id}">
        <td>${r.implementing_agency || '-'}</td>
        <td>${formatJobFairDateRange(r.job_fair_date_start, r.job_fair_date_end)}</td>
        <td>${r.venue_name || '-'}</td>
        <td>${r.celebration_event || '-'}</td>
        <td>${checklistCell(r.job_fair_monitoring, canWrite, r.id, 'job_fair_monitoring')}</td>
        <td>${checklistCell(r.conduct_of_peos, canWrite, r.id, 'conduct_of_peos')}</td>
        <td>${formatDate(r.communication_letter_received)}</td>
        <td>${formatDate(r.invitation_emailed)}</td>
        <td>${formatDate(r.confirmation_deadline)}</td>
        <td>${formatDate(r.transmittal_letter_date)}</td>
        <td>${renderMonitoringEvidenceLinks(r.evidence_path)}</td>
        <td>${r.monitored_by || '-'}</td>
        <td>${r.remarks || '-'}</td>
        <td class="actions-cell">
          ${canWrite
            ? `<button class="btn-icon btn-edit-monitoring" data-id="${r.id}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger btn-delete-monitoring" data-id="${r.id}" title="Delete"><i class="fas fa-trash"></i></button>`
            : '<span style="color:var(--text-muted)">View only</span>'}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="14">No monitoring records found</td></tr>';

    // Attach event listeners
    document.querySelectorAll('.btn-edit-monitoring').forEach(btn => {
      btn.addEventListener('click', () => openMonitoringForm(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.btn-delete-monitoring').forEach(btn => {
      btn.addEventListener('click', () => deleteMonitoring(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.mon-evidence-link').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const encoded = btn.dataset.path || '';
        const targetPath = decodeURIComponent(encoded);
        if (!targetPath) return;

        try {
          const result = await window.api.openMonitoringEvidencePath(targetPath);
          if (!result?.success) {
            const msg = result?.error || 'Unable to open evidence file';
            if (msg.includes('directory') || msg.includes('folder')) {
              showToast('Evidence path is a folder — only individual files can be opened remotely.', 'warning');
            } else if (msg.includes('not found') || msg.includes('File not found')) {
              showToast('Evidence file not found on the server. It may have been moved or deleted.', 'error');
            } else {
              showToast('Unable to open evidence file: ' + msg, 'error');
            }
          } else {
            showToast('Evidence file downloaded and opened.', 'success');
          }
        } catch (err) {
          showToast('Unable to open evidence path: ' + err.message, 'error');
        }
      });
    });

    if (canWrite) {
      document.querySelectorAll('.mon-check-toggle').forEach((checkbox) => {
        checkbox.addEventListener('change', async () => {
          const id = Number(checkbox.dataset.id);
          const field = checkbox.dataset.field;
          const record = recordsById.get(id);

          if (!record || (field !== 'job_fair_monitoring' && field !== 'conduct_of_peos')) {
            return;
          }

          const nextValue = checkbox.checked;
          checkbox.disabled = true;

          try {
            await window.api.updateMonitoring({
              id: record.id,
              implementing_agency_id: record.implementing_agency_id,
              venue_id: record.venue_id || null,
              fiscal_year: Number(record.fiscal_year),
              month: Number(record.month),
              job_fair_date_start: getMonitoringDateValue(record.job_fair_date_start),
              job_fair_date_end: getMonitoringDateValue(record.job_fair_date_end),
              celebration_event: record.celebration_event || null,
              job_fair_monitoring: field === 'job_fair_monitoring' ? nextValue : isCheckedValue(record.job_fair_monitoring),
              conduct_of_peos: field === 'conduct_of_peos' ? nextValue : isCheckedValue(record.conduct_of_peos),
              communication_letter_received: getMonitoringDateValue(record.communication_letter_received),
              invitation_emailed: getMonitoringDateValue(record.invitation_emailed),
              confirmation_deadline: getMonitoringDateValue(record.confirmation_deadline),
              transmittal_letter_date: getMonitoringDateValue(record.transmittal_letter_date),
              evidence_path: record.evidence_path || null,
              monitored_by: record.monitored_by || null,
              remarks: record.remarks || null,
            });

            record[field] = nextValue;
          } catch (err) {
            checkbox.checked = !nextValue;
            showToast('Failed to update checklist: ' + err.message, 'error');
          } finally {
            checkbox.disabled = false;
          }
        });
      });
    }

    setupActivityHighlightDismissal('#monTableBody');
  } catch (err) {
    console.error(err);
    showToast('Failed to load monitoring records', 'error');
  }
}

async function openMonitoringForm(id = null) {
  if (!ensureCanWrite('add or edit monitoring records')) return;

  try {
    const agencies = await window.api.getAgencies();
    const venues = await window.api.getVenues();
    let rec = null;
    if (id) {
      rec = await window.api.getMonitoringById(id);
    }

  const isEdit = Boolean(id);

  const agencyOpts = `<option value="">-- Select --</option>` + agencies.map(a =>
    `<option value="${a.id}" ${rec && rec.implementing_agency_id === a.id ? 'selected' : ''}>${a.agency_name}</option>`
  ).join('');
  const venueOpts = `<option value="">-- Select --</option>` + venues.map(v =>
    `<option value="${v.id}" ${rec && rec.venue_id === v.id ? 'selected' : ''}>${v.venue_name}</option>`
  ).join('');

  const checklistHtml = !isEdit ? `
    <div class="form-row">
      <div class="form-group">
        <label>Job Fair Monitoring</label>
        <label class="form-checklist-label">
          <input type="checkbox" id="fMonJobFairMonitoring">
          <span>Checked / Completed</span>
        </label>
      </div>
      <div class="form-group">
        <label>Conduct of PEOS</label>
        <label class="form-checklist-label">
          <input type="checkbox" id="fMonConductPeos">
          <span>Checked / Completed</span>
        </label>
      </div>
    </div>
  ` : '';

  const html = `
    <div class="form-row">
      <div class="form-group">
        <label>Implementing Agency</label>
        <select class="form-select" id="fMonAgency">${agencyOpts}</select>
      </div>
      <div class="form-group">
        <label>Venue</label>
        <select class="form-select" id="fMonVenue">${venueOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Job Fair Date</label>
        <input class="form-input" type="date" id="fMonDate" value="${formatDateForInput(rec?.job_fair_date_start)}">
      </div>
      <div class="form-group">
        <label>Celebration / Event</label>
        <input class="form-input" id="fMonEvent" value="${rec?.celebration_event || ''}">
      </div>
    </div>
    ${checklistHtml}
    <div class="form-row">
      <div class="form-group">
        <label>Comm. Letter Received</label>
        <input class="form-input" type="date" id="fMonComm" value="${formatDateForInput(rec?.communication_letter_received)}">
      </div>
      <div class="form-group">
        <label>Invitation Emailed</label>
        <input class="form-input" type="date" id="fMonInv" value="${formatDateForInput(rec?.invitation_emailed)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Confirmation Deadline</label>
        <input class="form-input" type="date" id="fMonConf" value="${formatDateForInput(rec?.confirmation_deadline)}">
      </div>
      <div class="form-group">
        <label>Transmittal Letter Date</label>
        <input class="form-input" type="date" id="fMonTrans" value="${formatDateForInput(rec?.transmittal_letter_date)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Monitored By</label>
        <input class="form-input" id="fMonMonitoredBy" value="${rec?.monitored_by || ''}">
      </div>
      <div class="form-group">
        <label>Evidence Path</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <div id="fMonEvidenceDropZone" style="border:2px dashed #ccc; border-radius:4px; padding:0 12px; text-align:center; cursor:pointer; background-color:#f9f9f9; transition:all 0.3s ease; height:40px; display:flex; align-items:center; justify-content:center; flex:1;">
            <div style="color:#666; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              <strong>Drag and drop files or folders here</strong> or <strong>click to browse</strong>
            </div>
            <div id="fMonEvidencePreview" style="font-size:12px; color:#0066cc; display:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
          </div>
          <button type="button" class="btn btn-secondary" id="fMonEvidenceDelete" style="display:none;">Delete</button>
        </div>
        <input class="form-input" id="fMonEvidenceCompact" value="${rec?.evidence_path || ''}" placeholder="Selected path(s) will appear here" style="display:none;">
      </div>
    </div>
    <div class="form-group">
      <label>Remarks</label>
      <textarea class="form-textarea" id="fMonRemarks">${rec?.remarks || ''}</textarea>
    </div>
  `;

  openModal(
    id ? 'Edit Monitoring Record' : 'Add Monitoring Record',
    html,
    async () => {
    const agencyId = getFormInt('fMonAgency');
    const dateStart = getFormValue('fMonDate');
    const sourceDate = dateStart ? new Date(dateStart) : null;
    const hasValidSourceDate = sourceDate && !Number.isNaN(sourceDate.getTime());
    const year = hasValidSourceDate ? sourceDate.getFullYear() : Number(rec?.fiscal_year) || new Date().getFullYear();
    const month = hasValidSourceDate ? sourceDate.getMonth() + 1 : Number(rec?.month) || (new Date().getMonth() + 1);

    if (!agencyId) { showToast('Implementing Agency is required', 'error'); return; }
    if (!dateStart) { showToast('Job Fair Date is required', 'error'); return; }

    const jobFairMonitoringValue = isEdit
      ? isCheckedValue(rec?.job_fair_monitoring)
      : Boolean(document.getElementById('fMonJobFairMonitoring')?.checked);
    const conductPeosValue = isEdit
      ? isCheckedValue(rec?.conduct_of_peos)
      : Boolean(document.getElementById('fMonConductPeos')?.checked);

    const baseData = {
      implementing_agency_id: agencyId,
      venue_id: getFormValue('fMonVenue') ? getFormInt('fMonVenue') : null,
      fiscal_year: year,
      month,
      job_fair_date_start: dateStart,
      celebration_event: getFormValue('fMonEvent') || null,
      job_fair_monitoring: jobFairMonitoringValue,
      conduct_of_peos: conductPeosValue,
      communication_letter_received: getFormValue('fMonComm') || null,
      invitation_emailed: getFormValue('fMonInv') || null,
      confirmation_deadline: getFormValue('fMonConf') || null,
      transmittal_letter_date: getFormValue('fMonTrans') || null,
      evidence_path: getFormValue('fMonEvidenceCompact') || null,
      monitored_by: getFormValue('fMonMonitoredBy') || null,
      remarks: getFormValue('fMonRemarks') || null,
    };

    try {
      if (id) {
        await window.api.updateMonitoring({ ...baseData, id });
      } else {
        await window.api.createMonitoring(baseData);
      }
      closeModal();
      showToast(id ? 'Record updated' : 'Record created', 'success');
      loadMonitoring();
      await refreshTopbarNotifications();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
    },
    'modal-monitoring-add'
  );

  const evidenceInput = document.getElementById('fMonEvidenceCompact');
  const dropZone = document.getElementById('fMonEvidenceDropZone');
  const preview = document.getElementById('fMonEvidencePreview');
  const deleteBtn = document.getElementById('fMonEvidenceDelete');

  // Helper function to update evidence path
  const updateEvidencePath = (paths) => {
    if (paths && paths.length > 0) {
      evidenceInput.value = paths.join('; ');
      const lastPath = paths[paths.length - 1];
      const fileName = lastPath.split('\\').pop().split('/').pop() || lastPath;
      preview.textContent = fileName + (paths.length > 1 ? ` (+${paths.length - 1} more)` : '');
      preview.style.display = 'inline';
      dropZone.querySelector('div').style.display = 'none';
      deleteBtn.style.display = 'block';
    }
  };

  // Helper function to clear evidence path
  const clearEvidencePath = () => {
    evidenceInput.value = '';
    preview.textContent = '';
    preview.style.display = 'none';
    dropZone.querySelector('div').style.display = 'block';
    deleteBtn.style.display = 'none';
  };

  // Helper function to process dropped files/folders
  const processDroppedFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    
    try {
      // Collect file paths
      const paths = [];
      for (let file of fileList) {
        paths.push(file.path);
      }
      updateEvidencePath(paths);
    } catch (err) {
      showToast('Failed to process files: ' + err.message, 'error');
    }
  };

  // Drag and drop handlers
  if (dropZone && evidenceInput) {
    // Handle drag over
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.backgroundColor = '#e8f0ff';
      dropZone.style.borderColor = '#0066cc';
    });

    // Handle drag leave
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.backgroundColor = '#f9f9f9';
      dropZone.style.borderColor = '#ccc';
    });

    // Handle drop
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.backgroundColor = '#f9f9f9';
      dropZone.style.borderColor = '#ccc';

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        await processDroppedFiles(files);
      }
    });

    // Handle click to open file picker
    dropZone.addEventListener('click', async () => {
      try {
        const result = await window.api.pickMonitoringEvidencePath('both');
        if (!result || result.canceled || !Array.isArray(result.paths) || result.paths.length === 0) {
          return;
        }
        updateEvidencePath(result.paths);
      } catch (err) {
        showToast('Failed to pick files/folders: ' + err.message, 'error');
      }
    });

    // Initialize preview if evidence path already exists
    if (evidenceInput.value) {
      const paths = evidenceInput.value.split('; ').filter(p => p.trim());
      if (paths.length > 0) {
        const lastPath = paths[paths.length - 1];
        const fileName = lastPath.split('\\').pop().split('/').pop() || lastPath;
        preview.textContent = fileName + (paths.length > 1 ? ` (+${paths.length - 1} more)` : '');
        preview.style.display = 'inline';
        dropZone.querySelector('div').style.display = 'none';
        deleteBtn.style.display = 'block';
      }
    }

    // Handle delete button
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        clearEvidencePath();
      });
    }
  }
  } catch (err) {
    showToast('Error loading monitoring form: ' + err.message, 'error');
  }
}

async function deleteMonitoring(id) {
  if (!ensureCanWrite('delete monitoring records')) return;

  if (!confirm('Delete this monitoring record?')) return;
  try {
    await window.api.deleteMonitoring(id);
    showToast('Record deleted', 'success');
    loadMonitoring();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================================================
// SUMMARIES
// ============================================================================
async function loadSummaries() {
  const year = getFormInt('sumYear') || 2025;

  try {
    const [jfaSummary, jfSummary] = await Promise.all([
      window.api.getJfaSummary(year),
      window.api.getJobFairSummary(year),
    ]);

    // JFA Summary
    const jfaBody = document.getElementById('sumJfaBody');
    let jfaTotalIssued = 0, jfaTotalCompleted = 0, jfaTotalCancelled = 0, jfaTotalNp = 0, jfaTotalActive = 0;

    const jfaJanJunTotals = { issued: 0, completed: 0, cancelled: 0, np: 0, active: 0 };
    const jfaJulDecTotals = { issued: 0, completed: 0, cancelled: 0, np: 0, active: 0 };
    const parseSummaryInt = (value) => Number.parseInt(value, 10) || 0;
    const buildJfaSubtotalRow = (label, totals) => `
      <tr class="summary-subtotal-row">
        <td><strong>${label}</strong></td>
        <td><strong>${totals.issued}</strong></td>
        <td><strong>${totals.completed}</strong></td>
        <td><strong>${totals.cancelled}</strong></td>
        <td><strong>${totals.np}</strong></td>
        <td><strong>${totals.active}</strong></td>
      </tr>
    `;

    const jfaRows = [];
    let janJunSubtotalInserted = false;
    let hasJanJunData = false;
    for (const r of jfaSummary) {
      const issued = parseSummaryInt(r.total_jfa_issued);
      const completed = parseSummaryInt(r.completed);
      const cancelled = parseSummaryInt(r.cancelled);
      const notParticipated = parseSummaryInt(r.not_participated);
      const active = parseSummaryInt(r.active);
      const month = parseSummaryInt(r.month);

      jfaTotalIssued += issued;
      jfaTotalCompleted += completed;
      jfaTotalCancelled += cancelled;
      jfaTotalNp += notParticipated;
      jfaTotalActive += active;

      const targetTotals = month >= 1 && month <= 6 ? jfaJanJunTotals : jfaJulDecTotals;
      targetTotals.issued += issued;
      targetTotals.completed += completed;
      targetTotals.cancelled += cancelled;
      targetTotals.np += notParticipated;
      targetTotals.active += active;
      if (month >= 1 && month <= 6) {
        hasJanJunData = true;
      }

      jfaRows.push(`<tr>
        <td>${r.month_name?.trim()}</td>
        <td><strong>${issued}</strong></td>
        <td>${completed}</td>
        <td>${cancelled}</td>
        <td>${notParticipated}</td>
        <td>${active}</td>
      </tr>`);

      // Place JAN-JUN subtotal directly below June.
      if (!janJunSubtotalInserted && hasJanJunData && (month === 6 || month > 6)) {
        jfaRows.push(buildJfaSubtotalRow('SUBTOTAL (JAN-JUN)', jfaJanJunTotals));
        janJunSubtotalInserted = true;
      }
    }

    if (!janJunSubtotalInserted) {
      jfaRows.push(buildJfaSubtotalRow('SUBTOTAL (JAN-JUN)', jfaJanJunTotals));
    }

    jfaBody.innerHTML = jfaRows.length
      ? `${jfaRows.join('')}
         ${buildJfaSubtotalRow('SUBTOTAL (JUL-DEC)', jfaJulDecTotals)}`
      : `<tr><td colspan="6">No data for ${year}</td></tr>`;

    document.getElementById('sumJfaFoot').innerHTML = `
      <tr>
        <td><strong>TOTAL</strong></td>
        <td><strong>${jfaTotalIssued}</strong></td>
        <td><strong>${jfaTotalCompleted}</strong></td>
        <td><strong>${jfaTotalCancelled}</strong></td>
        <td><strong>${jfaTotalNp}</strong></td>
        <td><strong>${jfaTotalActive}</strong></td>
      </tr>
    `;

    // Job Fair Summary
    const jfBody = document.getElementById('sumJfBody');
    let totalFairs = 0, totalMale = 0, totalFemale = 0, totalApp = 0, totalLand = 0, totalSea = 0, totalAg = 0;

    const jfJanJunTotals = { fairs: 0, male: 0, female: 0, app: 0, land: 0, sea: 0, ag: 0 };
    const jfJulDecTotals = { fairs: 0, male: 0, female: 0, app: 0, land: 0, sea: 0, ag: 0 };

    const buildJfSubtotalRow = (label, totals) => `
      <tr class="summary-subtotal-row">
        <td><strong>${label}</strong></td>
        <td><strong>${totals.fairs}</strong></td>
        <td><strong>${totals.male}</strong></td>
        <td><strong>${totals.female}</strong></td>
        <td><strong>${totals.app}</strong></td>
        <td><strong>${totals.land}</strong></td>
        <td><strong>${totals.sea}</strong></td>
        <td><strong>${totals.ag}</strong></td>
      </tr>
    `;

    const jfRows = [];
    let jfJanJunSubtotalInserted = false;
    let jfHasJanJunData = false;

    const jfSummaryArray = Array.isArray(jfSummary) ? jfSummary : [];
    for (const r of jfSummaryArray) {
      const fairs = parseInt(r.num_job_fairs) || 0;
      const male = parseInt(r.total_male_applicants) || 0;
      const female = parseInt(r.total_female_applicants) || 0;
      const app = parseInt(r.total_applicants) || 0;
      const land = parseInt(r.land_based_agencies) || 0;
      const sea = parseInt(r.sea_based_agencies) || 0;
      const ag = parseInt(r.total_participating_agencies) || 0;
      const month = parseInt(r.month) || 0;

      totalFairs += fairs;
      totalMale += male;
      totalFemale += female;
      totalApp += app;
      totalLand += land;
      totalSea += sea;
      totalAg += ag;

      const targetTotals = month >= 1 && month <= 6 ? jfJanJunTotals : jfJulDecTotals;
      targetTotals.fairs += fairs;
      targetTotals.male += male;
      targetTotals.female += female;
      targetTotals.app += app;
      targetTotals.land += land;
      targetTotals.sea += sea;
      targetTotals.ag += ag;

      if (month >= 1 && month <= 6) {
        jfHasJanJunData = true;
      }

      jfRows.push(`<tr>
        <td>${r.month_name?.trim()}</td>
        <td>${fairs}</td>
        <td>${male}</td>
        <td>${female}</td>
        <td><strong>${app}</strong></td>
        <td>${land}</td>
        <td>${sea}</td>
        <td>${ag}</td>
      </tr>`);

      // Place JAN-JUN subtotal directly below June
      if (!jfJanJunSubtotalInserted && jfHasJanJunData && (month === 6 || month > 6)) {
        jfRows.push(buildJfSubtotalRow('SUBTOTAL (JAN-JUN)', jfJanJunTotals));
        jfJanJunSubtotalInserted = true;
      }
    }

    if (!jfJanJunSubtotalInserted && jfHasJanJunData) {
      jfRows.push(buildJfSubtotalRow('SUBTOTAL (JAN-JUN)', jfJanJunTotals));
    }

    jfBody.innerHTML = jfRows.length
      ? `${jfRows.join('')}
         ${buildJfSubtotalRow('SUBTOTAL (JUL-DEC)', jfJulDecTotals)}`
      : `<tr><td colspan="8">No data for ${year}</td></tr>`;

    document.getElementById('sumJfFoot').innerHTML = `
      <tr>
        <td><strong>TOTAL</strong></td>
        <td><strong>${totalFairs}</strong></td>
        <td><strong>${totalMale}</strong></td>
        <td><strong>${totalFemale}</strong></td>
        <td><strong>${totalApp}</strong></td>
        <td><strong>${totalLand}</strong></td>
        <td><strong>${totalSea}</strong></td>
        <td><strong>${totalAg}</strong></td>
      </tr>
    `;
  } catch (err) {
    console.error(err);
    showToast('Failed to load summaries', 'error');
  }
}

// ============================================================================
// AGENCIES
// ============================================================================
async function loadAgencies() {
  try {
    const canWrite = canCurrentUserWrite();
    const agencies = await window.api.getAgencies();
    const tbody = document.getElementById('agencyTableBody');
    tbody.innerHTML = agencies.map((a) => {
      const typeLabel = a.agency_type || 'other';
      const statusClass = a.is_active ? 'agency-status-pill active' : 'agency-status-pill inactive';
      const statusLabel = a.is_active ? '🟢 Active' : '🔴Inactive';

      return `
      <tr>
        <td>${a.id}</td>
        <td>${a.agency_name}</td>
        <td>${typeLabel}</td>
        <td><span class="${statusClass}">${statusLabel}</span></td>
        <td class="actions-cell">
          ${canWrite
            ? `<button class="btn-icon btn-edit-agency" data-id="${a.id}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger btn-delete-agency" data-id="${a.id}" title="Delete"><i class="fas fa-trash"></i></button>`
            : '<span style="color:var(--text-muted)">View only</span>'}
        </td>
      </tr>
    `;
    }).join('') || '<tr><td colspan="5">No agencies found</td></tr>';

    // Attach Agency event listeners
    document.querySelectorAll('.btn-edit-agency').forEach(btn => {
      btn.addEventListener('click', () => openAgencyForm(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.btn-delete-agency').forEach(btn => {
      btn.addEventListener('click', () => deleteAgency(parseInt(btn.dataset.id)));
    });
  } catch (err) {
    showToast('Failed to load agencies', 'error');
  }
}

async function openAgencyForm(id = null) {
  if (!ensureCanWrite('add or edit agencies')) return;

  let agency = null;
  if (id) {
    agency = await window.api.getAgencyById(id);
  }

  const html = `
    <div class="form-group">
      <label>Agency Name</label>
      <input class="form-input" id="fAgName" value="${agency?.agency_name || ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Type</label>
        <input class="form-input" id="fAgType" value="${agency?.agency_type || ''}" placeholder="e.g. recruitment, lgu, school">
      </div>
      <div class="form-group">
        <label>Active</label>
        <select class="form-select" id="fAgActive">
          <option value="true" ${agency?.is_active !== false ? 'selected' : ''}>Active</option>
          <option value="false" ${agency?.is_active === false ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    </div>
  `;

  openModal(id ? 'Edit Agency' : 'Add Agency', html, async () => {
    const agencyName = getFormValue('fAgName');
    const agencyType = getFormValue('fAgType') || 'other';
    if (!agencyName) { showToast('Agency Name is required', 'error'); return; }

    const baseData = {
      agency_name: agencyName,
      agency_type: agencyType,
      is_active: getFormValue('fAgActive') === 'true',
    };

    try {
      if (id) {
        await window.api.updateAgency({ ...baseData, id });
      } else {
        await window.api.createAgency(baseData);
      }
      closeModal();
      showToast(id ? 'Agency updated' : 'Agency created', 'success');
      loadAgencies();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

async function deleteAgency(id) {
  if (!ensureCanWrite('delete agencies')) return;

  if (!confirm('Delete this agency? This may fail if it has linked records.')) return;
  try {
    await window.api.deleteAgency(id);
    showToast('Agency deleted', 'success');
    loadAgencies();
  } catch (err) {
    showToast('Cannot delete: agency has linked records', 'error');
  }
}

// ============================================================================
// VENUES
// ============================================================================
async function loadVenues() {
  try {
    const canWrite = canCurrentUserWrite();
    const venues = await window.api.getVenues();
    const tbody = document.getElementById('venueTableBody');
    tbody.innerHTML = venues.map(v => `
      <tr>
        <td>${v.id}</td>
        <td>${v.venue_name}</td>
        <td>${v.city_municipality || '-'}</td>
        <td>${v.province || '-'}</td>
        <td>${v.region || '-'}</td>
        <td class="actions-cell">
          ${canWrite
            ? `<button class="btn-icon btn-edit-venue" data-id="${v.id}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon danger btn-delete-venue" data-id="${v.id}" title="Delete"><i class="fas fa-trash"></i></button>`
            : '<span style="color:var(--text-muted)">View only</span>'}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6">No venues found</td></tr>';

    // Attach Venue event listeners
    document.querySelectorAll('.btn-edit-venue').forEach(btn => {
      btn.addEventListener('click', () => openVenueForm(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.btn-delete-venue').forEach(btn => {
      btn.addEventListener('click', () => deleteVenue(parseInt(btn.dataset.id)));
    });
  } catch (err) {
    showToast('Failed to load venues', 'error');
  }
}

async function openVenueForm(id = null) {
  if (!ensureCanWrite('add or edit venues')) return;

  let venue = null;
  if (id) {
    venue = await window.api.getVenueById(id);
  }

  const caragaMunicipalitiesByProvince = {
    'Agusan del Norte': [
      'Buenavista',
      'Butuan City',
      'Cabadbaran City',
      'Carmen',
      'Jabonga',
      'Kitcharao',
      'Las Nieves',
      'Magallanes',
      'Nasipit',
      'Santiago',
      'Tubay',
      'Remedios T. Romualdez',
    ],
    'Agusan del Sur': [
      'Bayugan City',
      'Bunawan',
      'Esperanza',
      'La Paz',
      'Loreto',
      'Prosperidad',
      'Rosario',
      'San Francisco',
      'San Luis',
      'Santa Josefa',
      'Sibagat',
      'Talacogon',
      'Trento',
      'Veruela',
    ],
    'Surigao del Norte': [
      'Alegria',
      'Bacuag',
      'Burgos',
      'Claver',
      'Dapa',
      'Del Carmen',
      'General Luna',
      'Gigaquit',
      'Mainit',
      'Malimono',
      'Pilar',
      'Placer',
      'San Benito',
      'San Francisco',
      'San Isidro',
      'Santa Monica',
      'Sison',
      'Socorro',
      'Surigao City',
      'Tagana-an',
      'Tubod',
    ],
    'Surigao del Sur': [
      'Barobo',
      'Bayabas',
      'Bislig City',
      'Cagwait',
      'Cantilan',
      'Carmen',
      'Cortes',
      'Hinatuan',
      'Lanuza',
      'Lianga',
      'Lingig',
      'Madrid',
      'Marihatag',
      'San Agustin',
      'San Miguel',
      'Tagbina',
      'Tago',
      'Tandag City',
    ],
    'Dinagat Islands': [
      'Basilisa',
      'Cagdianao',
      'Dinagat',
      'Libjo',
      'Loreto',
      'San Jose',
      'Tubajon',
    ],
  };

  const provinceOptions = Object.keys(caragaMunicipalitiesByProvince);

  const getMunicipalityOptions = (province) => {
    return caragaMunicipalitiesByProvince[province] || [];
  };

  const selectedProvince = String(venue?.province || '').trim();
  const selectedCity = String(venue?.city_municipality || '').trim();
  const cityOptions = selectedProvince ? getMunicipalityOptions(selectedProvince) : [];

  const citySelectOptions = ['<option value="">-- Select City/Municipality --</option>',
    ...cityOptions.map((city) => `<option value="${city}" ${selectedCity === city ? 'selected' : ''}>${city}</option>`),
  ].join('');

  const provinceSelectOptions = ['<option value="">-- Select Province --</option>',
    ...provinceOptions.map((province) => `<option value="${province}" ${selectedProvince === province ? 'selected' : ''}>${province}</option>`),
  ].join('');

  const html = `
    <div class="form-group">
      <label>Venue Name</label>
      <input class="form-input" id="fVnName" value="${venue?.venue_name || ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Province</label>
        <select class="form-select" id="fVnProv">${provinceSelectOptions}</select>
      </div>
      <div class="form-group">
        <label>City / Municipality</label>
        <select class="form-select" id="fVnCity" ${selectedProvince ? '' : 'disabled'}>${citySelectOptions}</select>
      </div>
    </div>
  `;

  const renderCitySelect = (province, selected = '') => {
    const citySelect = document.getElementById('fVnCity');
    if (!citySelect) return;

    const options = province ? getMunicipalityOptions(province) : [];
    citySelect.innerHTML = ['<option value="">-- Select City/Municipality --</option>',
      ...options.map((city) => `<option value="${city}" ${selected === city ? 'selected' : ''}>${city}</option>`),
    ].join('');
    citySelect.disabled = !province;
  };

  openModal(id ? 'Edit Venue' : 'Add Venue', html, async () => {
    // Validate required fields
    const venueName = getFormValue('fVnName');
    const province = getFormValue('fVnProv');
    const cityMunicipality = getFormValue('fVnCity');
    if (!venueName) { showToast('Venue Name is required', 'error'); return; }
    if (!province) { showToast('Province is required', 'error'); return; }
    if (!cityMunicipality) { showToast('City/Municipality is required', 'error'); return; }

    const baseData = {
      venue_name: venueName,
      city_municipality: cityMunicipality,
      province,
      region: venue?.region || 'CARAGA',
    };

    try {
      if (id) {
        await window.api.updateVenue({ ...baseData, id });
      } else {
        await window.api.createVenue(baseData);
      }
      closeModal();
      showToast(id ? 'Venue updated' : 'Venue created', 'success');
      loadVenues();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  const provinceSelect = document.getElementById('fVnProv');
  if (provinceSelect) {
    provinceSelect.addEventListener('change', () => {
      renderCitySelect(provinceSelect.value || '', '');
    });
  }
}

async function deleteVenue(id) {
  if (!ensureCanWrite('delete venues')) return;

  if (!confirm('Delete this venue?')) return;
  try {
    await window.api.deleteVenue(id);
    showToast('Venue deleted', 'success');
    loadVenues();
  } catch (err) {
    showToast('Cannot delete: venue has linked records', 'error');
  }
}

// ============================================================================
// USERS
// ============================================================================
async function loadUsers() {
  if (!sessionToken) {
    showToast('Please login first', 'error');
    return;
  }

  if (currentUser?.role !== 'admin') {
    showToast('Only admins can view users', 'error');
    return;
  }

  try {
    const users = await window.api.getUsers(sessionToken);
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    const toBoolean = (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      const normalized = String(value || '').trim().toLowerCase();
      return ['true', 't', '1', 'yes', 'y', 'on'].includes(normalized);
    };

    tbody.innerHTML = users.map((user) => {
      const isActive = toBoolean(user.is_active);
      return `
      <tr>
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.full_name}</td>
        <td><span class="badge badge-${user.role === 'admin' ? 'completed' : 'active'}">${user.role}</span></td>
        <td><span class="user-status-pill ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
        <td>${formatDate(user.created_at)}</td>
        <td class="actions-cell">
          <button class="btn-icon btn-user-edit-role" data-id="${user.id}" data-role="${user.role}" data-active="${isActive ? 'true' : 'false'}" data-name="${user.full_name}" title="Edit role and status">
            <i class="fas fa-user-cog"></i>
          </button>
          <button class="btn-icon danger btn-user-delete" data-id="${user.id}" data-name="${user.full_name}" title="Delete user">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
    }).join('') || '<tr><td colspan="7">No users found</td></tr>';

    tbody.querySelectorAll('.btn-user-edit-role').forEach((btn) => {
      btn.addEventListener('click', () => {
        const userId = Number.parseInt(btn.dataset.id || '', 10);
        const currentRole = String(btn.dataset.role || 'staff');
        const isActive = String(btn.dataset.active || 'true') === 'true';
        const fullName = btn.dataset.name || 'User';
        openUserRoleForm(userId, fullName, currentRole, isActive);
      });
    });

    tbody.querySelectorAll('.btn-user-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const userId = Number.parseInt(btn.dataset.id || '', 10);
        const fullName = btn.dataset.name || 'User';
        openDeleteUserConfirm(userId, fullName);
      });
    });
  } catch (err) {
    showToast('Failed to load users: ' + err.message, 'error');
  }
}

function openUserRoleForm(userId, fullName, currentRole, isActive) {
  if (!ensureCanWrite('edit user access settings')) return;

  const html = `
    <div class="form-group">
      <label>User</label>
      <input class="form-input" value="${fullName}" disabled>
    </div>
    <div class="form-group">
      <label>Role</label>
      <select id="fUserRole" class="form-select">
        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
        <option value="staff" ${currentRole === 'staff' ? 'selected' : ''}>Staff</option>
      </select>
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="fUserActive" class="form-select">
        <option value="true" ${isActive ? 'selected' : ''}>Active</option>
        <option value="false" ${!isActive ? 'selected' : ''}>Inactive</option>
      </select>
    </div>
  `;

  openModal('Edit User Access', html, async () => {
    const role = getFormValue('fUserRole');
    const activeValue = getFormValue('fUserActive');
    if (!role) {
      showToast('Role is required', 'error');
      return;
    }

    if (activeValue !== 'true' && activeValue !== 'false') {
      showToast('Status is required', 'error');
      return;
    }

    try {
      await window.api.updateUserRole({
        sessionToken,
        userId,
        role,
        isActive: activeValue === 'true',
      });
      closeModal();
      showToast('User access updated', 'success');
      await loadUsers();

      if (currentUser && currentUser.id === userId) {
        const refreshedUser = await window.api.getSessionUser(sessionToken);
        if (!refreshedUser) {
          showToast('Your account is now inactive. Please contact an administrator.', 'error');
          await handleLogout();
          return;
        }
        currentUser = refreshedUser;
        updateCurrentUserUI();
        applyRoleAccess();
      }
    } catch (err) {
      if (isMissingIpcHandlerError(err)) {
        showToast('App update detected. Please restart the application.', 'error');
        return;
      }
      showToast('Failed to update role: ' + err.message, 'error');
    }
  });
}

function openDeleteUserConfirm(userId, fullName) {
  if (!ensureCanWrite('delete users')) return;

  const html = `
    <p style="margin-bottom: 10px; color: #7f1d1d; font-weight: 600;">
      Delete user: <strong>${fullName}</strong>
    </p>
    <p style="margin-bottom: 12px; color: #666; font-size: 12px;">
      This action cannot be undone. Enter your password to confirm deletion.
    </p>
    <div class="form-group">
      <label>Admin Password</label>
      <input id="fDeleteUserPassword" class="form-input" type="password" placeholder="Enter your password">
    </div>
  `;

  openModal('Confirm Delete User', html, async () => {
    const adminPassword = document.getElementById('fDeleteUserPassword')?.value || '';
    if (!adminPassword) {
      showToast('Password is required', 'error');
      return;
    }

    try {
      await window.api.deleteUser({
        sessionToken,
        userId,
        adminPassword,
      });
      closeModal();
      showToast('User deleted', 'success');
      await loadUsers();
    } catch (err) {
      if (isMissingIpcHandlerError(err)) {
        showToast('App update detected. Please restart the application.', 'error');
        return;
      }
      showToast('Failed to delete user: ' + err.message, 'error');
    }
  });

  const modalSave = document.getElementById('modalSave');
  if (modalSave) {
    modalSave.textContent = 'Delete';
    modalSave.classList.remove('btn-primary');
    modalSave.classList.add('btn-danger');
  }
}
