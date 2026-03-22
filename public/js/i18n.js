const locales = {
  en: {
    // Menu
    nav_dashboard: "Dashboard",
    nav_settings: "Settings",
    nav_logout: "Logout",
    
    // Auth
    login_title: "Authentication",
    login_btn: "Login",
    login_placeholder: "Enter password...",
    
    // Dashboard
    dash_scan: "Scan Paths",
    dash_empty_title: "No software discovered",
    dash_empty_desc: "Add root paths in Settings, then click Scan",
    
    // Metrics
    metric_cpu: "CPU",
    metric_ram: "RAM",
    metric_uptime: "Uptime",
    metric_nextrun: "Next Run",
    metric_restarts: "Restarts",
    
    // Detail View
    terminals_title: "Terminals",
    terminals_add: "+New",
    terminals_top: "Top",
    terminals_bottom: "Bottom",
    terminals_clear: "Clear",
    
    conf_title: "Configuration",
    conf_cmd: "Command",
    conf_cmd_ph: "node index.js",
    conf_schedule: "Schedule",
    conf_time: "Time (HH:MM)",
    conf_interval: "Every N days",
    conf_random: "Randomize start",
    conf_range: "Random range (min)",
    conf_tz: "Timezone",
    conf_maxrest: "Max Restarts",
    conf_save: "Save",
    
    crash_title: "Crash Logs",
    crash_empty: "No crash logs",
    
    // Settings
    set_sys_title: "System",
    set_sys_ver: "Version:",
    set_sys_lang: "Language",
    
    set_dir_title: "Root Directories",
    set_dir_desc: "Paths to scan for software folders.",
    set_dir_add: "Add Path",
    
    set_tz_title: "Default Timezone",
    
    set_tg_title: "Telegram Bot",
    set_tg_desc: "Configure Telegram Bot and Mini App (TMA) integration.",
    set_tg_token: "Bot Token",
    set_tg_tma: "Enable TMA Validation",
    set_tg_secret: "TMA Secret",
    set_tg_save: "Save Telegram Settings",
    
    // Status
    status_running: "🟢 Running",
    status_frozen: "FROZEN",
    status_stopped: "🔴 Stopped",

    // Tooltips
    tt_cmd: "The command executed to start your software (e.g. node index.js or start.bat).",
    tt_time: "Specific time to start the software (converts to cron).",
    tt_interval: "Run the task every N days from the last execution.",
    tt_random: "Delay the start randomly by up to N minutes to avoid CPU spikes.",
    tt_timezone: "Timezone for the cron schedule execution.",
    tt_maxrest: "Maximum number of crashes before the process is completely frozen.",
    tt_lang: "User interface language.",
    tt_root: "Parent folders to automatically scan for subfolders containing your scripts.",
    tt_bottoken: "Telegram Bot API token from @BotFather.",
    tt_tma_enabled: "Validate incoming Telegram WebApp InitData for better security.",
    tt_tma_secret: "Your TMA secret to sign and validate WebApp data."
  },
  ru: {
    // Menu
    nav_dashboard: "Дашборд",
    nav_settings: "Настройки",
    nav_logout: "Выход",
    
    // Auth
    login_title: "Авторизация",
    login_btn: "Войти",
    login_placeholder: "Введите пароль...",
    
    // Dashboard
    dash_scan: "Сканировать",
    dash_empty_title: "Софты не найдены",
    dash_empty_desc: "Добавьте пути в Настройках и нажмите Сканировать",

    // Metrics
    metric_cpu: "ЦПУ",
    metric_ram: "ОЗУ",
    metric_uptime: "Аптайм",
    metric_nextrun: "След. запуск",
    metric_restarts: "Рестарты",
    
    // Detail View
    terminals_title: "Терминалы",
    terminals_add: "+Новый",
    terminals_top: "Вверх",
    terminals_bottom: "Вниз",
    terminals_clear: "Очистить",
    
    conf_title: "Конфигурация",
    conf_cmd: "Команда",
    conf_cmd_ph: "node index.js",
    conf_schedule: "Расписание",
    conf_time: "Время (ЧЧ:ММ)",
    conf_interval: "Каждые N дней",
    conf_random: "Рандомизировать",
    conf_range: "Разброс (мин)",
    conf_tz: "Часовой пояс",
    conf_maxrest: "Макс. рестартов",
    conf_save: "Сохранить",
    
    crash_title: "Логи падений",
    crash_empty: "Нет краш-логов",
    
    // Settings
    set_sys_title: "Система",
    set_sys_ver: "Версия:",
    set_sys_lang: "Язык (Language)",
    
    set_dir_title: "Директории",
    set_dir_desc: "Пути для автопоиска папок с софтами.",
    set_dir_add: "Добавить",
    
    set_tz_title: "Дефолтный Часовой Пояс",
    
    set_tg_title: "Telegram Бот",
    set_tg_desc: "Настройка интеграции с Telegram-ботом и TMA.",
    set_tg_token: "Токен Бота",
    set_tg_tma: "Включить валидацию TMA",
    set_tg_secret: "TMA Secret",
    set_tg_save: "Сохранить настройки TG",
    
    // Status
    status_running: "🟢 Работает",
    status_frozen: "ЗАМОРОЖЕН",
    status_stopped: "🔴 Остановлен",

    // Tooltips
    tt_cmd: "Команда, которая будет выполнена для запуска софта (например, node index.js или start.bat).",
    tt_time: "Конкретное время запуска софта каждый день (конвертируется в cron).",
    tt_interval: "Запускать задачу каждые N дней с момента последнего успешного старта.",
    tt_random: "Случайная задержка старта до N минут для предотвращения пиковой нагрузки на CPU (приложения запускаются не одновременно).",
    tt_timezone: "Часовой пояс, по которому будет ориентироваться расписание запуска.",
    tt_maxrest: "Максимальное число циклических падений, после которых процесс ЗАМОРАЖИВАЕТСЯ и перестает пытаться запуститься.",
    tt_lang: "Язык пользовательского интерфейса.",
    tt_root: "Корневые папки. Менеджер автоматически просканирует все подпапки внутри них в поисках софтов.",
    tt_bottoken: "HTTP токен вашего Telegram бота (от @BotFather).",
    tt_tma_enabled: "Проверять подпись Telegram Mini App для защиты от подделки запросов.",
    tt_tma_secret: "Секретный ключ (часто токен бота) для проверки подписи TMA."
  }
};

class I18n {
  constructor() {
    this.lang = localStorage.getItem('lang') || 'en';
  }

  setLang(lang) {
    if (locales[lang]) {
      this.lang = lang;
      localStorage.setItem('lang', lang);
      this.apply();
    }
  }

  t(key) {
    return locales[this.lang][key] || locales['en'][key] || key;
  }

  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (locales[this.lang][key]) {
        if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'time' && el.type !== 'number') {
          el.placeholder = locales[this.lang][key];
        } else {
          el.textContent = locales[this.lang][key];
        }
      }
    });

    root.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
      const key = el.getAttribute('data-i18n-tooltip');
      if (locales[this.lang][key]) {
        el.setAttribute('data-tooltip', locales[this.lang][key]);
      }
    });
  }
}

window.i18n = new I18n();
