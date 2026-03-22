const pty = require('node-pty');
const path = require('path');
const os = require('os');
const db = require('./database');

// Active processes: Map<softId, { pty, buffer[], startedAt, pid }>
const processes = new Map();
// Subscribers: Map<softId, Set<wsCallback>>
const subscribers = new Map();
// Extra terminals: Map<termKey, { pty, softId }>
const extraTerminals = new Map();
let termCounter = 0;

const LOG_BUFFER_SIZE = 200;

// Strip ANSI escape sequences for clean crash logs
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
            .replace(/\x1B\].*?\x07/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function startProcess(softId) {
  const soft = db.getSoft(softId);
  if (!soft) throw new Error(`Soft not found: ${softId}`);

  if (processes.has(softId)) {
    throw new Error(`Process already running: ${soft.name}`);
  }

  // Check FROZEN
  if (soft.status === 'frozen') {
    throw new Error(`Process is FROZEN (restart limit reached): ${soft.name}`);
  }

  const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
  const args = os.platform() === 'win32' ? ['/c', soft.command] : ['-c', soft.command];

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 160,
    rows: 40,
    cwd: soft.directory,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  const entry = {
    pty: ptyProcess,
    buffer: [],
    startedAt: Date.now(),
    pid: ptyProcess.pid
  };

  processes.set(softId, entry);
  db.updateSoft(softId, { status: 'running', restart_count: soft.restart_count });

  // PTY output handler
  ptyProcess.onData((data) => {
    // Buffer log lines
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        entry.buffer.push(line);
        if (entry.buffer.length > LOG_BUFFER_SIZE) {
          entry.buffer.shift();
        }
      }
    }

    // Broadcast to subscribers
    const subs = subscribers.get(softId);
    if (subs) {
      const msg = JSON.stringify({ type: 'pty:output', softId, data });
      for (const cb of subs) {
        try { cb(msg); } catch {}
      }
    }
  });

  // Process exit handler
  ptyProcess.onExit(({ exitCode }) => {
    processes.delete(softId);

    const currentSoft = db.getSoft(softId);
    if (!currentSoft) return;

    // Save crash log if abnormal exit
    if (exitCode !== 0 && exitCode !== null) {
      const lastLines = entry.buffer.slice(-50).join('\n');
      db.addCrashLog(softId, `Exit code: ${exitCode}\n${stripAnsi(lastLines)}`);

      const newCount = (currentSoft.restart_count || 0) + 1;
      if (newCount >= currentSoft.max_restarts) {
        db.updateSoft(softId, { status: 'frozen', restart_count: newCount });
        broadcastStatus(softId, 'frozen');
      } else {
        db.updateSoft(softId, { status: 'stopped', restart_count: newCount });
        broadcastStatus(softId, 'stopped');
      }
    } else {
      db.updateSoft(softId, { status: 'stopped' });
      broadcastStatus(softId, 'stopped');
    }
  });

  broadcastStatus(softId, 'running');
  return { pid: ptyProcess.pid, name: soft.name };
}

function stopProcess(softId) {
  const entry = processes.get(softId);
  if (!entry) {
    db.updateSoft(softId, { status: 'stopped' });
    return;
  }

  // Graceful kill on Windows
  if (os.platform() === 'win32') {
    try {
      process.kill(entry.pid, 'SIGTERM');
    } catch {}
    // Force kill after 5 seconds
    setTimeout(() => {
      if (processes.has(softId)) {
        forceKill(softId);
      }
    }, 5000);
  } else {
    entry.pty.kill('SIGTERM');
    setTimeout(() => {
      if (processes.has(softId)) {
        entry.pty.kill('SIGKILL');
      }
    }, 5000);
  }
}

function restartProcess(softId) {
  return new Promise((resolve) => {
    if (processes.has(softId)) {
      stopProcess(softId);
      // Wait for process to fully stop
      const check = setInterval(() => {
        if (!processes.has(softId)) {
          clearInterval(check);
          setTimeout(() => {
            const result = startProcess(softId);
            resolve(result);
          }, 500);
        }
      }, 200);
      // Safety timeout
      setTimeout(() => {
        clearInterval(check);
        if (processes.has(softId)) {
          forceKill(softId);
        }
        setTimeout(() => {
          const result = startProcess(softId);
          resolve(result);
        }, 500);
      }, 7000);
    } else {
      const result = startProcess(softId);
      resolve(result);
    }
  });
}

function forceKill(softId) {
  const entry = processes.get(softId);
  if (!entry) return;

  try {
    entry.pty.kill();
  } catch {}

  // Ensure cleanup on Windows
  if (os.platform() === 'win32') {
    try {
      require('child_process').execSync(`taskkill /PID ${entry.pid} /T /F`, { stdio: 'ignore' });
    } catch {}
  }

  processes.delete(softId);
  db.updateSoft(softId, { status: 'stopped' });
  broadcastStatus(softId, 'stopped');
}

