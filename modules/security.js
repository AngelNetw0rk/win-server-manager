const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECURITY_FILE = path.join(DATA_DIR, 'security.json');
const SALT_ROUNDS = 10;

function migrateFromDbIfNeeded() {
  if (fs.existsSync(SECURITY_FILE)) return;
  const data = {
    lang: 'EN',
    strict_mode: false,
    users: []
  };
  
  try {
    const langPath = path.join(DATA_DIR, 'lang.txt');
    if (fs.existsSync(langPath)) {
      data.lang = fs.readFileSync(langPath, 'utf-8').trim() || 'EN';
    }
  } catch(e) {}

  try {
    const db = require('./database').getDb();
    const rows = db.prepare('SELECT * FROM users').all();
    for (const r of rows) {
      data.users.push({ username: r.username, password_hash: r.password_hash });
    }
  } catch(e) {}
  
  saveSecurity(data);
}

function getSecurity() {
  migrateFromDbIfNeeded();
  const raw = fs.readFileSync(SECURITY_FILE, 'utf-8').replace(/^\uFEFF/, '');
  const sec = JSON.parse(raw);
  if (!sec.user_chat_ids) {
    sec.user_chat_ids = [];
  }
  return sec;
}

function saveSecurity(data) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(SECURITY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getUserByUsername(username) {
  const sec = getSecurity();
  return sec.users.find(u => u.username === username);
}

function createUser(username, password) {
  const sec = getSecurity();
  const existing = sec.users.find(u => u.username === username);
  if (existing) throw new Error('User already exists');
  
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  sec.users.push({ username, password_hash: hash });
  saveSecurity(sec);
}

function getUserCount() {
  return getSecurity().users.length;
}

function setStrictMode(strict) {
  const sec = getSecurity();
  sec.strict_mode = strict;
  saveSecurity(sec);
}

function set2FA(enabled) {
  const sec = getSecurity();
  sec['2fa_enabled'] = enabled;
  saveSecurity(sec);
}

function addTgUser(chatId) {
  const sec = getSecurity();
  if (!sec.user_chat_ids) sec.user_chat_ids = [];
  if (!sec.user_chat_ids.includes(chatId)) {
    sec.user_chat_ids.push(chatId);
    saveSecurity(sec);
  }
}

function removeTgUser(chatId) {
  const sec = getSecurity();
  if (!sec.user_chat_ids) sec.user_chat_ids = [];
  sec.user_chat_ids = sec.user_chat_ids.filter(id => id !== chatId);
  saveSecurity(sec);
}

module.exports = {
  getSecurity, saveSecurity, getUserByUsername, createUser, getUserCount, setStrictMode, set2FA,
  addTgUser, removeTgUser
};
