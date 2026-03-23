const security = require('./security');

const dictionary = {
  EN: {
    welcome_admin: "🟢 Welcome back, Super Admin.",
    welcome_user: "🟢 Welcome back, User.\n{t}",
    registered_admin: "🟢 You are now registered as Super Admin.",
    access_denied: "🔴 Access denied.",
    pending_approval: "🟡 Your request has been sent to the Super Admin for approval.",
    new_user_req: "🔔 New access request from user ID <b>{id}</b>.\nApprove as User?",
    btn_approve: "✅ Approve",
    btn_reject: "❌ Reject",
    approved_notif: "🟢 Your access has been approved! You are now a User.\nType /help to see available commands.",
    rejected_notif: "🔴 Your access request was rejected.",
    wait_approved: "✅ User {id} approved.",
    wait_rejected: "❌ User {id} rejected.",
    help_admin: "🛠 <b>Super Admin Commands:</b>\n/start - Start bot\n/help - Show this message\n/softs - List and manage software\n/screenshot - Get server screenshot\n/users - Manage users",
    help_user: "🛠 <b>User Commands:</b>\n/start - Start bot\n/help - Show this message\n/softs - List and manage software",
    screenshot_taking: "📸 Taking screenshot...",
    screenshot_failed: "🔴 Failed to take screenshot: {err}",
    folders_title: "📁 <b>Folders:</b>",
    back_to_folders: "🔙 Back",
    soft_status: "<b>{name}</b>\nStatus: {status}\nUptime: {uptime}",
    btn_start: "▶️ Start",
    btn_stop: "🛑 Stop",
    btn_restart: "🔄 Restart",
    btn_logs: "📄 Error Logs",
    logs_title: "📄 <b>Error Logs for {name}</b>",
    no_logs: "No crash logs found.",
    unknown_command: "🔴 Unknown command.",
    users_title: "👥 <b>Users:</b>",
    btn_revoke: "❌ Revoke",
    update_available: "🔔 <b>New version available!</b>\nCurrent: {cur}\nNew: {new}",
    btn_update_now: "🔄 Update Now"
  },
  RU: {
    welcome_admin: "🟢 С возвращением, Super Admin.",
    welcome_user: "🟢 С возвращением, User.\n{t}",
    registered_admin: "🟢 Вы успешно зарегистрированы как Super Admin.",
    access_denied: "🔴 В доступе отказано.",
    pending_approval: "🟡 Ваш запрос отправлен главному администратору на одобрение.",
    new_user_req: "🔔 Новый запрос на доступ от ID <b>{id}</b>.\nОдобрить как User?",
    btn_approve: "✅ Одобрить",
    btn_reject: "❌ Отказать",
    approved_notif: "🟢 Ваш доступ одобрен! Теперь вы User.\nВведите /help для списка команд.",
    rejected_notif: "🔴 Ваш запрос на доступ отклонён.",
    wait_approved: "✅ Пользователь {id} одобрен.",
    wait_rejected: "❌ Пользователь {id} отклонён.",
    help_admin: "🛠 <b>Команды Super Admin:</b>\n/start - Запуск бота\n/help - Показать это сообщение\n/softs - Управление скриптами\n/screenshot - Скриншот сервера\n/users - Управление пользователями",
    help_user: "🛠 <b>Команды User:</b>\n/start - Запуск бота\n/help - Показать это сообщение\n/softs - Управление скриптами",
    screenshot_taking: "📸 Делаю скриншот...",
    screenshot_failed: "🔴 Ошибка при создании скриншота: {err}",
    folders_title: "📁 <b>Папки:</b>",
    back_to_folders: "🔙 Назад",
    soft_status: "<b>{name}</b>\nСтатус: {status}\nАптайм: {uptime}",
    btn_start: "▶️ Старт",
    btn_stop: "🛑 Стоп",
    btn_restart: "🔄 Рестарт",
    btn_logs: "📄 Логи",
    logs_title: "📄 <b>Логи ошибок для {name}</b>",
    no_logs: "Логи не найдены.",
    unknown_command: "🔴 Неизвестная команда.",
    users_title: "👥 <b>Пользователи:</b>",
    btn_revoke: "❌ Удалить",
    update_available: "🔔 <b>Доступна новая версия!</b>\nТекущая: {cur}\nНовая: {new}",
    btn_update_now: "🔄 Обновить сейчас"
  }
};

function t(key, vars = {}) {
  const sec = security.getSecurity();
  const lang = sec.lang || 'EN';
  let text = (dictionary[lang] && dictionary[lang][key]) ? dictionary[lang][key] : dictionary['EN'][key] || key;
  for (const k in vars) {
    text = text.replace(`{${k}}`, vars[k]);
  }
  return text;
}

module.exports = { t };
