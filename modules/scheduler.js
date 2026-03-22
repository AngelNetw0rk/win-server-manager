const cron = require('node-cron');
const { DateTime } = require('luxon');
const db = require('./database');

// Active cron jobs: Map<softId, CronTask>
const jobs = new Map();

let processManager = null;

function init(pm) {
  processManager = pm;
  loadAll();
}

function loadAll() {
  // Stop all existing jobs
  for (const [id, job] of jobs) {
    job.stop();
  }
  jobs.clear();

  const softs = db.getAllSofts();
  for (const soft of softs) {
    if (soft.cron_schedule && soft.enabled) {
      scheduleJob(soft);
    }
  }
}

function scheduleJob(soft) {
  if (!soft.cron_schedule) return;
  if (!cron.validate(soft.cron_schedule)) {
    console.log(`[Scheduler] Invalid cron: "${soft.cron_schedule}" for ${soft.name}`);
    return;
  }

  // Stop existing job for this soft
  if (jobs.has(soft.id)) {
    jobs.get(soft.id).stop();
  }

  const task = cron.schedule(soft.cron_schedule, () => {
    console.log(`[Scheduler] Cron trigger: ${soft.name}`);

    // Check interval days
    const intervalDays = soft.cron_interval_days || 1;
    if (intervalDays > 1 && soft.last_cron_run) {
      const lastRun = DateTime.fromISO(soft.last_cron_run);
      const now = DateTime.now();
      const daysSinceLastRun = now.diff(lastRun, 'days').days;
      if (daysSinceLastRun < intervalDays) {
        console.log(`[Scheduler] Skipping ${soft.name}: only ${daysSinceLastRun.toFixed(1)}d since last run (interval: ${intervalDays}d)`);
        return;
      }
    }

    // Apply randomization delay
    const randomMinutes = soft.cron_random_minutes || 0;
    let delayMs = 0;
    if (randomMinutes > 0) {
      delayMs = Math.floor(Math.random() * randomMinutes * 60 * 1000);
      const delaySec = Math.floor(delayMs / 1000);
      console.log(`[Scheduler] Randomized delay for ${soft.name}: ${Math.floor(delaySec / 60)}m ${delaySec % 60}s`);
    }

    setTimeout(() => {
      try {
        if (!processManager.isRunning(soft.id)) {
          processManager.startProcess(soft.id);
          // Record last run time
          db.updateSoft(soft.id, { last_cron_run: new Date().toISOString() });
        }
      } catch (err) {
        console.log(`[Scheduler] Failed to start ${soft.name}: ${err.message}`);
      }
    }, delayMs);
  }, {
    timezone: soft.timezone || 'Europe/Moscow'
  });

  jobs.set(soft.id, task);
  console.log(`[Scheduler] Scheduled ${soft.name}: ${soft.cron_schedule} (${soft.timezone})`);
}

function removeJob(softId) {
  if (jobs.has(softId)) {
    jobs.get(softId).stop();
    jobs.delete(softId);
  }
}

function updateJob(softId) {
  removeJob(softId);
  const soft = db.getSoft(softId);
  if (soft && soft.cron_schedule && soft.enabled) {
    scheduleJob(soft);
  }
}

function getNextRun(softId) {
  const soft = db.getSoft(softId);
  if (!soft || !soft.cron_schedule) return null;

  try {
    // Parse cron and compute next run time in the soft's timezone
    const parts = soft.cron_schedule.split(' ');
    const tz = soft.timezone || 'Europe/Moscow';
    const now = DateTime.now().setZone(tz);

    // Simple next-run estimation for common patterns
    const cronParts = parseCron(parts);
    if (!cronParts) return null;

    let next = now.plus({ minutes: 1 }).set({ second: 0, millisecond: 0 });

    // Try up to 1440 minutes (24 hours) to find next match
    for (let i = 0; i < 1440; i++) {
      if (matchesCron(next, cronParts)) {
        return next.toISO();
      }
      next = next.plus({ minutes: 1 });
    }
    return null;
  } catch {
    return null;
  }
}

function parseCron(parts) {
  if (parts.length < 5) return null;
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4]
  };
}

function matchesCron(dt, cp) {
  return matchField(dt.minute, cp.minute)
    && matchField(dt.hour, cp.hour)
    && matchField(dt.day, cp.dayOfMonth)
    && matchField(dt.month, cp.month)
    && matchField(dt.weekday % 7, cp.dayOfWeek); // luxon: 1=Mon..7=Sun, cron: 0=Sun
}

function matchField(value, field) {
  if (field === '*') return true;
  // Handle lists: 1,2,3
  const parts = field.split(',');
  for (const part of parts) {
    // Handle ranges: 1-5
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (value >= a && value <= b) return true;
    }
    // Handle step: */5
    else if (part.includes('/')) {
      const [, step] = part.split('/');
      if (value % parseInt(step) === 0) return true;
    }
    // Direct match
    else if (parseInt(part) === value) return true;
  }
  return false;
}

function getActiveJobs() {
  return Array.from(jobs.keys());
}

module.exports = { init, loadAll, scheduleJob, removeJob, updateJob, getNextRun, getActiveJobs };