function writeToProcess(softId, data) {
  const entry = processes.get(softId);
  if (!entry) throw new Error('Process not running');
  entry.pty.write(data);
}

function resizeProcess(softId, cols, rows) {
  const entry = processes.get(softId);
  if (!entry) return;
  try { entry.pty.resize(cols, rows); } catch {}
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
  for (const [id, entry] of processes) {
    result[id] = {
      pid: entry.pid,
      startedAt: entry.startedAt,
      uptime: Date.now() - entry.startedAt
    };
  }
  return result;
}

// ─── Subscriber management ───

function subscribe(softId, callback) {
  if (!subscribers.has(softId)) {
    subscribers.set(softId, new Set());
  }
  subscribers.get(softId).add(callback);
}

function unsubscribe(softId, callback) {
  const subs = subscribers.get(softId);
  if (subs) {
    subs.delete(callback);
    if (subs.size === 0) subscribers.delete(softId);
  }
}

function broadcastStatus(softId, status) {
  const subs = subscribers.get(softId);
  if (subs) {
    const msg = JSON.stringify({ type: 'status:change', softId, status });
    for (const cb of subs) {
      try { cb(msg); } catch {}
    }
  }
  // Also broadcast to global subscribers
  const globalSubs = subscribers.get('__global__');
  if (globalSubs) {
    const msg = JSON.stringify({ type: 'status:change', softId, status });
    for (const cb of globalSubs) {
      try { cb(msg); } catch {}
    }
  }
}

// Reset frozen state
function resetFrozen(softId) {
  db.updateSoft(softId, { status: 'stopped', restart_count: 0 });
}

// ─── Extra Terminal Management ───

function createTerminal(softId, options = {}) {
  const soft = db.getSoft(softId);
  if (!soft) throw new Error(`Soft not found: ${softId}`);

  termCounter++;
  const termKey = `${softId}:term${termCounter}`;
  const { autoInputTarget, command } = options;

  const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
  const args = command ? (os.platform() === 'win32' ? ['/c', command] : ['-c', command]) : [];
  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 160,
    rows: 40,
    cwd: soft.directory,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  const entry = { pty: ptyProcess, softId, pid: ptyProcess.pid, label: autoInputTarget || '' };
  extraTerminals.set(termKey, entry);

  // Auto-input: navigate inquirer menus
  let autoInputDone = false;
  let outputBuffer = '';

  // Broadcast output to terminal-specific subscribers
  ptyProcess.onData((data) => {
    const subs = subscribers.get(termKey);
    if (subs) {
      const msg = JSON.stringify({ type: 'pty:output', softId, termKey, data });
      for (const cb of subs) {
        try { cb(msg); } catch {}
      }
    }

    // Auto-input logic: search for inquirer menu pattern
    if (autoInputTarget && !autoInputDone) {
      outputBuffer += data;
      // Check if buffer contains a menu with our target
      const lines = stripAnsi(outputBuffer).split('\n').map(l => l.trim()).filter(Boolean);
      const menuLines = lines.filter(l => l.startsWith('>') || l.match(/^\s{2,}\S/));
      if (menuLines.length >= 2) {
        const activeLine = lines.find(l => l.startsWith('>'));
        if (activeLine) {
          const activeText = activeLine.replace(/^>\s*/, '').trim();
          if (activeText.includes(autoInputTarget)) {
            // Found our target — press Enter
            setTimeout(() => { try { ptyProcess.write('\r'); } catch {} }, 200);
            autoInputDone = true;
            outputBuffer = '';
          } else {
            // Not our target — press arrow down
            setTimeout(() => { try { ptyProcess.write('\x1B[B'); } catch {} }, 150);
            outputBuffer = '';
          }
        }
      }
      // Prevent buffer from growing too large
      if (outputBuffer.length > 4000) outputBuffer = outputBuffer.slice(-2000);
    }
  });

  ptyProcess.onExit(() => {
    extraTerminals.delete(termKey);
  });

  return { termKey, pid: ptyProcess.pid, label: autoInputTarget || '' };
}

function removeTerminal(termKey) {
  const entry = extraTerminals.get(termKey);
  if (!entry) return;
  try { entry.pty.kill(); } catch {}
  if (os.platform() === 'win32') {
    try { require('child_process').execSync(`taskkill /PID ${entry.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
  extraTerminals.delete(termKey);
}

function writeToTerminal(termKey, data) {
  const entry = extraTerminals.get(termKey);
  if (!entry) throw new Error('Terminal not found');
  entry.pty.write(data);
}

function resizeTerminal(termKey, cols, rows) {
  const entry = extraTerminals.get(termKey);
  if (!entry) return;
  try { entry.pty.resize(cols, rows); } catch {}
}

module.exports = {
  startProcess, stopProcess, restartProcess, forceKill,
  writeToProcess, resizeProcess,
  getProcessInfo, getBuffer, isRunning, getAllRunning,
  subscribe, unsubscribe, resetFrozen,
  createTerminal, removeTerminal, writeToTerminal, resizeTerminal
};
