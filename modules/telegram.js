const TelegramBot = require('node-telegram-bot-api');
const security = require('./security');
const db = require('./database');
const EventEmitter = require('events');

class TgBot extends EventEmitter {
  constructor() {
    super();
    this.bot = null;
    this.init();
  }

  init() {
    const token = db.getSetting('telegram_bot_token');
    if (!token) return;

    this.bot = new TelegramBot(token, { polling: true });

    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const sec = security.getSecurity();

      if (!sec.admin_chat_id) {
        sec.admin_chat_id = chatId;
        security.saveSecurity(sec);
        this.bot.sendMessage(chatId, "🟢 You are now registered as Super Admin.");
      } else if (sec.admin_chat_id === chatId) {
        this.bot.sendMessage(chatId, "🟢 Welcome back, Super Admin.");
      } else {
        this.bot.sendMessage(chatId, "🔴 Access denied. A Super Admin is already registered.");
      }
    });

    this.bot.on('callback_query', (query) => {
      const data = query.data;
      const sec = security.getSecurity();
      
      if (query.message.chat.id !== sec.admin_chat_id) return;
      this.emit('callback_query', query);
    });
    
    this.bot.on('polling_error', (error) => {
      // Ignore polling errors to prevent node from crashing
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
