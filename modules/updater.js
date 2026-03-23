const fs = require('fs');
const path = require('path');
const https = require('https');
const db = require('./database');
const tgBot = require('./telegram');
const { t } = require('./tg_i18n');
const { exec } = require('child_process');

const REPO = 'AngelNetw0rk/win-server-manager';
const BRANCH = 'main';

let updateTimer = null;

function getLocalVersion() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim();
  } catch (e) {
    return '0.0.0';
  }
}

function fetchRemoteVersion() {
  return new Promise((resolve, reject) => {
    https.get(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/VERSION`, (res) => {
      if (res.statusCode !== 200) return reject(new Error('Failed to fetch version'));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', reject);
  });
}

async function checkForUpdates() {
  try {
    const localVer = getLocalVersion();
    const remoteVer = await fetchRemoteVersion();

    if (remoteVer && remoteVer !== localVer) {
      const mode = db.getSetting('auto_update_mode') || 'alert';
      
      if (mode === 'auto') {
        triggerUpdate();
      } else {
        // 'alert' mode
        const text = t('update_available', { cur: localVer, new: remoteVer });
        const markup = {
          inline_keyboard: [[{ text: t('btn_update_now'), callback_data: 'action_update_manager' }]]
        };
        tgBot.sendAdminAlert(text, markup);
      }
    }
  } catch (e) {
    console.error('[Updater] Failed to check for updates:', e.message);
  }
}

function triggerUpdate() {
  console.log('[Updater] Triggering update process...');
  // For now, call manager.bat with a new argument (will be implemented in Safe Update phase)
  // or just run the standard update if we modify manager.bat now.
  // The prompt says Safe Update is the NEXT task. I'll prepare the hook.
  const batPath = path.join(__dirname, '..', 'manager.bat');
  exec(`start "" /b cmd /c "${batPath}" silent_update`, (err) => {
    if (err) console.error('[Updater] Failed to start update:', err);
  });
}

function start() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }

  const intervalHours = parseInt(db.getSetting('auto_update_interval')) || 0;
  if (intervalHours > 0) {
    const ms = intervalHours * 60 * 60 * 1000;
    updateTimer = setInterval(checkForUpdates, ms);
    console.log(`[Updater] Started watching for updates every ${intervalHours} hours.`);
  }
}

function restart() {
  start();
}

module.exports = { start, restart, checkForUpdates, triggerUpdate, getLocalVersion };
