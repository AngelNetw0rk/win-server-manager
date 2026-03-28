const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'manager.db');

let db;

function init() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT,
      ip             TEXT,
      user_agent     TEXT,
      success        INTEGER DEFAULT 0,
      session_active INTEGER DEFAULT 1,
      timestamp      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS softs (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      directory           TEXT NOT NULL,
      command             TEXT DEFAULT 'node index.js',
      enabled             INTEGER DEFAULT 1,
      cron_schedule       TEXT,
      cron_time           TEXT,
      cron_random_minutes INTEGER DEFAULT 0,
      cron_interval_days  INTEGER DEFAULT 1,
      last_cron_run       TEXT,
      timezone            TEXT DEFAULT 'Europe/Moscow',
      max_restarts        INTEGER DEFAULT 5,
      restart_count       INTEGER DEFAULT 0,
      status              TEXT DEFAULT 'stopped',
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crash_logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      soft_id   TEXT NOT NULL,
      log       TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (soft_id) REFERENCES softs(id) ON DELETE CASCADE
    );
  `);

  // Auto-migrate: add new columns if missing
  const cols = getDb().prepare("PRAGMA table_info('softs')").all().map(c => c.name);
  if (!cols.includes('cron_time')) getDb().exec("ALTER TABLE softs ADD COLUMN cron_time TEXT");
  if (!cols.includes('cron_random_minutes')) getDb().exec("ALTER TABLE softs ADD COLUMN cron_random_minutes INTEGER DEFAULT 0");
  if (!cols.includes('cron_interval_days')) getDb().exec("ALTER TABLE softs ADD COLUMN cron_interval_days INTEGER DEFAULT 1");
  if (!cols.includes('last_cron_run')) getDb().exec("ALTER TABLE softs ADD COLUMN last_cron_run TEXT");
  if (!cols.includes('auto_input_sequence')) getDb().exec("ALTER TABLE softs ADD COLUMN auto_input_sequence TEXT");
  if (!cols.includes('terminal_launch_delay')) getDb().exec("ALTER TABLE softs ADD COLUMN terminal_launch_delay INTEGER DEFAULT 0");

  const logCols = getDb().prepare("PRAGMA table_info('auth_log')").all().map(c => c.name);
  if (!logCols.includes('session_active')) getDb().exec("ALTER TABLE auth_log ADD COLUMN session_active INTEGER DEFAULT 1");

  // Default settings
  const defaults = {
    'root_paths': JSON.stringify([]),
    'default_timezone': 'Europe/Moscow',
    'jwt_secret': require('crypto').randomBytes(32).toString('hex'),
    'telegram_bot_token': '',
    'telegram_tma_enabled': 'false',
    'telegram_tma_secret': ''
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value);
  }

  return db;
}

function getDb() {
  if (!db) init();
  return db;
}

// ─── Settings ───

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  ).run(key, value, value);
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings WHERE key != ?').all('jwt_secret');
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); }
    catch { result[row.key] = row.value; }
  }
  return result;
}

// ─── Softs ───

function getAllSofts() {
  return getDb().prepare('SELECT * FROM softs ORDER BY name').all();
}

function getSoft(id) {
  return getDb().prepare('SELECT * FROM softs WHERE id = ?').get(id);
}

function upsertSoft(soft) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO softs (id, name, directory, command, enabled, cron_schedule, timezone, max_restarts, restart_count, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      directory = excluded.directory,
      updated_at = ?
  `).run(
    soft.id, soft.name, soft.directory,
    soft.command || 'node index.js',
    soft.enabled !== undefined ? soft.enabled : 1,
    soft.cron_schedule || null,
    soft.timezone || 'Europe/Moscow',
    soft.max_restarts || 5,
    soft.restart_count || 0,
    soft.status || 'stopped',
    soft.created_at || now,
    now,
    now
  );
}

function updateSoft(id, fields) {
  const allowed = ['command', 'enabled', 'cron_schedule', 'cron_time', 'cron_random_minutes', 'cron_interval_days', 'last_cron_run', 'timezone', 'max_restarts', 'status', 'restart_count', 'auto_input_sequence', 'terminal_launch_delay'];
  const updates = [];
  const values = [];
  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (updates.length === 0) return;
  updates.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE softs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

function deleteSoft(id) {
  getDb().prepare('DELETE FROM softs WHERE id = ?').run(id);
}

// ─── Crash Logs ───

function addCrashLog(softId, log) {
  getDb().prepare('INSERT INTO crash_logs (soft_id, log) VALUES (?, ?)').run(softId, log);
  // Keep only last 50
  getDb().prepare(`
    DELETE FROM crash_logs WHERE soft_id = ? AND id NOT IN (
      SELECT id FROM crash_logs WHERE soft_id = ? ORDER BY id DESC LIMIT 50
    )
  `).run(softId, softId);
}

function getCrashLogs(softId, limit = 10) {
  return getDb().prepare(
    'SELECT * FROM crash_logs WHERE soft_id = ? ORDER BY id DESC LIMIT ?'
  ).all(softId, limit);
}

// ─── Users ───

function getUserByUsername(username) {
  return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function createUserRecord(username, passwordHash) {
  getDb().prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
}

function getUserCount() {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM users').get();
  return row.count;
}

// ─── Auth Log ───

function addAuthLog(username, ip, userAgent, success) {
  const isActive = success ? 1 : 0;
  getDb().prepare(
    'INSERT INTO auth_log (username, ip, user_agent, success, session_active) VALUES (?, ?, ?, ?, ?)'
  ).run(username, ip, userAgent, isActive, isActive);
}

function deactivateSessions(username) {
  if (username) {
    getDb().prepare('UPDATE auth_log SET session_active = 0 WHERE username = ?').run(username);
  }
}

function getAuthLogs(limit = 100) {
  return getDb().prepare(
    'SELECT * FROM auth_log ORDER BY id DESC LIMIT ?'
  ).all(limit);
}

module.exports = {
  init, getDb, getSetting, setSetting, getAllSettings,
  getAllSofts, getSoft, upsertSoft, updateSoft, deleteSoft,
  addCrashLog, getCrashLogs,
  getUserByUsername, createUserRecord, getUserCount,
  addAuthLog, getAuthLogs, deactivateSessions
};
