const TelegramBot = require('node-telegram-bot-api');
const security = require('./security');
const db = require('./database');
const processManager = require('./processManager');
const updater = require('./updater');
const EventEmitter = require('events');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { t } = require('./tg_i18n');

class TgBot extends EventEmitter {
  constructor() {
    super();
    this.bot = null;
    this.init();
  }

  init() {
    const token = db.getSetting('telegram_bot_token');
    if (!token) return;
    
    if (this.bot) {
      try { this.bot.stopPolling(); } catch(e){}
    }
    
    this.bot = new TelegramBot(token, { polling: true });

    this.bot.onText(/\/(.+)/, (msg, match) => this.handleCommand(msg, match[1]));
    this.bot.on('callback_query', (query) => this.handleCallback(query));
    this.bot.on('polling_error', () => {}); // Ignore polling errors
  }

  getRole(chatId) {
    const sec = security.getSecurity();
    if (sec.admin_chat_id === chatId) return 'admin';
    if (sec.user_chat_ids && sec.user_chat_ids.includes(chatId)) return 'user';
    return null;
  }

  async handleCommand(msg, cmd) {
    const chatId = msg.chat.id;
    const sec = security.getSecurity();

    if (cmd === 'start') {
      if (!sec.admin_chat_id) {
        sec.admin_chat_id = chatId;
        security.saveSecurity(sec);
        return this.bot.sendMessage(chatId, t('registered_admin'));
      }
      const role = this.getRole(chatId);
      if (role === 'admin') {
        return this.bot.sendMessage(chatId, t('welcome_admin'), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t('btn_menu_softs'), callback_data: 'softs_root' }],
              [
                { text: t('btn_menu_screen'), callback_data: 'action_sys_screenshot' },
                { text: t('btn_menu_users'), callback_data: 'action_sys_users' }
              ]
            ]
          }
        });
      }
      if (role === 'user') {
        return this.bot.sendMessage(chatId, t('welcome_user'), {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: t('btn_menu_softs'), callback_data: 'softs_root' }]
            ]
          }
        });
      }
      
      // Request access
      this.bot.sendMessage(chatId, t('pending_approval'));
      const opts = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: t('btn_approve'), callback_data: `approve_${chatId}` },
              { text: t('btn_reject'), callback_data: `reject_${chatId}` }
            ]
          ]
        }
      };
      this.bot.sendMessage(sec.admin_chat_id, t('new_user_req', { id: chatId }), opts);
      return;
    }

    const role = this.getRole(chatId);
    if (!role) return this.bot.sendMessage(chatId, t('access_denied'));

    if (cmd === 'help') {
      return this.bot.sendMessage(chatId, role === 'admin' ? t('help_admin') : t('help_user'), { parse_mode: 'HTML' });
    }

    if (cmd === 'softs') {
      return this.sendFoldersList(chatId);
    }

    if (cmd === 'screenshot' && role === 'admin') {
      return this.sendScreenshot(chatId);
    }

    if (cmd === 'users' && role === 'admin') {
      return this.sendUsersList(chatId);
    }
  }

  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const role = this.getRole(chatId);
    const data = query.data;

    try { this.bot.answerCallbackQuery(query.id); } catch(e){}

    if (!role) {
      return this.bot.sendMessage(chatId, t('access_denied'));
    }

    // Role-specific auth for queries
    if (data.startsWith('approve_') || data.startsWith('reject_') || data.startsWith('revoke_')) {
      if (role !== 'admin') return;
    }

    if (data.startsWith('approve_')) {
      const targetId = parseInt(data.replace('approve_', ''));
      security.addTgUser(targetId);
      this.bot.editMessageText(t('wait_approved', { id: targetId }), { chat_id: chatId, message_id: query.message.message_id });
      this.bot.sendMessage(targetId, t('approved_notif'));
    } 
    else if (data.startsWith('reject_')) {
      const targetId = parseInt(data.replace('reject_', ''));
      this.bot.editMessageText(t('wait_rejected', { id: targetId }), { chat_id: chatId, message_id: query.message.message_id });
      this.bot.sendMessage(targetId, t('rejected_notif'));
    }
    else if (data.startsWith('revoke_')) {
      const targetId = parseInt(data.replace('revoke_', ''));
      security.removeTgUser(targetId);
      this.sendUsersList(chatId, query.message.message_id);
    }
    else if (data === 'softs_root') {
      this.sendFoldersList(chatId, query.message.message_id);
    }
    else if (data.startsWith('folder_')) {
      const folderPath = data.replace('folder_', '');
      this.sendSoftsInFolder(chatId, folderPath, query.message.message_id);
    }
    else if (data.startsWith('soft_')) {
      const targetId = data.replace('soft_', '');
      this.sendSoftMenu(chatId, targetId, query.message.message_id);
    }
    else if (data.startsWith('action_')) {
      // action_start_ID, action_stop_ID, etc
      const parts = data.split('_');
      const action = parts[1];
      const targetId = parts.slice(2).join('_');

      if (action === 'start') processManager.startProcess(targetId);
      else if (action === 'stop') processManager.stopProcess(targetId);
      else if (action === 'restart') processManager.restartProcess(targetId);
      else if (action === 'logs') {
        this.sendErrorLogs(chatId, targetId);
        return;
      }

      // Re-render soft menu after 1.5 second to update status
      setTimeout(() => {
        this.sendSoftMenu(chatId, targetId, query.message.message_id);
      }, 1500);
      return;
    }
    else if (data === 'action_update_manager') {
      this.bot.editMessageText(t('update_available', { cur: updater.getLocalVersion(), new: '...' }) + '\n\n<i>Update initiated...</i>', { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML' }).catch(()=>{});
      updater.triggerUpdate();
      return;
    }
    else if (data === 'action_sys_screenshot') {
      this.sendScreenshot(chatId);
      return;
    }
    else if (data === 'action_sys_users') {
      this.sendUsersList(chatId, query.message.message_id);
      return;
    }
    else {
      // Pass other callbacks through the event emitter to auth.js
      if (role === 'admin') this.emit('callback_query', query);
    }
  }

  async sendFoldersList(chatId, messageId = null) {
    const softs = db.getAllSofts();
    const groups = {};
    softs.forEach(s => {
       const parent = path.dirname(s.directory);
       if (!groups[parent]) groups[parent] = [];
       groups[parent].push(s);
    });

    const keys = Object.keys(groups);
    const inline_keyboard = keys.map((k, i) => [{ text: `📁 ${path.basename(k)}`, callback_data: `folder_${i}` }]);
    
    if(!this.folderMap) this.folderMap = keys;
    
    const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard } };
    if (messageId) {
      await this.bot.editMessageText(t('folders_title'), { chat_id: chatId, message_id: messageId, ...opts }).catch(()=>{});
    } else {
      await this.bot.sendMessage(chatId, t('folders_title'), opts);
    }
  }

  async sendSoftsInFolder(chatId, folderIndex, messageId) {
    const folderPath = this.folderMap[parseInt(folderIndex)];
    const softs = db.getAllSofts().filter(s => path.dirname(s.directory) === folderPath);
    
    const inline_keyboard = softs.map(s => {
      const indicator = s.status === 'running' ? '🟢' : '🔴';
      return [{ text: `${indicator} ${s.name}`, callback_data: `soft_${s.id}` }];
    });
    inline_keyboard.push([{ text: t('back_to_folders'), callback_data: 'softs_root' }]);

    const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard } };
    await this.bot.editMessageText(`📁 <b>${path.basename(folderPath)}</b>`, { chat_id: chatId, message_id: messageId, ...opts }).catch(()=>{});
  }

  async sendSoftMenu(chatId, softId, messageId) {
    const soft = db.getSoft(softId);
    if (!soft) return;

    let statusTxt = soft.status === 'running' ? '🟢 Running' : '🔴 Stopped';
    
    const running = processManager.getAllRunning()[softId];
    let uptime = '0s';
    if (running && running.startedAt) {
      statusTxt = '🟢 Running';
      const diffStr = require('luxon').DateTime.now().diff(require('luxon').DateTime.fromMillis(running.startedAt)).toFormat("hh:mm:ss");
      uptime = diffStr.split('.')[0] || diffStr; // remove milliseconds if present
    }

    const text = t('soft_status', { name: soft.name, status: statusTxt, uptime });
    
    const inline_keyboard = [
      [
        { text: t('btn_start'), callback_data: `action_start_${soft.id}` },
        { text: t('btn_stop'), callback_data: `action_stop_${soft.id}` }
      ],
      [
        { text: t('btn_restart'), callback_data: `action_restart_${soft.id}` },
        { text: t('btn_logs'), callback_data: `action_logs_${soft.id}` }
      ],
      [ { text: t('back_to_folders'), callback_data: 'softs_root' } ]
    ];

    const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard } };
    await this.bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...opts }).catch(()=>{});
  }

  async sendErrorLogs(chatId, softId) {
    const soft = db.getSoft(softId);
    if (!soft) return;
    const logs = db.getCrashLogs(softId, 5);
    if (!logs || logs.length === 0) {
      return this.bot.sendMessage(chatId, t('no_logs'));
    }

    const header = t('logs_title', { name: soft.name });
    let body = "";
    logs.reverse().forEach(l => {
      body += `[${l.timestamp}]\n${l.log.trim()}\n\n`;
    });

    const limitBody = body.substring(0, 3000).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const text = `${header}\n<blockquote expandable>${limitBody}</blockquote>`;
    await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  async sendUsersList(chatId, messageId = null) {
    const sec = security.getSecurity();
    const users = sec.user_chat_ids || [];
    const inline_keyboard = [];
    
    users.forEach(id => {
      inline_keyboard.push([{ text: `User: ${id}`, callback_data: `ignore` }, { text: t('btn_revoke'), callback_data: `revoke_${id}` }]);
    });
    
    if(inline_keyboard.length === 0) {
       inline_keyboard.push([{ text: "No users found", callback_data: "ignore" }]);
    }

    const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard } };
    if (messageId) {
      await this.bot.editMessageText(t('users_title'), { chat_id: chatId, message_id: messageId, ...opts }).catch(()=>{});
    } else {
      await this.bot.sendMessage(chatId, t('users_title'), opts);
    }
  }

  async sendScreenshot(chatId) {
    this.bot.sendMessage(chatId, t('screenshot_taking'));
    const tmpPath = path.join(__dirname, '..', 'data', 'screenshot.png');
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height; $graphics = [System.Drawing.Graphics]::FromImage($bmp); $graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $bmp.Size); $bmp.Save('${tmpPath}'); $graphics.Dispose(); $bmp.Dispose();`;
    
    exec(`powershell -noprofile -command "${psCommand}"`, (err) => {
      if (err || !fs.existsSync(tmpPath)) {
        return this.bot.sendMessage(chatId, t('screenshot_failed', { err: err ? err.message : 'File not created' }));
      }
      this.bot.sendPhoto(chatId, tmpPath).then(() => {
        try { fs.unlinkSync(tmpPath); } catch(e){}
      }).catch(e => {
        this.bot.sendMessage(chatId, t('screenshot_failed', { err: e.message }));
      });
    });
  }

  async sendAdminAlert(text, replyMarkup = null) {
    if (!this.bot) return;
    const sec = security.getSecurity();
    if (!sec.admin_chat_id) return;

    const opts = { parse_mode: 'HTML' };
    if (replyMarkup) opts.reply_markup = replyMarkup;

    try {
      return await this.bot.sendMessage(sec.admin_chat_id, text, opts);
    } catch(e) {
      console.error('Failed to send Telegram alert:', e.message);
    }
  }
}

const tgBotInstance = new TgBot();
module.exports = tgBotInstance;
