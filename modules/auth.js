const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const security = require('./security');
const telegram = require('./telegram');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '24h';

function getSecret() {
  return db.getSetting('jwt_secret');
}

const ipBlocks = {}; // Cache for temporarily and permanently blocked IPs

function banIp(ip) {
  ipBlocks[ip] = 'PERMANENT';
}

function unbanIp(ip) {
  delete ipBlocks[ip];
}

function getBannedIps() {
  const now = Date.now();
  return Object.keys(ipBlocks).filter(ip => ipBlocks[ip] === 'PERMANENT' || ipBlocks[ip] > now).map(ip => ({
    ip,
    permanent: ipBlocks[ip] === 'PERMANENT',
    expires: ipBlocks[ip] === 'PERMANENT' ? null : ipBlocks[ip]
  }));
}

// Listen for global IP Ban from Telegram
telegram.on('callback_query', (query) => {
  if (query.data.startsWith('ban_ip_')) {
    const ipToBan = query.data.replace('ban_ip_', '');
    banIp(ipToBan);
    telegram.bot.editMessageReplyMarkup(null, { chat_id: query.message.chat.id, message_id: query.message.message_id }).catch(()=>{});
    telegram.bot.answerCallbackQuery(query.id, { text: `IP ${ipToBan} has been permanently banned.` });
  }
});

function createUser(username, password) {
  security.createUser(username, password);
}

function login(username, password, clientIp, userAgent) {
  const ip = clientIp;

  if (ipBlocks[ip]) {
    if (ipBlocks[ip] === 'PERMANENT') return Promise.reject(new Error('IP Banned'));
    if (Date.now() < ipBlocks[ip]) return Promise.reject(new Error('IP Temporarily Blocked'));
    delete ipBlocks[ip];
  }

  const user = security.getUserByUsername(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    db.addAuthLog(username || '(empty)', ip, userAgent, false);
    telegram.sendAdminAlert(`🔴 <b>Failed Login Attempt</b>\nUser: <code>${username || 'N/A'}</code>\nIP: <code>${ip}</code>\nDevice: <code>${userAgent}</code>`);
    return Promise.reject(new Error('Invalid credentials'));
  }

  const sec = security.getSecurity();
  const generateToken = (sessionId) => {
    return jwt.sign(
      { userId: user.username, username: user.username, sessionId },
      getSecret(),
      { expiresIn: TOKEN_EXPIRY }
    );
  };

  if (sec['2fa_enabled']) {
    if (!telegram.bot) return Promise.reject(new Error('Telegram bot not configured for 2FA'));
    if (!sec.admin_chat_id) return Promise.reject(new Error('No Super Admin registered in Telegram to approve 2FA. Start the bot first.'));
    
    return new Promise((resolve, reject) => {
      const reqId = Math.random().toString(36).substring(7);
      telegram.sendAdminAlert(
        `🟡 <b>2FA Login Request</b>\nUser: <code>${username}</code>\nIP: <code>${ip}</code>\nDevice: <code>${userAgent}</code>`,
        {
          inline_keyboard: [[
             { text: '✅ Подтвердить', callback_data: `2fa_approve_${reqId}` },
             { text: '❌ Отказать', callback_data: `2fa_reject_${reqId}` }
          ]]
        }
      ).then((msg) => {
         if (!msg) return reject(new Error('Failed to send 2FA request'));
         
         const timeout = setTimeout(() => {
           telegram.bot.editMessageReplyMarkup(null, { chat_id: msg.chat.id, message_id: msg.message_id }).catch(()=>{});
           telegram.off('callback_query', onCallback);
           reject(new Error('2FA Timeout'));
         }, 60000);

         const onCallback = (query) => {
            if (query.data === `2fa_approve_${reqId}`) {
              clearTimeout(timeout);
              telegram.bot.editMessageReplyMarkup(null, { chat_id: query.message.chat.id, message_id: query.message.message_id }).catch(()=>{});
              telegram.bot.answerCallbackQuery(query.id, { text: 'Approved' });
              telegram.off('callback_query', onCallback);
              
              const sessionId = require('crypto').randomBytes(16).toString('hex');
              db.addAuthLog(username, ip, userAgent, true, sessionId);
              resolve({ token: generateToken(sessionId), username, sessionId });
            } else if (query.data === `2fa_reject_${reqId}`) {
              clearTimeout(timeout);
              telegram.bot.editMessageReplyMarkup({
                 inline_keyboard: [[ { text: '🚨 Полная блокировка IP', callback_data: `ban_ip_${ip}` } ]]
              }, { chat_id: query.message.chat.id, message_id: query.message.message_id }).catch(()=>{});
              telegram.bot.answerCallbackQuery(query.id, { text: 'Rejected. IP blocked for 2 mins.' });
              telegram.off('callback_query', onCallback);

              ipBlocks[ip] = Date.now() + 2 * 60000;
              db.addAuthLog(username, ip, userAgent, false);
              reject(new Error('IP Temporarily Blocked'));
            }
         };
         telegram.on('callback_query', onCallback);
      }).catch((e) => reject(new Error('Failed to send 2FA request')));
    });
  } else {
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    db.addAuthLog(username, ip, userAgent, true, sessionId);
    telegram.sendAdminAlert(`🟢 <b>Successful Login</b>\nUser: <code>${username}</code>\nIP: <code>${ip}</code>\nDevice: <code>${userAgent}</code>`);
    return Promise.resolve({ token: generateToken(sessionId), username, sessionId });
  }
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

  // Check if session was deactivated via specific sessionId
  if (payload.sessionId) {
    const log = db.getDb().prepare('SELECT session_active FROM auth_log WHERE session_id = ?').get(payload.sessionId);
    if (log && log.session_active === 0) {
      return res.status(401).json({ error: 'Session revoked' });
    }
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
  authMiddleware, authenticateWs, getAuthLogs,
  banIp, unbanIp, getBannedIps
};
