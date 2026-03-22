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
  let countdownInterval = null;
  let extraTerminals = []; // { termKey, terminal, fitAddon, container }
  let currentLayout = 1;

  // Timezone list (~40 popular IANA zones fallback, mainly using Intl)
  const TIMEZONES = typeof Intl !== 'undefined' && Intl.supportedValuesOf
    ? Intl.supportedValuesOf('timeZone')
    : [
    'UTC',
    'Europe/Moscow', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Zurich',
    'Europe/Warsaw', 'Europe/Bucharest', 'Europe/Helsinki', 'Europe/Kiev',
    'Europe/Istanbul', 'Europe/Minsk', 'Europe/Samara',
    'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk',
    'Asia/Irkutsk', 'Asia/Vladivostok', 'Asia/Kamchatka',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
    'Asia/Kolkata', 'Asia/Dubai', 'Asia/Bangkok', 'Asia/Seoul',
    'Asia/Taipei', 'Asia/Jakarta',
    'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Anchorage', 'America/Sao_Paulo',
    'America/Toronto', 'America/Mexico_City', 'America/Argentina/Buenos_Aires',
    'Pacific/Honolulu', 'Pacific/Auckland',
    'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
    'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos'
  ];

  function populateTimezoneSelects() {
    document.querySelectorAll('#soft-timezone, #default-timezone').forEach(sel => {
      sel.innerHTML = TIMEZONES.map(tz =>
        `<option value="${tz}">${tz}</option>`
      ).join('');
    });
  }

  // ─── Initialization ───
  function init() {
    window.i18n.apply();
    populateTimezoneSelects();

    // Check auth
    const token = localStorage.getItem('auth_token');
    if (!token) {
      showLogin();
    } else {
      API.setToken(token);
      showMain();
    }
    bindEvents();
    
    // Set language selector value
    const langSelect = document.getElementById('app-language');
    if (langSelect) langSelect.value = window.i18n.lang;
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

    // Settings: Language
    const langSelect = document.getElementById('app-language');
    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        window.i18n.setLang(e.target.value);
        loadSofts(); // Refresh dynamic text
      });
    }

    // Save soft settings
    document.getElementById('save-soft-settings').addEventListener('click', saveSoftSettings);

    // Terminal controls
    document.getElementById('term-clear').addEventListener('click', () => {
      if (terminal) terminal.clear();
    });
    document.getElementById('term-top').addEventListener('click', () => {
      if (terminal) terminal.scrollToTop();
    });
    document.getElementById('term-bottom').addEventListener('click', () => {
      if (terminal) terminal.scrollToBottom();
    });

    // Multi-terminal: +New
    document.getElementById('term-add').addEventListener('click', () => {
      if (!currentSoftId) return;
      WS.createTerminal(currentSoftId);
    });

    // Layout buttons
    document.querySelectorAll('.term-layout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = parseInt(btn.dataset.layout);
        setTerminalLayout(layout);
      });
    });

    // Handle terminal:created from WS
    WS.on('terminal:created', (msg) => {
      addExtraTerminal(msg.termKey, msg.softId);
    });

    // Settings: Add root path
    document.getElementById('add-root-path').addEventListener('click', addRootPath);
    document.getElementById('new-root-path').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addRootPath();
    });

    // Settings: Save timezone
    document.getElementById('save-timezone').addEventListener('click', async () => {
      const tz = document.getElementById('default-timezone').value;
      if (!tz) return;
      try {
        await API.updateSetting('default_timezone', tz);
        toast('Timezone saved', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Settings: Save Telegram
    document.getElementById('save-telegram').addEventListener('click', async () => {
      try {
        const token = document.getElementById('tg-bot-token').value.trim();
        const enabled = document.getElementById('tg-tma-enabled').checked;
        const secret = document.getElementById('tg-tma-secret').value.trim();
        await API.updateSetting('telegram_bot_token', token);
        await API.updateSetting('telegram_tma_enabled', String(enabled));
        await API.updateSetting('telegram_tma_secret', secret);
        toast('Telegram settings saved', 'success');
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
      updateTerminalLayoutButtons();
      renderSofts(softsCache);
    } catch (err) {
      if (err.message !== 'Session expired') {
        toast('Failed to load software list', 'error');
      }
    }
  }

  function updateTerminalLayoutButtons() {
    const runningCount = softsCache.filter(s => s.isRunning).length;
    document.querySelectorAll('.term-layout-btn').forEach(btn => {
      const layout = parseInt(btn.dataset.layout);
      if (layout === 2) {
        btn.disabled = runningCount < 2;
        btn.style.opacity = runningCount < 2 ? '0.3' : '1';
        btn.style.pointerEvents = runningCount < 2 ? 'none' : 'auto';
      }
      if (layout === 4) {
        btn.disabled = runningCount < 4;
        btn.style.opacity = runningCount < 4 ? '0.3' : '1';
        btn.style.pointerEvents = runningCount < 4 ? 'none' : 'auto';
      }
    });

    // Fallback if current layout is now invalid
    if (currentLayout > runningCount && runningCount > 0) {
      const bestLayout = runningCount >= 4 ? 4 : runningCount >= 2 ? 2 : 1;
      setTerminalLayout(bestLayout);
    }
  }

  function getStatusBadge(status) {
    if (status === 'frozen') return `<span class="status-badge frozen">${window.i18n.t('status_frozen')}</span>`;
    if (status === 'running') return `<span class="status-badge running">${window.i18n.t('status_running')}</span>`;
    return `<span class="status-badge stopped">${window.i18n.t('status_stopped')}</span>`;
  }

  function renderSofts(softs) {
    const grid = document.getElementById('softs-grid');

    if (!softs || softs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state glass-card">
          <p>${window.i18n.t('dash_empty_title')}</p>
          <p class="text-muted">${window.i18n.t('dash_empty_desc')}</p>
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
      const countdown = soft.nextRun ? formatCountdown(soft.nextRun) : '';

      return `
        <div class="soft-card glass-card" data-id="${soft.id}">
          <div class="soft-card-header">
            <span class="soft-card-name">${escapeHtml(soft.name)}</span>
            ${getStatusBadge(soft.status)}
          </div>
          <div class="soft-card-metrics">
            <div class="soft-metric">
              <span class="soft-metric-label">${window.i18n.t('metric_cpu')}</span>
              <span class="soft-metric-value">${cpu}</span>
            </div>
            <div class="soft-metric">
              <span class="soft-metric-label">${window.i18n.t('metric_ram')}</span>
              <span class="soft-metric-value">${ram}</span>
            </div>
            <div class="soft-metric">
              <span class="soft-metric-label">${window.i18n.t('metric_uptime')}</span>
              <span class="soft-metric-value">${uptime}</span>
            </div>
            <div class="soft-metric">
              <span class="soft-metric-label">${window.i18n.t('metric_nextrun')}</span>
              <span class="soft-metric-value countdown" data-nextrun="${soft.nextRun || ''}">${countdown || nextRun}</span>
            </div>
          </div>
          ${countdown ? `<div class="soft-card-countdown">${countdown}</div>` : ''}
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

    const badgeContainer = document.getElementById('detail-status');
    badgeContainer.className = '';
    badgeContainer.innerHTML = getStatusBadge(soft.status);

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

    // Cron UI fields
    document.getElementById('soft-cron-time').value = soft.cron_time || '';
    document.getElementById('soft-cron-interval').value = soft.cron_interval_days || 1;
    document.getElementById('soft-cron-random-min').value = soft.cron_random_minutes || 0;
    document.getElementById('soft-cron-random-enabled').checked = (soft.cron_random_minutes || 0) > 0;
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
      if (msg.softId === softId && !msg.termKey && terminal) {
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
      // Also resize extra terminals
      for (const et of extraTerminals) {
        if (et.fitAddon && et.terminal) {
          et.fitAddon.fit();
          WS.sendTerminalResize(et.termKey, et.terminal.cols, et.terminal.rows);
        }
      }
    };
    window.addEventListener('resize', resizeHandler);
    terminal._resizeHandler = resizeHandler;
  }

  function addExtraTerminal(termKey, softId) {
    const grid = document.getElementById('terminals-grid');
    const pane = document.createElement('div');
    pane.className = 'terminal-pane';
    pane.dataset.termKey = termKey;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'term-pane-close';
    closeBtn.textContent = 'x';
    closeBtn.title = 'Close terminal';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeExtraTerminal(termKey);
    });
    pane.appendChild(closeBtn);

    const termContainer = document.createElement('div');
    termContainer.className = 'term-inner';
    pane.appendChild(termContainer);
    grid.appendChild(pane);

    const term = new window.Terminal({
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

    const fa = new window.FitAddon.FitAddon();
    term.loadAddon(fa);
    term.open(termContainer);

    setTimeout(() => {
      fa.fit();
      WS.sendTerminalResize(termKey, term.cols, term.rows);
    }, 100);

    // Output handler
    const handler = (msg) => {
      if (msg.termKey === termKey && term) {
        term.write(msg.data);
      }
    };
    WS.on('pty:output', handler);
    term._wsHandler = handler;

    // Input handler
    term.onData((data) => {
      WS.sendTerminalInput(termKey, data);
    });

    extraTerminals.push({ termKey, terminal: term, fitAddon: fa, container: pane, handler });

    // Auto-switch to proper layout
    const totalTerms = 1 + extraTerminals.length;
    if (totalTerms <= 1) setTerminalLayout(1);
    else if (totalTerms <= 2) setTerminalLayout(2);
    else setTerminalLayout(4);
  }

  function removeExtraTerminal(termKey) {
    const idx = extraTerminals.findIndex(et => et.termKey === termKey);
    if (idx === -1) return;
    const et = extraTerminals[idx];
    WS.closeTerminal(termKey);
    if (et.handler) WS.off('pty:output', et.handler);
    et.terminal.dispose();
    et.container.remove();
    extraTerminals.splice(idx, 1);

    const totalTerms = 1 + extraTerminals.length;
    if (totalTerms <= 1) setTerminalLayout(1);
    else if (totalTerms <= 2) setTerminalLayout(2);
    else setTerminalLayout(4);
  }

  function setTerminalLayout(layout) {
    currentLayout = layout;
    const grid = document.getElementById('terminals-grid');
    grid.className = `terminals-grid layout-${layout}`;

    // Update active button
    document.querySelectorAll('.term-layout-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.layout) === layout);
    });

    // Refit all terminals
    setTimeout(() => {
      if (fitAddon && terminal) fitAddon.fit();
      for (const et of extraTerminals) {
        if (et.fitAddon) et.fitAddon.fit();
      }
    }, 50);
  }

  function cleanupTerminal() {
    // Clean extra terminals
    for (const et of extraTerminals) {
      WS.closeTerminal(et.termKey);
      if (et.handler) WS.off('pty:output', et.handler);
      et.terminal.dispose();
      et.container.remove();
    }
    extraTerminals = [];
    currentLayout = 1;

    // Clean main terminal
    if (terminal) {
      if (terminal._wsHandler) WS.off('pty:output', terminal._wsHandler);
      if (terminal._resizeHandler) window.removeEventListener('resize', terminal._resizeHandler);
      if (currentSoftId) WS.unsubscribeLogs(currentSoftId);
      terminal.dispose();
      terminal = null;
      fitAddon = null;
    }

    // Reset grid
    const grid = document.getElementById('terminals-grid');
    if (grid) grid.className = 'terminals-grid layout-1';
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

    // Build cron from UI
    const cronTime = document.getElementById('soft-cron-time').value; // "HH:MM"
    let cronSchedule = document.getElementById('soft-cron').value.trim() || null;
    if (cronTime) {
      const [h, m] = cronTime.split(':');
      cronSchedule = `${parseInt(m)} ${parseInt(h)} * * *`;
    }

    const randomEnabled = document.getElementById('soft-cron-random-enabled').checked;
    const randomMin = randomEnabled ? (parseInt(document.getElementById('soft-cron-random-min').value) || 0) : 0;
    const intervalDays = parseInt(document.getElementById('soft-cron-interval').value) || 1;

    const data = {
      command: document.getElementById('soft-command').value.trim(),
      cron_schedule: cronSchedule,
      cron_time: cronTime || null,
      cron_random_minutes: randomMin,
      cron_interval_days: intervalDays,
      timezone: document.getElementById('soft-timezone').value || 'Europe/Moscow',
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

      // Telegram
      const tgToken = document.getElementById('tg-bot-token');
      const tgEnabled = document.getElementById('tg-tma-enabled');
      const tgSecret = document.getElementById('tg-tma-secret');
      if (tgToken) tgToken.value = settings.telegram_bot_token || '';
      if (tgEnabled) tgEnabled.checked = settings.telegram_tma_enabled === true || settings.telegram_tma_enabled === 'true';
      if (tgSecret) tgSecret.value = settings.telegram_tma_secret || '';
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
      netVal.textContent = `${formatNetworkSpeed(rx)} / ${formatNetworkSpeed(tx)}`;
    }

    // Uptime
    const uptimeVal = document.getElementById('uptime-value');
    if (uptimeVal && d.uptime) {
      uptimeVal.textContent = formatUptime(d.uptime * 1000);
    }
  }

  function handleStatusChange(msg) {
    const soft = softsCache.find(s => s.id === msg.softId);
    if (soft) {
      soft.status = msg.status;
      soft.isRunning = msg.status === 'running';
    }
    updateTerminalLayoutButtons();

    // Refresh dashboard if on it
    if (currentPage === 'dashboard') {
      renderSofts(softsCache); // Update UI without API call
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
    // Countdown timer update (every 30s)
    countdownInterval = setInterval(() => {
      if (currentPage === 'dashboard' && softsCache.length > 0) {
        renderSofts(softsCache);
      }
    }, 30000);
  }

  function stopRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
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

  // Network speed: bytes/s -> bits/s, base-1000 (Kbit, Mbit, Gbit)
  function formatNetworkSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec === 0) return '0 bit/s';
    const bitsPerSec = bytesPerSec * 8;
    const units = ['bit/s', 'Kbit/s', 'Mbit/s', 'Gbit/s'];
    const k = 1000;
    const i = Math.floor(Math.log(bitsPerSec) / Math.log(k));
    const idx = Math.min(i, units.length - 1);
    return (bitsPerSec / Math.pow(k, idx)).toFixed(1) + ' ' + units[idx];
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

  function formatCountdown(iso) {
    if (!iso) return '';
    try {
      const now = Date.now();
      const target = new Date(iso).getTime();
      const diff = target - now;
      if (diff <= 0) return '';
      const totalMin = Math.floor(diff / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    } catch {
      return '';
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
