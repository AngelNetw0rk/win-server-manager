// ═══════════════════════════════════════════
// App — Win Server Manager SPA
// ═══════════════════════════════════════════

const App = (() => {
  let currentPage = 'dashboard';
  let currentSoftId = null;
  let terminal = null;
  let fitAddon = null;
  let softsCache = [];
  let refreshInterval = null;

  // ─── Init ───
  function init() {
    if (API.isAuthenticated()) {
      showMain();
    } else {
      showLogin();
    }

    bindEvents();
    window.addEventListener('auth:expired', showLogin);
  }

  // ─── Toast ───
  function toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ─── Auth ───
  function showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('main-screen').classList.remove('active');
    stopRefresh();
    WS.disconnect();
  }

  function showMain() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    WS.connect();

    WS.on('ws:connected', () => {
      WS.subscribeMetrics();
      WS.subscribeGlobal();
    });

    WS.on('metrics', handleMetrics);
    WS.on('status:change', handleStatusChange);

    navigateTo('dashboard');
    startRefresh();
  }

  // ─── Events ───
  function bindEvents() {
    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const errorEl = document.getElementById('login-error');
      const btn = document.getElementById('login-btn');

      btn.disabled = true;
      btn.textContent = 'Signing in...';
      errorEl.textContent = '';

      try {
        const result = await API.login(username, password);
        API.setToken(result.token);
        showMain();
      } catch (err) {
        errorEl.textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      API.logout().catch(() => {});
      API.clearToken();
      showLogin();
    });

    // Navigation (sidebar)
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
      });
    });

    // Navigation (mobile)
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
      });
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
      navigateTo('dashboard');
    });

    // Scan
    document.getElementById('scan-btn').addEventListener('click', async () => {
      try {
        const result = await API.scan();
        toast(`Scan complete: ${result.discovered} new`, 'success');
        loadSofts();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Process controls
    document.getElementById('ctrl-start').addEventListener('click', () => controlSoft('start'));
    document.getElementById('ctrl-stop').addEventListener('click', () => controlSoft('stop'));
    document.getElementById('ctrl-restart').addEventListener('click', () => controlSoft('restart'));
    document.getElementById('ctrl-kill').addEventListener('click', () => controlSoft('kill'));
    document.getElementById('ctrl-reset').addEventListener('click', () => controlSoft('reset'));

    // Save soft settings
    document.getElementById('save-soft-settings').addEventListener('click', saveSoftSettings);

    // Terminal clear
    document.getElementById('term-clear').addEventListener('click', () => {
      if (terminal) terminal.clear();
    });

    // Settings: Add root path
    document.getElementById('add-root-path').addEventListener('click', addRootPath);
    document.getElementById('new-root-path').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addRootPath();
    });

    // Settings: Save timezone
    document.getElementById('save-timezone').addEventListener('click', async () => {
      const tz = document.getElementById('default-timezone').value.trim();
      if (!tz) return;
      try {
        await API.updateSetting('default_timezone', tz);
        toast('Timezone saved', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // ─── Navigation ───
  function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Update nav active state
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    currentPage = page;

    switch (page) {
      case 'dashboard':
        document.getElementById('page-dashboard').classList.add('active');
        loadSofts();
        break;
      case 'detail':
        document.getElementById('page-detail').classList.add('active');
        loadDetail(currentSoftId);
        break;
      case 'auth-logs':
        document.getElementById('page-auth-logs').classList.add('active');
        loadAuthLogs();
        break;
      case 'settings':
        document.getElementById('page-settings').classList.add('active');
        loadSettings();
        break;
    }
  }

  function openDetail(softId) {
    // Clean up previous terminal
    cleanupTerminal();
    currentSoftId = softId;
    navigateTo('detail');
  }

  // ─── Dashboard ───
  async function loadSofts() {
    try {
      softsCache = await API.getSofts();
      renderSofts(softsCache);
    } catch (err) {
      if (err.message !== 'Session expired') {
        toast('Failed to load software list', 'error');
      }
    }
  }

  function renderSofts(softs) {
    const grid = document.getElementById('softs-grid');

    if (!softs || softs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state glass-card">
          <p>No software discovered</p>
          <p class="text-muted">Add root paths in Settings, then click Scan</p>
        </div>`;
      return;
    }

    grid.innerHTML = softs.map(soft => {
      const statusClass = soft.status === 'running' ? 'status-running'
        : soft.status === 'frozen' ? 'status-frozen'
        : 'status-stopped';
      const statusIcon = soft.status === 'running' ? '🟢'
        : soft.status === 'frozen' ? 'FROZEN'
        : '🔴';
      const cpu = soft.processMetrics ? `${soft.processMetrics.cpu}%` : '—';
      const ram = soft.processMetrics ? formatBytes(soft.processMetrics.memRss) : '—';
      const uptime = soft.process ? formatUptime(soft.process.uptime) : '—';
      const nextRun = soft.nextRun ? formatTime(soft.nextRun) : '—';

      return `
        <div class="soft-card glass-card" data-id="${soft.id}">
          <div class="soft-card-header">
            <span class="soft-card-name">${escapeHtml(soft.name)}</span>
            <span class="status-badge ${statusClass}">${statusIcon}</span>
          </div>
          <div class="soft-card-metrics">
            <div class="soft-metric">
              <span class="soft-metric-label">CPU</span>
              <span class="soft-metric-value">${cpu}</span>
            </div>
            <div class="soft-metric">
              <span class="soft-metric-label">RAM</span>
              <span class="soft-metric-value">${ram}</span>
            </div>
            <div class="soft-metric">
              <span class="soft-metric-label">Uptime</span>
              <span class="soft-metric-value">${uptime}</span>
            </div>
            <div class="soft-metric">
              <span class="soft-metric-label">Next Run</span>
              <span class="soft-metric-value">${nextRun}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    // Bind card clicks
    grid.querySelectorAll('.soft-card').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.id));
    });
  }

  // ─── Detail View ───
  async function loadDetail(softId) {
    if (!softId) return;

    try {
      const soft = await API.getSoft(softId);
      renderDetail(soft);

      // Load crash logs
      const crashLogs = await API.getCrashLogs(softId);
      renderCrashLogs(crashLogs);

      // Setup terminal
      setupTerminal(softId);

    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function renderDetail(soft) {
    document.getElementById('detail-name').textContent = soft.name;

    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = soft.status === 'running' ? '🟢 Running'
      : soft.status === 'frozen' ? 'FROZEN'
      : '🔴 Stopped';
    statusEl.className = `status-badge status-${soft.status}`;

    // Process info
    if (soft.process) {
      document.getElementById('detail-pid').textContent = soft.process.pid;
      document.getElementById('detail-uptime').textContent = formatUptime(soft.process.uptime);
    } else {
      document.getElementById('detail-pid').textContent = '—';
      document.getElementById('detail-uptime').textContent = '—';
    }

    if (soft.processMetrics) {
      document.getElementById('detail-cpu').textContent = `${soft.processMetrics.cpu}%`;
      document.getElementById('detail-ram').textContent = formatBytes(soft.processMetrics.memRss);
    } else {
      document.getElementById('detail-cpu').textContent = '—';
      document.getElementById('detail-ram').textContent = '—';
    }

    document.getElementById('detail-nextrun').textContent = soft.nextRun ? formatTime(soft.nextRun) : '—';
    document.getElementById('detail-restarts').textContent = `${soft.restart_count} / ${soft.max_restarts}`;

    // Show/hide reset button
    document.getElementById('ctrl-reset').style.display = soft.status === 'frozen' ? 'inline-flex' : 'none';

    // Settings fields
    document.getElementById('soft-command').value = soft.command || '';
    document.getElementById('soft-cron').value = soft.cron_schedule || '';
    document.getElementById('soft-timezone').value = soft.timezone || 'Europe/Moscow';
    document.getElementById('soft-maxrestarts').value = soft.max_restarts || 5;
  }

  function renderCrashLogs(logs) {
    const container = document.getElementById('crash-logs-list');
    if (!logs || logs.length === 0) {
      container.innerHTML = '<p class="text-muted">No crash logs</p>';
      return;
    }

    container.innerHTML = logs.map(log => `
      <div class="crash-log-item">
        <div class="crash-log-time">${formatTime(log.timestamp)}</div>
        <div class="crash-log-text">${escapeHtml(log.log)}</div>
      </div>
    `).join('');
  }

  // ─── Terminal ───
  function setupTerminal(softId) {
    cleanupTerminal();

    const container = document.getElementById('terminal');
    container.innerHTML = '';

    terminal = new window.Terminal({
      theme: {
        background: 'rgba(0, 0, 0, 0.01)',
        foreground: '#e2e8f0',
        cursor: '#6366f1',
        selectionBackground: 'rgba(99, 102, 241, 0.3)',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      scrollback: 1000,
    });

    fitAddon = new window.FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    setTimeout(() => {
      fitAddon.fit();
      WS.sendResize(softId, terminal.cols, terminal.rows);
    }, 100);

    // Subscribe to logs
    WS.subscribeLogs(softId);

    // Handle terminal output from WS
    const outputHandler = (msg) => {
      if (msg.softId === softId && terminal) {
        terminal.write(msg.data);
      }
    };
    WS.on('pty:output', outputHandler);
    terminal._wsHandler = outputHandler;

    // Handle terminal input
    terminal.onData((data) => {
      WS.sendInput(softId, data);
    });

    // Resize on window resize
    const resizeHandler = () => {
      if (fitAddon && terminal) {
        fitAddon.fit();
        WS.sendResize(softId, terminal.cols, terminal.rows);
      }
    };
    window.addEventListener('resize', resizeHandler);
    terminal._resizeHandler = resizeHandler;
  }

  function cleanupTerminal() {
    if (terminal) {
      if (terminal._wsHandler) WS.off('pty:output', terminal._wsHandler);
      if (terminal._resizeHandler) window.removeEventListener('resize', terminal._resizeHandler);
      if (currentSoftId) WS.unsubscribeLogs(currentSoftId);
      terminal.dispose();
      terminal = null;
      fitAddon = null;
    }
  }

  // ─── Controls ───
  async function controlSoft(action) {
    if (!currentSoftId) return;

    try {
      switch (action) {
        case 'start': await API.startSoft(currentSoftId); break;
        case 'stop': await API.stopSoft(currentSoftId); break;
        case 'restart': await API.restartSoft(currentSoftId); break;
        case 'kill': await API.killSoft(currentSoftId); break;
        case 'reset': await API.resetSoft(currentSoftId); break;
      }
      toast(`${action} — OK`, 'success');

      // Refresh detail after a short delay
      setTimeout(() => loadDetail(currentSoftId), 500);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function saveSoftSettings() {
    if (!currentSoftId) return;

    const data = {
      command: document.getElementById('soft-command').value.trim(),
      cron_schedule: document.getElementById('soft-cron').value.trim() || null,
      timezone: document.getElementById('soft-timezone').value.trim() || 'Europe/Moscow',
      max_restarts: parseInt(document.getElementById('soft-maxrestarts').value) || 5,
    };

    try {
      await API.updateSoft(currentSoftId, data);
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ─── Auth Logs ───
  async function loadAuthLogs() {
    try {
      const logs = await API.getAuthLogs();
      const tbody = document.getElementById('auth-logs-body');

      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="padding:24px;text-align:center">No logs</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(log => `
        <tr>
          <td>${formatTime(log.timestamp)}</td>
          <td>${escapeHtml(log.username)}</td>
          <td>${escapeHtml(log.ip)}</td>
          <td><span class="${log.success ? 'auth-status-ok' : 'auth-status-fail'}">${log.success ? 'OK' : 'FAIL'}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      toast('Failed to load auth logs', 'error');
    }
  }

  // ─── Settings ───
  async function loadSettings() {
    try {
      const settings = await API.getSettings();

      // System info
      const versionEl = document.getElementById('settings-version');
      if (versionEl && settings.version) {
        versionEl.textContent = settings.version;
      }

      // Root paths
      const rootPaths = settings.root_paths || [];
      renderRootPaths(rootPaths);

      // Timezone
      document.getElementById('default-timezone').value = settings.default_timezone || 'Europe/Moscow';
    } catch (err) {
      toast('Failed to load settings', 'error');
    }
  }

  function renderRootPaths(paths) {
    const list = document.getElementById('root-paths-list');
    if (!paths || paths.length === 0) {
      list.innerHTML = '<p class="text-muted">No root paths configured</p>';
      return;
    }

    list.innerHTML = paths.map((p, i) => `
      <div class="root-path-item">
        <span>${escapeHtml(p)}</span>
        <button data-index="${i}" title="Remove">&times;</button>
      </div>
    `).join('');

    // Bind remove buttons
    list.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index);
        const newPaths = [...paths];
        newPaths.splice(idx, 1);
        try {
          await API.updateSetting('root_paths', newPaths);
          renderRootPaths(newPaths);
          toast('Path removed', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  async function addRootPath() {
    const input = document.getElementById('new-root-path');
    const path = input.value.trim();
    if (!path) return;

    try {
      const settings = await API.getSettings();
      const paths = settings.root_paths || [];
      if (paths.includes(path)) {
        toast('Path already added', 'error');
        return;
      }
      paths.push(path);
      await API.updateSetting('root_paths', paths);
      input.value = '';
      renderRootPaths(paths);
      toast('Path added', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ─── Real-time handlers ───
  function handleMetrics(msg) {
    if (!msg.data || currentPage !== 'dashboard') return;
    const d = msg.data;

    // CPU
    const cpuBar = document.getElementById('cpu-bar');
    const cpuVal = document.getElementById('cpu-value');
    if (cpuBar && cpuVal) {
      cpuBar.style.width = `${d.cpu.usage}%`;
      cpuBar.style.background = d.cpu.usage > 80 ? 'var(--danger)' : d.cpu.usage > 50 ? 'var(--warning)' : 'var(--accent)';
      cpuVal.textContent = `${d.cpu.usage}%`;
    }

    // RAM
    const ramBar = document.getElementById('ram-bar');
    const ramVal = document.getElementById('ram-value');
    if (ramBar && ramVal) {
      ramBar.style.width = `${d.memory.usagePercent}%`;
      ramBar.style.background = d.memory.usagePercent > 85 ? 'var(--danger)' : d.memory.usagePercent > 60 ? 'var(--warning)' : 'var(--accent)';
      ramVal.textContent = `${d.memory.usagePercent}%`;
    }

    // Network
    const netVal = document.getElementById('net-value');
    if (netVal && d.network && d.network.length > 0) {
      const rx = d.network.reduce((sum, n) => sum + (n.rxSec || 0), 0);
      const tx = d.network.reduce((sum, n) => sum + (n.txSec || 0), 0);
      netVal.textContent = `${formatBytes(rx)}/s / ${formatBytes(tx)}/s`;
    }

    // Uptime
    const uptimeVal = document.getElementById('uptime-value');
    if (uptimeVal && d.uptime) {
      uptimeVal.textContent = formatUptime(d.uptime * 1000);
    }
  }

  function handleStatusChange(msg) {
    // Refresh dashboard if on it
    if (currentPage === 'dashboard') {
      loadSofts();
    }
    // Update detail if viewing this soft
    if (currentPage === 'detail' && msg.softId === currentSoftId) {
      loadDetail(currentSoftId);
    }
  }

  // ─── Auto-refresh ───
  function startRefresh() {
    stopRefresh();
    refreshInterval = setInterval(() => {
      if (currentPage === 'dashboard') loadSofts();
    }, 5000);
  }

  function stopRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  // ─── Utilities ───
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function formatUptime(ms) {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  }

  function formatTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, c => map[c]);
  }

  return { init };
})();

// ─── Bootstrap ───
document.addEventListener('DOMContentLoaded', App.init);
