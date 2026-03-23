const net = require('net');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const https = require('https');

const PIPE_NAME = '\\\\.\\pipe\\win-server-manager-pty';
const DATA_DIR = path.join(__dirname, 'data');
const SECURITY_JSON = path.join(DATA_DIR, 'security.json');
const DESKTOP_DIR = path.join(os.homedir(), 'Desktop');
const RESCUE_BAT = path.join(DESKTOP_DIR, 'Менеджер Восстановления (Win Server).bat');
const RESCUE_STATE_FILE = path.join(DATA_DIR, 'rescue_state.txt');
const RESCUE_CMD_LOG = path.join(DATA_DIR, 'rescue_cmd_request.txt');

const LOG_BUFFER_SIZE = 200;

// State Maps
const processes = new Map(); // softId -> { pty, buffer[], startedAt, pid, name }
const extraTerminals = new Map(); // termKey -> { pty, softId, pid, label }
let termCounter = 0;

let managerSocket = null;
let eventQueue = []; // Stores missed events
let rescueModeActive = false;
let brokerInterval = null;

// Ensure Data Dir
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getSecurityConfig() {
  try {
    if (fs.existsSync(SECURITY_JSON)) {
      return JSON.parse(fs.readFileSync(SECURITY_JSON, 'utf8'));
    }
  } catch(e) {}
  return { language: 'ru', telegram_bot_token: '', telegram_admin_id: '' };
}

