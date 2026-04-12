const net = require('net');
const cp = require('child_process');
const path = require('path');
const db = require('./database');
const fs = require('fs');

const PIPE_NAME = '\\\\.\\pipe\\win-server-manager-pty';
const BROKER_PATH = path.join(__dirname, '..', 'broker.js');
const DATA_DIR = path.join(__dirname, '..', 'data');

// Local Replica State
const processes = new Map(); // softId -> { pid, startedAt, name, buffer[] }
const extraTerminals = new Map(); // termKey -> { pid, label, softId }
const subscribers = new Map(); // Global logic for websockets

let client = null;
let msgIdCounter = 0;
const pendingRequests = new Map();
let isConnecting = false;

// Auto-start broker if not found
function spawnBroker() {
  console.log('[PTY Client] Spawning Broker...');
  try {
    const out = fs.openSync(path.join(DATA_DIR, 'broker_out.log'), 'a');
    const err = fs.openSync(path.join(DATA_DIR, 'broker_err.log'), 'a');
    const child = cp.spawn('node', [BROKER_PATH], {
      detached: true,
      stdio: ['ignore', out, err]
    });
    child.unref();
  } catch (e) {
    console.error('[PTY Client] Failed to spawn broker:', e);
  }
}

function connectToBroker() {
  if (isConnecting || (client && !client.destroyed)) return;
  isConnecting = true;

  console.log('[PTY Client] Attempting to connect to PTY Broker...');
  client = net.createConnection(PIPE_NAME, () => {
    console.log('[PTY Client] Connected to PTY Broker');
    isConnecting = false;
  });

  client.on('error', (err) => {
    isConnecting = false;
    if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
      console.log('[PTY Client] Broker not found. Spawning via separated process...');
      spawnBroker();
      setTimeout(connectToBroker, 2000);
    } else {
      setTimeout(connectToBroker, 2000);
    }
  });

  let buffer = '';
  client.on('data', (data) => {
    buffer += data.toString();
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const msg of parts) {
      if (!msg.trim()) continue;
      try { handleIncomingData(JSON.parse(msg)); } catch (e) {}
    }
  });

  client.on('close', () => {
    console.log('[PTY Client] Connection lost. Reconnecting...');
    isConnecting = false;
    processes.clear();
    client = null;
    setTimeout(connectToBroker, 2000);
  });
}

function handleIncomingData(msg) {
  if (msg.type === 'hello') return;

  if (msg.type === 'sync') {
    processes.clear();
    for (const [id, data] of Object.entries(msg.processes)) {
      processes.set(id, {
        pid: data.pid,
        startedAt: data.startedAt,
        name: data.name,
        buffer: data.buffer || []
      });
      // Force DB state just in case
      db.updateSoft(id, { status: 'running' });
      broadcastStatus(id, 'running');
    }
    // Note: this assumes broker tracks extra terminals, we can extend it later
    return;
  }

  if (msg.type === 'reply') {
    const cb = pendingRequests.get(msg.replyTo);
    if (cb) {
      pendingRequests.delete(msg.replyTo);
      cb(msg.error, msg.data);
    }
    return;
  }

  if (msg.type === 'event') {
    if (msg.event === 'status') {
      broadcastStatus(msg.softId, msg.status);
    } else if (msg.event === 'log') {
      const entry = processes.get(msg.softId);
      if (entry) {
        const lines = msg.data.split('\n');
        for (const l of lines) {
          if (l.trim()) {
            entry.buffer.push(l);
            if (entry.buffer.length > 200) entry.buffer.shift();
          }
        }
      }
      const subs = subscribers.get(msg.softId);
      if (subs) {
        const wmsg = JSON.stringify({ type: 'pty:output', softId: msg.softId, data: msg.data });
        for (const cb of subs) { try { cb(wmsg); } catch {} }
      }
    } else if (msg.event === 'exit') {
      processes.delete(msg.softId);
      const currentSoft = db.getSoft(msg.softId);
      if (currentSoft) {
        if (msg.exitCode !== 0 && msg.exitCode !== null) {
          db.addCrashLog(msg.softId, `Exit code: ${msg.exitCode}\n${msg.lastLogs}`);
          const newCount = (currentSoft.restart_count || 0) + 1;
          if (newCount >= currentSoft.max_restarts) {
            db.updateSoft(msg.softId, { status: 'frozen', restart_count: newCount });
            broadcastStatus(msg.softId, 'frozen');
          } else {
            db.updateSoft(msg.softId, { status: 'stopped', restart_count: newCount });
            broadcastStatus(msg.softId, 'stopped');
          }
        } else {
          db.updateSoft(msg.softId, { status: 'stopped' });
          broadcastStatus(msg.softId, 'stopped');
        }
      }
    } else if (msg.event === 'term_log') {
      const subs = subscribers.get(msg.termKey);
      if (subs) {
        const wmsg = JSON.stringify({ type: 'pty:output', softId: msg.softId, termKey: msg.termKey, data: msg.data });
        for (const cb of subs) { try { cb(wmsg); } catch {} }
      }
    } else if (msg.event === 'term_exit') {
      extraTerminals.delete(msg.termKey);
    }
  }
}

