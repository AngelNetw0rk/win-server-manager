// ═══════════════════════════════════════════
// WebSocket Client — Win Server Manager
// ═══════════════════════════════════════════

const WS = (() => {
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 10;
  const RECONNECT_DELAY = 2000;

  const handlers = new Map(); // type -> Set<callback>

  function connect() {
    const token = API.getToken();
    if (!token) return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws?token=${encodeURIComponent(token)}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectAttempts = 0;
      emit('ws:connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        emit(msg.type, msg);
      } catch {}
    };

    ws.onclose = (event) => {
      ws = null;
      emit('ws:disconnected');

      // Don't reconnect on auth failure
      if (event.code === 4001) return;

      if (reconnectAttempts < MAX_RECONNECT) {
        reconnectTimer = setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, RECONNECT_DELAY * Math.min(reconnectAttempts + 1, 5));
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    reconnectAttempts = MAX_RECONNECT; // prevent reconnect
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function on(type, callback) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(callback);
  }

  function off(type, callback) {
    const set = handlers.get(type);
    if (set) {
      set.delete(callback);
      if (set.size === 0) handlers.delete(type);
    }
  }

  function emit(type, data) {
    const set = handlers.get(type);
    if (set) {
      for (const cb of set) {
        try { cb(data); } catch {}
      }
    }
  }

  // Convenience methods
  function subscribeLogs(softId) {
    send({ type: 'subscribe:logs', softId });
  }

  function unsubscribeLogs(softId) {
    send({ type: 'unsubscribe:logs', softId });
  }

  function subscribeMetrics() {
    send({ type: 'subscribe:metrics' });
  }

  function unsubscribeMetrics() {
    send({ type: 'unsubscribe:metrics' });
  }

  function subscribeGlobal() {
    send({ type: 'subscribe:global' });
  }

  function sendInput(softId, data) {
    send({ type: 'input', softId, data });
  }

  function sendResize(softId, cols, rows) {
    send({ type: 'resize', softId, cols, rows });
  }

  // Multi-terminal methods
  function createTerminal(softId) {
    send({ type: 'terminal:create', softId });
  }

  function closeTerminal(termKey) {
    send({ type: 'terminal:close', termKey });
  }

  function sendTerminalInput(termKey, data) {
    send({ type: 'terminal:input', termKey, data });
  }

  function sendTerminalResize(termKey, cols, rows) {
    send({ type: 'terminal:resize', termKey, cols, rows });
  }

  function subscribeTerminal(termKey) {
    send({ type: 'terminal:subscribe', termKey });
  }

  return {
    connect, disconnect, send,
    on, off,
    subscribeLogs, unsubscribeLogs,
    subscribeMetrics, unsubscribeMetrics,
    subscribeGlobal,
    sendInput, sendResize,
    createTerminal, closeTerminal,
    sendTerminalInput, sendTerminalResize, subscribeTerminal
  };
})();
