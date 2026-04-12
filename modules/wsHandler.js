const auth = require('./auth');
const processManager = require('./processManager');
const monitor = require('./monitor');

let wssInstance = null;

function init(wss) {
  wssInstance = wss;
  wss.on('connection', (ws, req) => {
    // Extract token from query
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    const user = auth.authenticateWs(token);
    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.user = user;
    ws.subscriptions = new Set();

    // Callback for sending messages to this ws
    const sendToClient = (msg) => {
      if (ws.readyState === 1) { // OPEN
        ws.send(msg);
      }
    };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg, sendToClient);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      // Cleanup all subscriptions
      for (const sub of ws.subscriptions) {
        if (sub.type === 'logs') {
          processManager.unsubscribe(sub.softId, sendToClient);
        } else if (sub.type === 'terminal') {
          processManager.unsubscribe(sub.termKey, sendToClient);
        } else if (sub.type === 'metrics') {
          monitor.unsubscribe(sendToClient);
        } else if (sub.type === 'global') {
          processManager.unsubscribe('__global__', sendToClient);
        }
      }
      ws.subscriptions.clear();
    });

    // Confirm connection
    ws.send(JSON.stringify({ type: 'connected', user: user.username }));
  });
}

async function handleMessage(ws, msg, sendToClient) {
  switch (msg.type) {
    case 'subscribe:logs': {
      const { softId } = msg;
      if (!softId) return;
      processManager.subscribe(softId, sendToClient);
      ws.subscriptions.add({ type: 'logs', softId });

      // Send buffered output
      const buffer = processManager.getBuffer(softId);
      if (buffer.length > 0) {
        ws.send(JSON.stringify({
          type: 'pty:output',
          softId,
          data: buffer.join('\n') + '\n'
        }));
      }
      break;
    }

    case 'unsubscribe:logs': {
      const { softId } = msg;
      if (!softId) return;
      processManager.unsubscribe(softId, sendToClient);
      for (const sub of ws.subscriptions) {
        if (sub.type === 'logs' && sub.softId === softId) {
          ws.subscriptions.delete(sub);
          break;
        }
      }
      break;
    }

    case 'subscribe:metrics': {
      monitor.subscribe(sendToClient);
      ws.subscriptions.add({ type: 'metrics' });
      // Send current metrics immediately
      const current = monitor.getMetrics();
      if (current) {
        ws.send(JSON.stringify({ type: 'metrics', data: current }));
      }
      break;
    }

    case 'unsubscribe:metrics': {
      monitor.unsubscribe(sendToClient);
      for (const sub of ws.subscriptions) {
        if (sub.type === 'metrics') {
          ws.subscriptions.delete(sub);
          break;
        }
      }
      break;
    }

    case 'subscribe:global': {
      processManager.subscribe('__global__', sendToClient);
      ws.subscriptions.add({ type: 'global' });
      break;
    }

    case 'input': {
      const { softId, data } = msg;
      if (!softId || !data) return;
      try {
        processManager.writeToProcess(softId, data);
      } catch {}
      break;
    }

    case 'resize': {
      const { softId, cols, rows } = msg;
      if (!softId) return;
      processManager.resizeProcess(softId, cols || 160, rows || 40);
      break;
    }

    // ─── Multi-terminal messages ───

    case 'terminal:create': {
      const { softId, autoInputTarget, command } = msg;
      if (!softId) return;
      try {
        const result = await processManager.createTerminal(softId, { autoInputTarget, command });
        ws.send(JSON.stringify({ type: 'terminal:created', ...result, softId }));

        // Auto-subscribe to the new terminal
        processManager.subscribe(result.termKey, sendToClient);
        ws.subscriptions.add({ type: 'terminal', termKey: result.termKey });
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
      break;
    }

    case 'terminal:close': {
      const { termKey } = msg;
      if (!termKey) return;
      processManager.unsubscribe(termKey, sendToClient);
      for (const sub of ws.subscriptions) {
        if (sub.type === 'terminal' && sub.termKey === termKey) {
          ws.subscriptions.delete(sub);
          break;
        }
      }
      processManager.removeTerminal(termKey);
      ws.send(JSON.stringify({ type: 'terminal:closed', termKey }));
      break;
    }

    case 'terminal:input': {
      const { termKey, data } = msg;
      if (!termKey || !data) return;
      try {
        processManager.writeToTerminal(termKey, data);
      } catch {}
      break;
    }

    case 'terminal:resize': {
      const { termKey, cols, rows } = msg;
      if (!termKey) return;
      processManager.resizeTerminal(termKey, cols || 160, rows || 40);
      break;
    }

    case 'terminal:subscribe': {
      const { termKey } = msg;
      if (!termKey) return;
      processManager.subscribe(termKey, sendToClient);
      ws.subscriptions.add({ type: 'terminal', termKey });
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
  }
}

function kickSession(sessionId) {
  if (!wssInstance) return;
  for (const client of wssInstance.clients) {
    if (client.user && client.user.sessionId === sessionId) {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(JSON.stringify({ type: 'session:revoked' }));
        client.close(4001, 'Session Revoked');
      }
    }
  }
}

module.exports = { init, kickSession };