function sendCommand(action, payload) {
  return new Promise((resolve, reject) => {
    if (!client || client.destroyed) return reject(new Error('[PTY Client] Broker disconnected'));
    const msgId = ++msgIdCounter;
    pendingRequests.set(msgId, (err, data) => {
      if (err) reject(new Error(err));
      else resolve(data);
    });
    client.write(JSON.stringify({ action, msgId, ...payload }) + '\n');
  });
}

// ─── Exported API ───

async function startProcess(softId) {
  const soft = db.getSoft(softId);
  if (!soft) throw new Error(`Soft not found: ${softId}`);
  if (processes.has(softId)) throw new Error(`Process already running: ${soft.name}`);
  if (soft.status === 'frozen') throw new Error(`Process is FROZEN: ${soft.name}`);

  const prevStatus = soft.status;
  db.updateSoft(softId, { status: 'running', restart_count: soft.restart_count });
  
  // Create a pending replica immediately so UI sees it
  processes.set(softId, { pid: 0, startedAt: Date.now(), name: soft.name, buffer: [] });
  
  let res;
  try {
    res = await sendCommand('START', { softId, command: soft.command, cwd: soft.directory, name: soft.name });
  } catch (err) {
    // Rollback: remove phantom process and restore DB status
    processes.delete(softId);
    db.updateSoft(softId, { status: prevStatus });
    throw err;
  }
  
  const entry = processes.get(softId);
  if (entry) entry.pid = res.pid;
  
  return { pid: res.pid, name: soft.name };
}

async function stopProcess(softId) {
  if (!processes.has(softId)) {
    db.updateSoft(softId, { status: 'stopped' });
    return;
  }
  await sendCommand('STOP', { softId });
}

async function restartProcess(softId) {
  if (processes.has(softId)) {
    await stopProcess(softId);
    // Wait until exit
    await new Promise((resolve) => {
      const i = setInterval(() => {
        if (!processes.has(softId)) { clearInterval(i); resolve(); }
      }, 500);
      setTimeout(() => { clearInterval(i); resolve(); }, 6000);
    });
  }
  return await startProcess(softId);
}

async function forceKill(softId) {
  if (!processes.has(softId)) return;
  await sendCommand('FORCE_KILL', { softId });
}

function writeToProcess(softId, data) {
  if (!processes.has(softId)) return;
  sendCommand('WRITE', { softId, data }).catch(() => {});
}

function resizeProcess(softId, cols, rows) {
  sendCommand('RESIZE', { softId, cols, rows }).catch(() => {});
}

function getProcessInfo(softId) {
  const entry = processes.get(softId);
  if (!entry) return null;
  return {
    pid: entry.pid,
    startedAt: entry.startedAt,
    uptime: Date.now() - entry.startedAt,
    bufferSize: entry.buffer.length
  };
}

function getBuffer(softId) {
  const entry = processes.get(softId);
  return entry ? entry.buffer : [];
}

function isRunning(softId) {
  return processes.has(softId);
}

function getAllRunning() {
  const result = {};
  for (const [id, entry] of processes.entries()) {
    result[id] = {
      pid: entry.pid,
      startedAt: entry.startedAt,
      uptime: Date.now() - entry.startedAt
    };
  }
  return result;
}

// ─── Inter-broker and WS ───

function subscribe(id, callback) {
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  subscribers.get(id).add(callback);
}

function unsubscribe(id, callback) {
  const subs = subscribers.get(id);
  if (subs) {
    subs.delete(callback);
    if (subs.size === 0) subscribers.delete(id);
  }
}

function broadcastStatus(softId, status) {
  const subs = subscribers.get(softId);
  if (subs) {
    const msg = JSON.stringify({ type: 'status:change', softId, status });
    for (const cb of subs) { try { cb(msg); } catch {} }
  }
  const globalSubs = subscribers.get('__global__');
  if (globalSubs) {
    const msg = JSON.stringify({ type: 'status:change', softId, status });
    for (const cb of globalSubs) { try { cb(msg); } catch {} }
  }
}

function resetFrozen(softId) {
  db.updateSoft(softId, { status: 'stopped', restart_count: 0 });
}

// ─── Extra Terminals ───

async function createTerminal(softId, options = {}) {
  const soft = db.getSoft(softId);
  if (!soft) throw new Error(`Soft not found: ${softId}`);

  const res = await sendCommand('CREATE_TERM', { 
    softId, 
    command: options.command, 
    cwd: soft.directory,
    autoInputTarget: options.autoInputTarget 
  });

  extraTerminals.set(res.termKey, { softId, pid: res.pid, label: res.label });
  return res;
}

function removeTerminal(termKey) {
  sendCommand('REMOVE_TERM', { termKey }).catch(() => {});
  extraTerminals.delete(termKey);
}

function writeToTerminal(termKey, data) {
  sendCommand('WRITE_TERM', { termKey, data }).catch(() => {});
}

function resizeTerminal(termKey, cols, rows) {
  sendCommand('RESIZE_TERM', { termKey, cols, rows }).catch(() => {});
}

// Init
connectToBroker();

module.exports = {
  startProcess, stopProcess, restartProcess, forceKill,
  writeToProcess, resizeProcess,
  getProcessInfo, getBuffer, isRunning, getAllRunning,
  subscribe, unsubscribe, resetFrozen,
  createTerminal, removeTerminal, writeToTerminal, resizeTerminal
};
