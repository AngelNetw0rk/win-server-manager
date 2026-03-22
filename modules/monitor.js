const si = require('systeminformation');
const os = require('os');

let cachedMetrics = null;
let metricsInterval = null;
const metricsSubscribers = new Set();

async function collectMetrics() {
  try {
    const [cpuLoad, mem, netStats, fsSize] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats(),
      si.fsSize()
    ]);

    const cpuCores = os.cpus();
    const uptime = os.uptime();

    cachedMetrics = {
      cpu: {
        usage: Math.round(cpuLoad.currentLoad * 100) / 100,
        cores: cpuCores.length,
        model: cpuCores[0]?.model || 'Unknown'
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usagePercent: Math.round((mem.used / mem.total) * 10000) / 100
      },
      network: netStats.map(iface => ({
        iface: iface.iface,
        rxSec: iface.rx_sec || 0,
        txSec: iface.tx_sec || 0,
        rxTotal: iface.rx_bytes || 0,
        txTotal: iface.tx_bytes || 0
      })),
      disk: fsSize.map(d => ({
        fs: d.fs,
        size: d.size,
        used: d.used,
        usagePercent: d.use
      })),
      uptime,
      timestamp: Date.now()
    };

    // Broadcast to subscribers
    if (metricsSubscribers.size > 0) {
      const msg = JSON.stringify({ type: 'metrics', data: cachedMetrics });
      for (const cb of metricsSubscribers) {
        try { cb(msg); } catch {}
      }
    }
  } catch (err) {
    console.log(`[Monitor] Error collecting metrics: ${err.message}`);
  }
}

function start(intervalMs = 2000) {
  if (metricsInterval) return;
  collectMetrics(); // initial
  metricsInterval = setInterval(collectMetrics, intervalMs);
  console.log(`[Monitor] Started (interval: ${intervalMs}ms)`);
}

function stop() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

function getMetrics() {
  return cachedMetrics;
}

function subscribe(callback) {
  metricsSubscribers.add(callback);
}

function unsubscribe(callback) {
  metricsSubscribers.delete(callback);
}

// Get per-process CPU/RAM via PID
async function getProcessMetrics(pid) {
  try {
    const procs = await si.processes();
    const proc = procs.list.find(p => p.pid === pid);
    if (!proc) return null;
    return {
      pid: proc.pid,
      cpu: Math.round(proc.cpu * 100) / 100,
      mem: proc.mem,
      memRss: proc.memRss * 1024 // KB to bytes
    };
  } catch {
    return null;
  }
}

module.exports = { start, stop, getMetrics, subscribe, unsubscribe, getProcessMetrics };
