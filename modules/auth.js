const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '24h';

function getSecret() {
  return db.getSetting('jwt_secret');
}

function createUser(username, password) {
  const existing = db.getUserByUsername(username);
  if (existing) throw new Error('User already exists');
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  db.createUserRecord(username, hash);
}

function login(username, password, ip, userAgent) {
  const user = db.getUserByUsername(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    db.addAuthLog(username || '(empty)', ip, userAgent, false);
    return null;
  }

  db.addAuthLog(username, ip, userAgent, true);

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    getSecret(),
    { expiresIn: TOKEN_EXPIRY }
  );

  return { token, username: user.username };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

// Express middleware
function authMiddleware(req, res, next) {
  // Allow login endpoint
  if (req.path === '/api/auth/login') return next();
  // Allow static files
  if (!req.path.startsWith('/api/')) return next();

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = payload;
  next();
}

// WebSocket auth
function authenticateWs(token) {
  return verifyToken(token);
}

function getAuthLogs() {
  return db.getAuthLogs(100);
}

module.exports = {
  createUser, login, verifyToken,
  authMiddleware, authenticateWs, getAuthLogs
};
