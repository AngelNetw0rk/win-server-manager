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
  let detailRefreshInterval = null;
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
    const token = localStorage.getItem('wsm_token');
    if (!token) {
      showLogin();
    } else {
      API.setToken(token);
      showMain();
    }
    bindEvents();
    
    const langSelect = document.getElementById('app-language');
    if (langSelect) langSelect.value = window.i18n.lang;
    window.addEventListener('auth:expired', showLogin);

    // Beacon on tab close
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const token = API.getToken();
        if (token) navigator.sendBeacon(`/api/auth/beacon?token=${token}`);
      }
    });

    setupIdleTimer();
  }

  // ─── Auto-Lock Idle Timer ───
  let idleTimer = null;
  let idleEnabled = false;
  let idleTimeoutMs = 15 * 60000;

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (idleEnabled) {
      idleTimer = setTimeout(() => {
        API.logout().catch(() => {});
        API.clearToken();
        showLogin();
        toast(window.i18n.t('session_locked') || 'Session locked due to inactivity', 'warning');
      }, idleTimeoutMs);
    }
  }

  function setupIdleTimer() {
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
      window.addEventListener(evt, resetIdleTimer, { passive: true });
    });
  }

  function applyIdleSettings(settings) {
    idleEnabled = settings.auto_lock_enabled === 'true';
    idleTimeoutMs = (parseInt(settings.auto_lock_minutes) || 15) * 60000;
    resetIdleTimer();
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
    WS.on('session:revoked', () => {
      API.clearToken();
      showLogin();
      toast(window.i18n ? window.i18n.t('session_revoked') || 'Session revoked by admin' : 'Session revoked by admin', 'warning');
    });

    API.getSettings().then(settings => {
      window.appSettings = settings;
      applyIdleSettings(settings); // Apply idle lock globally
    }).catch(() => {});

    API.getSecurity().then(sec => {
      if (!localStorage.getItem('lang') && sec.lang) {
        const lang = sec.lang.toLowerCase();
        window.i18n.setLang(lang);
        const langSelect = document.getElementById('app-language');
        if (langSelect) langSelect.value = lang;
      }
    }).catch(() => {});

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

      let clientIp = 'unknown';
      try {
        const res1 = await fetch('https://api.ipify.org?format=json');
        clientIp = (await res1.json()).ip;
      } catch(err) {
        try {
          const res2 = await fetch('https://ifconfig.me/all.json');
          clientIp = (await res2.json()).ip_addr;
        } catch(err2) {}
      }

      try {
        const result = await API.login(username, password, clientIp);
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
        const layout = btn.dataset.layout === 'all' ? 'all' : parseInt(btn.dataset.layout);
        setTerminalLayout(layout);
      });
    });

    // Handle terminal:created from WS
    WS.on('terminal:created', (msg) => {
      addExtraTerminal(msg.termKey, msg.softId, msg.label);
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
        await API.updateSetting('telegram_bot_token', token);
        toast('Telegram settings saved', 'success');
        loadSettings();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Security 2FA Toggle
    const tfaToggle = document.getElementById('security-2fa-enabled');
    if (tfaToggle) {
      tfaToggle.addEventListener('change', async (e) => {
        try {
          await API.updateSecurity({ '2fa_enabled': e.target.checked });
          toast('2FA settings updated', 'success');
        } catch (err) {
          e.target.checked = !e.target.checked; // revert
          toast(err.message, 'error');
        }
      });
    }

    // Security Admin Reset
    const resetAdminBtn = document.getElementById('reset-admin-btn');
    if (resetAdminBtn) {
      resetAdminBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reset the Super Admin Chat ID?')) return;
        try {
          await API.updateSecurity({ action: 'reset_admin' });
          const sec = await API.getSecurity();
          document.getElementById('security-admin-chatid').textContent = sec.admin_chat_id || 'Not set';
          toast('Admin Chat ID reset successfully. Next /start will become Super Admin.', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }

    // Settings: Save Updater
    const saveUpdaterBtn = document.getElementById('save-updater');
    if (saveUpdaterBtn) {
      saveUpdaterBtn.addEventListener('click', async () => {
        try {
          await API.updateSetting('auto_update_interval', document.getElementById('auto-update-interval').value);
          await API.updateSetting('auto_update_mode', document.getElementById('auto-update-mode').value);
          toast('Updater settings saved', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }

    // Settings: Save Session Security
    const saveAutolockBtn = document.getElementById('save-autolock');
    if (saveAutolockBtn) {
      saveAutolockBtn.addEventListener('click', async () => {
        try {
          const enabled = document.getElementById('auto-lock-enabled').checked;
          const minutes = document.getElementById('auto-lock-minutes').value;
          await API.updateSetting('auto_lock_enabled', String(enabled));
          await API.updateSetting('auto_lock_minutes', String(minutes));
          applyIdleSettings({ auto_lock_enabled: String(enabled), auto_lock_minutes: String(minutes) });
          toast('Session security settings saved', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }

    // Auto-Input: Add step
    document.getElementById('auto-input-add').addEventListener('click', () => {
      addAutoInputStep();
    });

    // Auto-Input: Randomize times
    document.getElementById('auto-input-randomize').addEventListener('click', () => {
      document.querySelectorAll('.auto-input-time').forEach(input => {
        const h = Math.floor(Math.random() * 24);
        const m = Math.floor(Math.random() * 60);
        input.value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      });
    });

    // Auto-Input: Individual time toggle
    document.getElementById('auto-input-individual-time').addEventListener('change', (e) => {
      document.querySelectorAll('.auto-input-time-wrap').forEach(el => {
        el.style.display = e.target.checked ? '' : 'none';
      });
    });

    // Launch delay slider
    const delaySlider = document.getElementById('soft-launch-delay');
    const delayValue = document.getElementById('launch-delay-value');
    if (delaySlider && delayValue) {
      delaySlider.addEventListener('input', () => {
        delayValue.textContent = formatDelayValue(parseInt(delaySlider.value));
      });
    }
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

    // Stop detail refresh when leaving detail page
    if (page !== 'detail') stopDetailRefresh();

    switch (page) {
      case 'dashboard':
        document.getElementById('page-dashboard').classList.add('active');
        loadSofts();
        break;
      case 'detail':
        document.getElementById('page-detail').classList.add('active');
        loadDetail(currentSoftId);
        startDetailRefresh();
        break;
      case 'auth-logs':
        document.getElementById('page-auth-logs').classList.add('active');
        loadAuthLogs();
        loadSessions();
        loadBans();
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
    const totalTerms = 1 + extraTerminals.length;
    document.querySelectorAll('.term-layout-btn').forEach(btn => {
      const layout = btn.dataset.layout;
      if (layout === 'all') {
        btn.disabled = totalTerms < 2;
      } else {
        const num = parseInt(layout);
        btn.disabled = num > totalTerms;
      }
    });
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
    const isFrozen = soft.status === 'frozen';
    document.getElementById('ctrl-reset').style.display = isFrozen ? 'inline-flex' : 'none';

    // Disable start and restart buttons if frozen
    document.getElementById('ctrl-start').disabled = isFrozen;
    document.getElementById('ctrl-restart').disabled = isFrozen;

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

    // Auto-Input Sequence
    renderAutoInputSteps(soft.auto_input_sequence);

    // Launch delay slider
    const delay = soft.terminal_launch_delay || 0;
    const delaySlider = document.getElementById('soft-launch-delay');
    const delayValue = document.getElementById('launch-delay-value');
    if (delaySlider) delaySlider.value = delay;
    if (delayValue) delayValue.textContent = formatDelayValue(delay);
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
  function createTerminal(softId, options = {}) {
    WS.send({ type: 'terminal:create', softId, ...options });
  }
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

    // Show message if process not running
    const cached = softsCache.find(s => s.id === softId);
    if (cached && cached.status !== 'running') {
      terminal.write('\r\n  \x1b[90mProcess not running. Press [START] to begin.\x1b[0m\r\n\r\n');
    }

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

  function addExtraTerminal(termKey, softId, label = '') {
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

    const termNum = 2 + extraTerminals.length; // main = #1
    const header = document.createElement('div');
    header.className = 'term-pane-header';
    header.innerHTML = `<span class="term-num">#${termNum}</span><span class="term-func">${escapeHtml(label || 'Terminal')}</span>`;
    pane.appendChild(header);

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
    updateTerminalLayoutButtons();

    // Auto-switch to proper layout
    const totalTerms = 1 + extraTerminals.length;
    if (totalTerms <= 1) setTerminalLayout(1);
    else if (totalTerms <= 2) setTerminalLayout(2);
    else if (totalTerms <= 4) setTerminalLayout(4);
    else setTerminalLayout('all');
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
    updateTerminalLayoutButtons();

    const totalTerms = 1 + extraTerminals.length;
    if (currentLayout !== 'all') {
      if (totalTerms <= 1) setTerminalLayout(1);
      else if (totalTerms <= 2) setTerminalLayout(2);
      else if (totalTerms <= 4) setTerminalLayout(4);
    }
  }

  function setTerminalLayout(layout) {
    currentLayout = layout;
    const grid = document.getElementById('terminals-grid');
    grid.className = `terminals-grid layout-${layout}`;

    // Update active button
    document.querySelectorAll('.term-layout-btn').forEach(btn => {
      const btnLayout = btn.dataset.layout === 'all' ? 'all' : parseInt(btn.dataset.layout);
      btn.classList.toggle('active', btnLayout === layout);
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
      auto_input_sequence: JSON.stringify(getAutoInputSteps()),
      terminal_launch_delay: parseInt(document.getElementById('soft-launch-delay').value) || 0,
    };

    try {
      await API.updateSoft(currentSoftId, data);
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ─── GeoIP Cache & Device Parser ───
  function getFlagEmoji(countryCode) {
    if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) return null;
    const code = countryCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return null;
    return code.replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
  }

  const geoIpCache = {};
  async function getGeoIp(ip) {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return 'Local Network';
    if (geoIpCache[ip]) return geoIpCache[ip];
    try {
      const res = await fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const flag = getFlagEmoji(data.country_code);
      geoIpCache[ip] = flag ? `${flag} ${data.country}, ${data.city}` : `${data.country_code || data.country || 'Unknown'}, ${data.city || 'Unknown'}`;
      return geoIpCache[ip];
    } catch {
      geoIpCache[ip] = 'Unknown';
      return geoIpCache[ip];
    }
  }

  function parseDevice(ua) {
    if (!ua || ua === 'unknown') return 'Unknown';
    let os = 'Unknown OS';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';
    
    let browser = 'Unknown Browser';
    if (ua.includes('Chrome') && !ua.includes('Edg/') && !ua.includes('OPR/')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';

    const type = (os === 'iOS' || os === 'Android' || ua.includes('Mobile')) ? 'Mobile' : 'Desktop';
    return `[${type}] ${os} / ${browser}`;
  }

  // ─── Auth Logs ───
  async function loadAuthLogs() {
    try {
      const logs = await API.getAuthLogs();
      const tbody = document.getElementById('auth-logs-body');

      if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="padding:24px;text-align:center">${window.i18n.t('log_no_logs') || 'No logs'}</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(log => `
        <tr>
          <td>${formatTime(log.timestamp)}</td>
          <td>${escapeHtml(log.username)}</td>
          <td>
            <div>${escapeHtml(log.ip)}</div>
            <div class="text-muted" style="font-size:11px" id="geo-${log.id}">Loading...</div>
          </td>
          <td>${escapeHtml(parseDevice(log.user_agent))}</td>
          <td><span class="${log.session_active ? 'auth-status-ok' : 'text-muted'}">${log.session_active ? '🟢 Active' : '🔴 Closed'}</span></td>
          <td><span class="${log.success ? 'auth-status-ok' : 'auth-status-fail'}">${log.success ? 'OK' : 'FAIL'}</span></td>
        </tr>
      `).join('');

      for (const log of logs) {
        getGeoIp(log.ip).then(loc => {
          const el = document.getElementById(`geo-${log.id}`);
          if (el) el.textContent = loc;
        });
      }
    } catch (err) {
      toast('Failed to load auth logs', 'error');
    }
  }

  // ─── Sessions Management ───
  function getSessionId() {
    const token = API.getToken();
    if (!token) return null;
    try { return JSON.parse(atob(token.split('.')[1])).sessionId; } catch { return null; }
  }

  async function loadSessions() {
    try {
      const sessions = await API.getSessions();
      const tbody = document.getElementById('sessions-table-body');
      if (!sessions || sessions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="padding:24px;text-align:center">${window.i18n.t('log_no_sessions') || 'No active sessions'}</td></tr>`;
        return;
      }
      
      const currentSessionId = getSessionId();

      tbody.innerHTML = sessions.map(log => {
        const isCurrent = log.session_id === currentSessionId;
        const badge = isCurrent ? `<span class="auth-status-ok" style="font-size:10px;padding:2px 4px;border-radius:4px;margin-left:4px;white-space:nowrap;">Current</span>` : '';
        return `
          <tr>
            <td>
              <div><strong>${escapeHtml(log.username)}</strong> ${badge}</div>
              <div class="text-muted" style="font-size:11px">Started: ${formatTime(log.timestamp)}</div>
            </td>
            <td>
              <div>${escapeHtml(log.ip)}</div>
              <div class="text-muted" style="font-size:11px" id="sess-geo-${log.id}">Loading...</div>
            </td>
            <td>${escapeHtml(parseDevice(log.user_agent))}</td>
            <td>
               ${!isCurrent ? `
               <button class="btn btn-warning btn-xs" onclick="window.kickSessionCb('${log.session_id}')">Kick</button>
               <button class="btn btn-danger btn-xs" style="margin-top:4px;" onclick="window.banSessionCb('${log.ip}', '${log.session_id}')">Ban IP</button>
               ` : ''}
            </td>
          </tr>
        `;
      }).join('');

      for (const log of sessions) {
        getGeoIp(log.ip).then(loc => {
          const el = document.getElementById(`sess-geo-${log.id}`);
          if (el) el.textContent = loc;
        });
      }
    } catch (err) {
      toast('Failed to load sessions', 'error');
    }
  }

  async function loadBans() {
    try {
      const bans = await API.getBans();
      const tbody = document.getElementById('bans-table-body');
      if (!bans || bans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-muted" style="padding:24px;text-align:center">${window.i18n.t('log_no_bans') || 'No banned IPs'}</td></tr>`;
        return;
      }
      tbody.innerHTML = bans.map(b => `
        <tr>
          <td>${escapeHtml(b.ip)}</td>
          <td><span class="auth-status-fail">${b.permanent ? 'Permanent' : 'Temporary'}</span></td>
          <td><button class="btn btn-success btn-xs" onclick="window.unbanIpCb('${b.ip}')">Unban</button></td>
        </tr>
      `).join('');
    } catch (err) {}
  }

  window.kickSessionCb = async (id) => {
    if (!confirm(window.i18n.t('prompt_kick') || 'Kick this session?')) return;
    try {
      await API.kickSession(id);
      toast(window.i18n.t('toast_session_kicked') || 'Session kicked', 'success');
      loadSessions();
    } catch(err) { toast(err.message, 'error'); }
  };
  window.banSessionCb = async (ip, id) => {
    if (!confirm((window.i18n.t('prompt_ban') || 'Ban IP permanently and kick session?').replace('{ip}', ip))) return;
    try {
      await API.banIp(ip, id);
      toast(window.i18n.t('toast_ip_banned') || 'IP banned and session kicked', 'success');
      loadSessions();
      loadBans();
    } catch(err) { toast(err.message, 'error'); }
  };
  window.unbanIpCb = async (ip) => {
    try {
      await API.unbanIp(ip);
      toast(window.i18n.t('toast_ip_unbanned') || 'IP unbanned', 'success');
      loadBans();
    } catch(err) { toast(err.message, 'error'); }
  };

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
      if (tgToken) tgToken.value = settings.telegram_bot_token || '';

      // Security Settings
      try {
        const security = await API.getSecurity();
        const tfaToggle = document.getElementById('security-2fa-enabled');
        if (tfaToggle) tfaToggle.checked = security['2fa_enabled'];
        const adminIdSpan = document.getElementById('security-admin-chatid');
        if (adminIdSpan) adminIdSpan.textContent = security['admin_chat_id'] || 'Not set';
      } catch(e) {}

      // Auto-Updater
      const updInterval = document.getElementById('auto-update-interval');
      const updMode = document.getElementById('auto-update-mode');
      if (updInterval) updInterval.value = settings.auto_update_interval || '0';
      if (updMode) updMode.value = settings.auto_update_mode || 'alert';

      // Auto-Lock Settings
      const lockEnabled = document.getElementById('auto-lock-enabled');
      const lockMinutes = document.getElementById('auto-lock-minutes');
      if (lockEnabled) lockEnabled.checked = settings.auto_lock_enabled === 'true';
      if (lockMinutes) lockMinutes.value = settings.auto_lock_minutes || '15';
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
    if (!msg.data) return;
    const d = msg.data;

    // Dashboard metrics (always update if elements exist)
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

  // Periodic detail metrics refresh
  function startDetailRefresh() {
    stopDetailRefresh();
    detailRefreshInterval = setInterval(async () => {
      if (currentPage !== 'detail' || !currentSoftId) return;
      try {
        const soft = await API.getSoft(currentSoftId);
        // Update metrics fields only (no full re-render)
        if (soft.processMetrics) {
          document.getElementById('detail-cpu').textContent = `${soft.processMetrics.cpu}%`;
          document.getElementById('detail-ram').textContent = formatBytes(soft.processMetrics.memRss);
        }
        if (soft.process) {
          document.getElementById('detail-uptime').textContent = formatUptime(soft.process.uptime);
        }
      } catch {}
    }, 5000);
  }

  function stopDetailRefresh() {
    if (detailRefreshInterval) {
      clearInterval(detailRefreshInterval);
      detailRefreshInterval = null;
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

  // ─── Auto-Input Helpers ───
  function renderAutoInputSteps(sequenceJson) {
    const container = document.getElementById('auto-input-steps');
    container.innerHTML = '';
    let steps = [];
    try { steps = JSON.parse(sequenceJson) || []; } catch {}
    const individualTime = document.getElementById('auto-input-individual-time');
    const hasIndividual = steps.some(s => s.time);
    if (individualTime) individualTime.checked = hasIndividual;

    if (steps.length === 0) return;
    steps.forEach((step, i) => addAutoInputStep(step.text, step.time, i + 1));
    document.querySelectorAll('.auto-input-time-wrap').forEach(el => {
      el.style.display = hasIndividual ? '' : 'none';
    });
  }

  function addAutoInputStep(text = '', time = '', num = null) {
    const container = document.getElementById('auto-input-steps');
    const stepNum = num || container.children.length + 1;
    const row = document.createElement('div');
    row.className = 'cron-ui-row';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <span style="color:var(--accent-hover);font-weight:600;font-size:12px;min-width:24px;">#${stepNum}</span>
      <input type="text" class="auto-input-text" placeholder="Menu item text" value="${escapeHtml(text)}" style="flex:1;">
      <div class="auto-input-time-wrap" style="display:${document.getElementById('auto-input-individual-time').checked ? '' : 'none'};">
        <input type="time" class="auto-input-time glass-input-time" value="${time}" style="width:120px;">
      </div>
      <button type="button" class="btn btn-ghost btn-xs auto-input-remove" style="color:var(--danger);">&times;</button>
    `;
    container.appendChild(row);
    row.querySelector('.auto-input-remove').addEventListener('click', () => {
      row.remove();
      renumberAutoInputSteps();
    });
  }

  function renumberAutoInputSteps() {
    const container = document.getElementById('auto-input-steps');
    container.querySelectorAll('.cron-ui-row').forEach((row, i) => {
      const numSpan = row.querySelector('span');
      if (numSpan) numSpan.textContent = `#${i + 1}`;
    });
  }

  function getAutoInputSteps() {
    const rows = document.querySelectorAll('#auto-input-steps .cron-ui-row');
    const steps = [];
    rows.forEach((row, i) => {
      const text = row.querySelector('.auto-input-text')?.value?.trim() || '';
      const time = row.querySelector('.auto-input-time')?.value || '';
      if (text) steps.push({ step: i + 1, text, time: time || undefined });
    });
    return steps;
  }

  function formatDelayValue(secs) {
    if (!secs || secs === 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0 && s > 0) return `${m}m ${s}s`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  return { init };
})();

// ─── Bootstrap ───
document.addEventListener('DOMContentLoaded', App.init);
