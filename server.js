const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ─── Modules ───
const db = require('./modules/database');
const auth = require('./modules/auth');
const discovery = require('./modules/discovery');
const processManager = require('./modules/processManager');
const scheduler = require('./modules/scheduler');
const updater = require('./modules/updater');
const monitor = require('./modules/monitor');
const wsHandler = require('./modules/wsHandler');
const tgBot = require('./modules/telegram');
const apiRoutes = require('./routes/api');

// ─── Init ───
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const PID_FILE = path.join(DATA_DIR, 'server.pid');
const app = express();
const server = http.createServer(app);

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(auth.authMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───
app.use('/api', apiRoutes);

// ─── SPA Fallback ───
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ─── WebSocket ───
const wss = new WebSocketServer({ server, path: '/ws' });
wsHandler.init(wss);

// ─── Bootstrap ───
async function start() {
  // 1. Initialize database
  db.init();
  console.log('[Server] Database initialized');

  // 2. Check if any users exist
  if (db.getUserCount() === 0) {
    console.log('[Server] No users found. Use manager.bat to create an admin account.');
  }

  // 3. Auto-Discovery
  const scanResult = discovery.scan();
  console.log(`[Server] Discovery: ${scanResult.discovered} new soft(s) found`);

  // 4. Start scheduler
  scheduler.init(processManager);
  console.log('[Server] Scheduler initialized');

  // 4.5 Start updater
  updater.start();
  console.log('[Server] Auto-updater initialized');

  // 5. Start OS monitor
  monitor.start(2000);
  console.log('[Server] Monitor started');

  // 6. Start server
  server.listen(PORT, HOST, () => {
    console.log(`[Server] Running on http://${HOST}:${PORT}`);
    console.log(`[Server] WebSocket on ws://${HOST}:${PORT}/ws`);

    // Write PID file for manager.bat
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(PID_FILE, String(process.pid), 'utf-8');
      console.log(`[Server] PID ${process.pid} written to ${PID_FILE}`);
    } catch (err) {
      console.log(`[Server] Warning: could not write PID file: ${err.message}`);
    }

    // Show LAN IPs
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`[Server] LAN: http://${net.address}:${PORT}`);
        }
      }
    }
  });
}

// ─── Graceful Shutdown ───
async function shutdown() {
  console.log('\n[Server] Shutting down...');

  // Remove PID file
  try { fs.unlinkSync(PID_FILE); } catch {}

  // Stop monitor
  monitor.stop();

  // Stop all processes gracefully
  const running = processManager.getAllRunning();
  for (const softId of Object.keys(running)) {
    console.log(`[Server] Stopping ${softId}...`);
    processManager.forceKill(softId);
  }

  // Close WebSocket connections
  wss.clients.forEach(client => client.close());

  // Close server
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.log('[Server] Forced exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Start ───
start().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