function sendTgAlert(text) {
  const conf = getSecurityConfig();
  if (!conf.telegram_bot_token || !conf.telegram_admin_id) return;
  const url = `https://api.telegram.org/bot${conf.telegram_bot_token}/sendMessage`;
  try {
    const payload = JSON.stringify({ chat_id: conf.telegram_admin_id, text, parse_mode: 'HTML' });
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => { res.on('data', () => {}); });
    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch(e) {}
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
            .replace(/\x1B\].*?\x07/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function sendToManager(msg) {
  if (managerSocket && !managerSocket.destroyed) {
    try {
      managerSocket.write(JSON.stringify(msg) + '\n');
    } catch (e) {
      eventQueue.push(msg);
    }
  } else {
    eventQueue.push(msg);
  }
}

function updateRescueState() {
  if (!rescueModeActive) return;
  const conf = getSecurityConfig();
  const isEn = conf.language === 'en';
  
  let lines = [];
  if (managerSocket && !managerSocket.destroyed) {
    lines.push(isEn 
      ? '[STATUS] Service successfully recovered, return to Web/TG panel. You may close this window.' 
      : '[STATUS] Сервис успешно восстановлен, возвращайтесь в Web/TG админку. Это окно можно закрыть.');
  } else {
    lines.push(isEn 
      ? '[STATUS] Manager unavailable. Broker is running autonomously.'
      : '[STATUS] Менеджер недоступен. Broker работает автономно.');
  }

  lines.push('');
  lines.push(isEn ? '=== ACTIVE PROCESSES ===' : '=== АКТИВНЫЕ ПРОЦЕССЫ ===');
  if (processes.size === 0) {
    lines.push(isEn ? 'No running processes.' : 'Нет запущенных процессов.');
  } else {
    for (const [softId, entry] of processes.entries()) {
      lines.push(`PID: ${entry.pid} | ID: ${softId} | ${isEn?'Name':'Имя'}: ${entry.name}`);
    }
  }
  
  lines.push('');
  lines.push(isEn 
    ? 'To view the terminal of a process, type its ID and press Enter.'
    : 'Для просмотра терминала отдельного процесса введите его ID и нажмите Enter.');
  
  try {
    fs.writeFileSync(RESCUE_STATE_FILE, lines.join('\n'), 'utf8');
  } catch (e) {
    console.error('Failed to write rescue state:', e);
  }
}

function createRescueBat() {
  const conf = getSecurityConfig();
  const isEn = conf.language === 'en';
  
  const title = isEn ? "Emergency Rescue Console (PTY Broker)" : "Аварийная Консоль Управления (PTY Broker)";
  const waitMsg = isEn ? "Waiting for Broker data..." : "Ожидание данных от Broker...";
  const promptMsg = isEn ? "Enter Soft ID (or empty to refresh): " : "Введите ID софта (или пустую строку для обновления): ";
  const sentMsg = isEn ? "Command sent to Broker." : "Команда отправлена Broker'у.";

  const batContent = `@echo off
chcp 65001 >nul
title ${title}
set STATE_FILE="${RESCUE_STATE_FILE}"
set CMD_LOG="${RESCUE_CMD_LOG}"

:loop
cls
if exist %STATE_FILE% (
    type %STATE_FILE%
) else (
    echo ${waitMsg}
)

echo.
set /p softId="${promptMsg}"
if not "%softId%"=="" (
    echo %softId% > %CMD_LOG%
    echo ${sentMsg}
    timeout /t 1 >nul
)
goto loop
`;
  try {
    fs.writeFileSync(RESCUE_BAT, batContent, 'utf8');
  } catch (e) {
    console.error('Failed to create rescue bat:', e);
  }
}

// Ensure clean bat on startup
createRescueBat();

function activateRescueMode() {
  if (rescueModeActive) return;
  rescueModeActive = true;
  updateRescueState();
  
  const conf = getSecurityConfig();
  const isEn = conf.language === 'en';
  sendTgAlert(isEn 
    ? "⚠️ <b>Core Manager is DOWN!</b>\n\nPTY Broker has entered Rescue Mode. Processes are kept alive. An Emergency Console has been created on your server's Desktop."
    : "⚠️ <b>Core Manager УПАЛ!</b>\n\nPTY Broker перешел в Rescue Mode. Процессы удержаны живыми. На рабочем столе сервера создана Аварийная Консоль.");

  // Try to start the bat file on the Desktop if it's not already running
  try {
    cp.spawn('cmd.exe', ['/c', 'start', '""', RESCUE_BAT], { detached: true, stdio: 'ignore' });
  } catch (e) {
    console.error('Failed to launch rescue console window:', e);
  }
}

function deactivateRescueMode() {
  if (!rescueModeActive) return; // Only alert if we were actually IN rescue mode
  rescueModeActive = false;
  updateRescueState(); // Write the "recovered" state so the loop sees it
  
  const conf = getSecurityConfig();
  const isEn = conf.language === 'en';
  sendTgAlert(isEn 
    ? "✅ <b>Core Manager is UP!</b>\n\nPTY Broker has reconnected successfully. Normal operation restored."
    : "✅ <b>Core Manager ПОДНЯТ!</b>\n\nPTY Broker успешно переподключился. Нормальная работа восстановлена.");
}

function processRescueCommands() {
  if (fs.existsSync(RESCUE_CMD_LOG)) {
    try {
      const targetId = fs.readFileSync(RESCUE_CMD_LOG, 'utf8').trim();
      fs.unlinkSync(RESCUE_CMD_LOG);
      
      if (processes.has(targetId)) {
        // We will create a new cmd.exe window directly tailing this process's buffer.
        const procLog = path.join(DATA_DIR, `rescue_log_${targetId}.txt`);
        const tailBat = path.join(DATA_DIR, `rescue_tail_${targetId}.bat`);
        
        // Write the existing buffer
        const entry = processes.get(targetId);
        fs.writeFileSync(procLog, stripAnsi(entry.buffer.join('\n')) + '\n', 'utf8');
        
        const batCode = `@echo off
chcp 65001 >nul
title Терминал [ID:${targetId}]
powershell -Command "Get-Content '${procLog}' -Wait"
`;
        fs.writeFileSync(tailBat, batCode, 'utf8');
        cp.spawn('cmd.exe', ['/c', 'start', '""', tailBat], { detached: true, stdio: 'ignore' });
      }
    } catch (e) {}
  }

  // Update real-time logs for any open tail windows
  for (const [softId, entry] of processes.entries()) {
    const procLog = path.join(DATA_DIR, `rescue_log_${softId}.txt`);
    if (fs.existsSync(procLog)) {
      // Append the last line if we want, but doing it on each write is safer.
    }
  }
}

// Handle IPC Connection
const server = net.createServer((socket) => {
  console.log('Manager connected to PTY Broker');
  
  if (managerSocket) {
    managerSocket.destroy(); // Only one manager at a time
  }
  managerSocket = socket;
  deactivateRescueMode();

  sendToManager({ type: 'hello', msg: 'Broker ready' });

  // Sync state
  const state = { type: 'sync', processes: {}, extraTerminals: {} };
  for (const [id, entry] of processes) {
    state.processes[id] = {
      pid: entry.pid,
      startedAt: entry.startedAt,
      name: entry.name,
      buffer: entry.buffer
    };
  }
  sendToManager(state);

  // Send missed events
  for (const ev of eventQueue) {
    sendToManager(ev);
  }
  eventQueue = [];

  let buffer = '';
  socket.on('data', (data) => {
    buffer += data.toString();
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const message of parts) {
      if (!message.trim()) continue;
      try {
        const payload = JSON.parse(message);
        handleCommand(payload);
      } catch (e) {
        console.error('Invalid IPC message:', message, e);
      }
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });

  socket.on('close', () => {
    console.log('Manager disconnected');
    managerSocket = null;
    activateRescueMode();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Broker already running. Exiting.');
    process.exit(0);
  }
  console.error('Server error:', err);
});

try {
  if (fs.existsSync(PIPE_NAME)) {
    fs.unlinkSync(PIPE_NAME);
  }
} catch (e) {}

server.listen(PIPE_NAME, () => {
  console.log(`PTY Broker listening on ${PIPE_NAME}`);
});

// Periodic background tasks
brokerInterval = setInterval(() => {
  if (rescueModeActive) {
    updateRescueState();
    processRescueCommands();
  }
}, 1000);

// Command Handlers
function handleCommand(cmd) {
  switch (cmd.action) {
    case 'START': {
      const { softId, command, cwd, name } = cmd;
      if (processes.has(softId)) {
        sendToManager({ type: 'reply', replyTo: cmd.msgId, error: 'Already running' });
        return;
      }
      
      const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = os.platform() === 'win32' ? ['/c', command] : ['-c', command];

      let ptyProcess;
      try {
        ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-256color',
          cols: 160,
          rows: 40,
          cwd: cwd,
          env: { ...process.env, FORCE_COLOR: '1' }
        });
      } catch (e) {
        sendToManager({ type: 'reply', replyTo: cmd.msgId, error: e.message });
        return;
      }

      const entry = {
        pty: ptyProcess,
        buffer: [],
        startedAt: Date.now(),
        pid: ptyProcess.pid,
        name: name
      };

      processes.set(softId, entry);
      sendToManager({ type: 'reply', replyTo: cmd.msgId, data: { pid: ptyProcess.pid } });
      sendToManager({ type: 'event', event: 'status', softId, status: 'running' });

      ptyProcess.onData((data) => {
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            entry.buffer.push(line);
            if (entry.buffer.length > LOG_BUFFER_SIZE) {
              entry.buffer.shift();
            }
          }
        }
        sendToManager({ type: 'event', event: 'log', softId, data });
        
        // Write to rescue tail log if exists
        const procLog = path.join(DATA_DIR, `rescue_log_${softId}.txt`);
        if (rescueModeActive && fs.existsSync(procLog)) {
           try { fs.appendFileSync(procLog, stripAnsi(data), 'utf8'); } catch (e) {}
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        processes.delete(softId);
        sendToManager({ type: 'event', event: 'exit', softId, exitCode, lastLogs: entry.buffer.slice(-50).join('\n') });
      });
      break;
    }
    
    case 'STOP': {
      const { softId } = cmd;
      const entry = processes.get(softId);
      if (entry) {
        if (os.platform() === 'win32') {
          try { process.kill(entry.pid, 'SIGTERM'); } catch {}
          setTimeout(() => { if (processes.has(softId)) forceKill(softId); }, 5000);
        } else {
          entry.pty.kill('SIGTERM');
        }
      }
      sendToManager({ type: 'reply', replyTo: cmd.msgId, data: 'stopping' });
      break;
    }

    case 'FORCE_KILL': {
      forceKill(cmd.softId);
      sendToManager({ type: 'reply', replyTo: cmd.msgId, data: 'killed' });
      break;
    }

    case 'WRITE': {
      const entry = processes.get(cmd.softId);
      if (entry) entry.pty.write(cmd.data);
      break;
    }
    
    case 'RESIZE': {
      const entry = processes.get(cmd.softId);
      if (entry) {
        try { entry.pty.resize(cmd.cols, cmd.rows); } catch {}
      }
      break;
    }

    // Terminals logic...
    case 'CREATE_TERM': {
      termCounter++;
      const termKey = `${cmd.softId}:term${termCounter}`;
      const { autoInputTarget, command: termCommand, cwd } = cmd;

      const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
      const args = termCommand ? (os.platform() === 'win32' ? ['/c', termCommand] : ['-c', termCommand]) : [];
      let ptyProc;
      try {
         ptyProc = pty.spawn(shell, args, {
          name: 'xterm-256color', cols: 160, rows: 40, cwd: cwd,
          env: { ...process.env, FORCE_COLOR: '1' }
        });
      } catch (e) {
        sendToManager({ type: 'reply', replyTo: cmd.msgId, error: e.message });
        return;
      }

      const entry = { pty: ptyProc, softId: cmd.softId, pid: ptyProc.pid, label: autoInputTarget || '' };
      extraTerminals.set(termKey, entry);
      
      let autoInputDone = false;
      let outputBuffer = '';

      ptyProc.onData((data) => {
        sendToManager({ type: 'event', event: 'term_log', termKey, softId: cmd.softId, data });
        
        if (autoInputTarget && !autoInputDone) {
          outputBuffer += data;
          const lines = stripAnsi(outputBuffer).split('\n').map(l => l.trim()).filter(Boolean);
          const menuLines = lines.filter(l => l.startsWith('>') || l.match(/^\s{2,}\S/));
          if (menuLines.length >= 2) {
            const activeLine = lines.find(l => l.startsWith('>'));
            if (activeLine) {
              const activeText = activeLine.replace(/^>\s*/, '').trim();
              if (activeText.includes(autoInputTarget)) {
                setTimeout(() => { try { ptyProc.write('\r'); } catch {} }, 200);
                autoInputDone = true;
                outputBuffer = '';
              } else {
                setTimeout(() => { try { ptyProc.write('\x1B[B'); } catch {} }, 150);
                outputBuffer = '';
              }
            }
          }
          if (outputBuffer.length > 4000) outputBuffer = outputBuffer.slice(-2000);
        }
      });

      ptyProc.onExit(() => {
        extraTerminals.delete(termKey);
        sendToManager({ type: 'event', event: 'term_exit', termKey });
      });

      sendToManager({ type: 'reply', replyTo: cmd.msgId, data: { termKey, pid: ptyProc.pid, label: autoInputTarget || '' } });
      break;
    }

    case 'REMOVE_TERM': {
      const entry = extraTerminals.get(cmd.termKey);
      if (entry) {
        try { entry.pty.kill(); } catch {}
        if (os.platform() === 'win32') {
           try { cp.execSync(`taskkill /PID ${entry.pid} /T /F`, { stdio: 'ignore' }); } catch {}
        }
        extraTerminals.delete(cmd.termKey);
      }
      break;
    }

    case 'WRITE_TERM': {
      const entry = extraTerminals.get(cmd.termKey);
      if (entry) entry.pty.write(cmd.data);
      break;
    }
    
    case 'RESIZE_TERM': {
      const entry = extraTerminals.get(cmd.termKey);
      if (entry) {
        try { entry.pty.resize(cmd.cols, cmd.rows); } catch {}
      }
      break;
    }

    case 'PING': {
      sendToManager({ type: 'reply', replyTo: cmd.msgId, data: 'PONG' });
      break;
    }
  }
}

function forceKill(softId) {
  const entry = processes.get(softId);
  if (!entry) return;
  try { entry.pty.kill(); } catch {}
  if (os.platform() === 'win32') {
    try { cp.execSync(`taskkill /PID ${entry.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
  processes.delete(softId);
}

// Graceful exit
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('exit', () => {
    try { if (fs.existsSync(PIPE_NAME)) fs.unlinkSync(PIPE_NAME); } catch {}
});
