// ═══════════════════════════════════════════
// API Client — Win Server Manager
// ═══════════════════════════════════════════

const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('wsm_token');
  }

  function setToken(token) {
    localStorage.setItem('wsm_token', token);
  }

  function clearToken() {
    localStorage.removeItem('wsm_token');
  }

  function isAuthenticated() {
    return !!getToken();
  }

  async function request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);

    if (res.status === 401 && path !== '/auth/login') {
      clearToken();
      window.dispatchEvent(new Event('auth:expired'));
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  return {
    getToken, setToken, clearToken, isAuthenticated,

    // Auth
    login: (username, password, clientIp) => request('POST', '/auth/login', { username, password, clientIp }),
    logout: () => request('POST', '/auth/logout'),
    getAuthLogs: () => request('GET', '/auth/logs'),

    // Softs
    getSofts: () => request('GET', '/softs'),
    getSoft: (id) => request('GET', `/softs/${id}`),
    startSoft: (id) => request('POST', `/softs/${id}/start`),
    stopSoft: (id) => request('POST', `/softs/${id}/stop`),
    restartSoft: (id) => request('POST', `/softs/${id}/restart`),
    killSoft: (id) => request('POST', `/softs/${id}/kill`),
    resetSoft: (id) => request('POST', `/softs/${id}/reset`),
    updateSoft: (id, data) => request('PUT', `/softs/${id}`, data),
    getCrashLogs: (id) => request('GET', `/softs/${id}/crashlogs`),

    // Discovery & Settings
    scan: () => request('POST', '/discovery/scan'),
    getSettings: () => request('GET', '/settings'),
    updateSetting: (key, value) => request('PUT', '/settings', { key, value }),
    getSecurity: () => request('GET', '/security'),
    updateSecurity: (data) => request('PUT', '/security', data),

    // Metrics
    getMetrics: () => request('GET', '/metrics'),
  };
})();
