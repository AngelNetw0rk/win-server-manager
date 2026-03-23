const express = require('express');
const router = express.Router();
const db = require('../modules/database');
const auth = require('../modules/auth');
const discovery = require('../modules/discovery');
const processManager = require('../modules/processManager');
const scheduler = require('../modules/scheduler');
const monitor = require('../modules/monitor');

// ─── Auth ───

router.post('/auth/login', async (req, res) => {
  const { username, password, clientIp } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
  if (!ip) ip = clientIp;
  if (!ip || ip === 'unknown') ip = req.ip;

  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const result = await auth.login(username, password, ip, userAgent);
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(result);
  } catch(e) {
    if (e.message === '2FA Timeout') {
      return res.status(401).json({ error: '2FA approval timed out' });
    }
    if (e.message === 'IP Temporarily Blocked') {
      return res.status(403).json({ error: 'IP is temporarily blocked due to rejected 2FA' });
    }
    if (e.message === 'IP Banned') {
      return res.status(403).json({ error: 'IP is permanently banned' });
    }
    return res.status(401).json({ error: e.message || 'Invalid credentials' });
  }
});

router.post('/auth/logout', (req, res) => {
  // JWT is stateless — client should discard the token
  res.json({ ok: true });
});

router.get('/auth/logs', (req, res) => {
  res.json(auth.getAuthLogs());
});

// ─── Softs ───

router.get('/softs', async (req, res) => {
  const softs = db.getAllSofts();
  const running = processManager.getAllRunning();

  const result = await Promise.all(softs.map(async (soft) => {
    const proc = running[soft.id];
    let processMetrics = null;
    if (proc) {
      processMetrics = await monitor.getProcessMetrics(proc.pid);
    }
    return {
      ...soft,
      isRunning: !!proc,
      process: proc || null,
      processMetrics,
      nextRun: scheduler.getNextRun(soft.id)
    };
  }));

  res.json(result);
});

router.get('/softs/:id', async (req, res) => {
  const soft = db.getSoft(req.params.id);
  if (!soft) return res.status(404).json({ error: 'Not found' });

  const procInfo = processManager.getProcessInfo(req.params.id);
  let processMetrics = null;
  if (procInfo) {
    processMetrics = await monitor.getProcessMetrics(procInfo.pid);
  }

  res.json({
    ...soft,
    isRunning: !!procInfo,
    process: procInfo,
    processMetrics,
    nextRun: scheduler.getNextRun(req.params.id)
  });
});

router.post('/softs/:id/start', async (req, res) => {
  try {
    const result = await processManager.startProcess(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/softs/:id/stop', async (req, res) => {
  try {
    await processManager.stopProcess(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/softs/:id/restart', async (req, res) => {
  try {
    const result = await processManager.restartProcess(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/softs/:id/kill', async (req, res) => {
  try {
    await processManager.forceKill(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/softs/:id/reset', (req, res) => {
  try {
    processManager.resetFrozen(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/softs/:id', (req, res) => {
  const soft = db.getSoft(req.params.id);
  if (!soft) return res.status(404).json({ error: 'Not found' });

  db.updateSoft(req.params.id, req.body);

  // Reschedule if cron changed
  if ('cron_schedule' in req.body || 'timezone' in req.body || 'enabled' in req.body) {
    scheduler.updateJob(req.params.id);
  }

  res.json(db.getSoft(req.params.id));
});

router.get('/softs/:id/crashlogs', (req, res) => {
  const logs = db.getCrashLogs(req.params.id);
  res.json(logs);
});

// ─── Discovery ───

router.post('/discovery/scan', (req, res) => {
  const result = discovery.scan();
  // Reload scheduler after discovery
  scheduler.loadAll();
  res.json(result);
});

// ─── Settings ───

router.get('/settings', (req, res) => {
  const settings = db.getAllSettings();
  try {
    const verPath = require('path').join(__dirname, '..', 'VERSION');
    settings.version = require('fs').readFileSync(verPath, 'utf8').trim();
  } catch(e) {
    settings.version = '1.0.0';
  }
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });

  const storeValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  db.setSetting(key, storeValue);

  // If root_paths changed, re-scan
  if (key === 'root_paths') {
    const scanResult = discovery.scan();
    scheduler.loadAll();
    return res.json({ ok: true, scan: scanResult });
  }

  if (['auto_update_interval', 'auto_update_mode'].includes(key)) {
    const updater = require('../modules/updater');
    updater.restart();
  }

  res.json({ ok: true });
});

// ─── Metrics ───

router.get('/metrics', (req, res) => {
  const metrics = monitor.getMetrics();
  res.json(metrics || { error: 'Metrics not yet available' });
});

module.exports = router;
