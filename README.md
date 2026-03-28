# Win Server Manager (C2 Web Panel)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14.0.0-success)](#)
[![Version](https://img.shields.io/badge/Version-v1.6.2-orange)](#)

*🇷🇺 [Русская документация ниже](#-win-server-manager-c2-панель)*

**The ultimate standalone C2 Web Panel for Windows Server.** Manage your bots, automated scripts, and background processes with zero friction. Fully optimized for Mobile & Telegram Mini Apps (TMA).

### Why Win Server Manager?
* **Zero-Dependency Install**: Deploy on a fresh Windows Server in 1 click using PowerShell.
* **Mobile-First UI**: Fully responsive interface without feature-loss, built for smartphones and touch devices.
* **Secure Access Anywhere**: Built-in Cloudflare Tunnels and Telegram Auth validation.
* **Smart OTA Updates**: Pull latest updates directly from GitHub without losing your configs or DB.

### Core Features
* **Grid Multi-Terminals**: Run 1, 2, or 4 live interactive terminals (PTY) simultaneously on one screen.
* **Auto-Discovery**: Just set your root directories, and the manager will detect and list all your script folders.
* **Advanced Cron Scheduler**: Timezone-aware, "Every N days" intervals, and randomized startup delays to mimic human behavior.
* **Process Watchdog**: Start, Stop, Force Kill, and Auto-Restart failed background scripts automatically.
* **Real-time Metrics**: Live CPU, RAM, and Network I/O monitoring.

### What's New in v1.6.2 (UI/UX Phase 2)
* **Auto-Lock Session Engine**: Inactive sessions are now proactively locked out with a configurable timeout directly from the Settings interface. This prevents dashboard tampering when left unattended.
* **Instant Session Disconnect**: Enabled Beacon API integration to instantly deactivate browser sessions on the Auth Log exactly when the user closes their browser tab or navigates away.
* **Glassmorphism Patches**: Fixed UI contrast issues where toggle switches were hard to see against active components or terminal controls.

### What's New in v1.6.1 (Bugfix Phase 1)
* **Bulletproof OTA & Parser Fix**: Reworked the `manager.bat` update generator entirely. Removed unnecessary VBS script regeneration during OTA that crashed the CMD byte-parser, preventing the updater from properly reinstalling the new version.
* **Safe Filesystem Relocking**: The update script now forcefully unbinds `manager.bat` via process detachment (`start cmd /c`), permanently resolving "Nothing has updated" errors caused by file usage locks.
* **Smart Installer Recovery**: Added automated graceful shutdowns for running Node.js server and Cloudflared tunnels in `install.ps1` to prevent "Folder in Use" Access Denied loops.

### What's New in v1.6.0 (Auth UI & Telegram Updates)
* **Accurate Login Errors**: Fixed a bug where entering invalid credentials would falsely display a "Session expired" UI error due to the frontend indiscriminately intercepting 401 HTTP codes. Real backend errors (such as IP blocks, strict mode rejections, and invalid credentials) are now natively displayed.
* **GeoIP & Device Tracking**: The Auth Logs table is fully enhanced. It now automatically resolves and displays the City and Country of the connecting client via `get.geojs.io` alongside their specific OS and Browser derived from the User-Agent.
* **Active Session State**: Added backend active-session state tracking for all logins, gracefully invalidating previous sessions in the logs upon pressing Logout.
* **Bot Welcome Dashboard**: The `/start` command for both Admins and Users now renders a clean, professional, and interactive dashboard composed of inline buttons.

### What's New in v1.5.9 (Bugfix & Telegram)
* **Telegram Bot Fully Restored**: The Telegram Bot is now initialized correctly alongside the web server, allowing for full remote 2FA approvals, folder scanning, and notifications.
* **Safe Restart Patch**: The automatic OTA updater now correctly powers down both the Broker and Server processes before extracting files to prevent Windows `Access Denied` extraction errors.
* **PTY Broker Windows Native Encoding Fix**: The isolated emergency console (Broker) no longer trips over Windows `LF -> CRLF` discrepancy when rendering dynamic batch scripts, fully eliminating syntax errors.
* **Configurable Telegram Setup**: You can now plug in your `@BotFather` token directly via the `manager.bat` UI and seamlessly hot-reload it inside the Web Settings without restarting.

### What's New in v1.5.8 (Bugfix Phase 7.1)
* **Auth System Fix**: Fixed a critical initialization bug causing `"Session expired"` and `"Cannot read properties of undefined (reading 'find')"` during the first administrative account creation.
* **Strict Mode Safe-Guard**: Strict mode can now only be enabled if a Telegram Bot token is actively configured in the database, preventing administrators from permanently locking themselves out of the console.

### What's New in v1.5.7 (Bugfix Phase 7)
* **Setup Wizard Stability**: Enforced UTF-8 without BOM metadata handling across all PowerShell operations (`security.json` parsing) to prevent fatal CLI errors.
* **UI Persistence**: Reinitialized configuration and language variables explicitly across all loops within the `manager.bat` UI rendering, preventing unexpected blank outputs (ECHO is off bug).
* **Corrupted Characters Fix**: Implemented deep Base64 byte-encoding across all Setup Wizard CLI prompts in `install.ps1` to avoid cyrillic character corruption errors on native Windows kernels.

### What's New in v1.5.6 (Bugfix Phase 6)
* **Zero-Click Install**: Removed the manual `[Install]` menu step. Running the one-liner from README now downloads, installs dependencies, and launches the Setup Wizard automatically.
* **Auto-Dependency Recovery**: If `node_modules` is missing, `manager.bat` will automatically run `npm install` before showing the menu.
* **Language Switcher in Main Menu**: The `[L] Language` option has been moved from the Security submenu to the main menu for faster access.
* **Menu Item Descriptions**: Every item in the Security submenu now includes a short technical description.
* **Comprehensive Help Section**: The `[H] Help` page now documents every single menu item and its sub-items instead of a generic overview.

### What's New in v1.5.5 (Bugfix Phase 5)
* **Full Console Localization**: Every single text output in `manager.bat` is now translated (RU/EN) -- from install checks and server start/stop to tunnel management and status reports.
* **Language Chooser**: On first launch, `manager.bat` now prompts you to select your preferred language (RU/EN). The choice is persisted in `security.json` and can be changed anytime via `[S] -> [L]`.
* **Dynamic Version Display**: The main menu title now reads the actual version from the `VERSION` file instead of a hardcoded string.

### What's New in v1.5.4 (Bugfix Phase 4)
* **Bulletproof OTA & Wizard Logic**: Fixed a core parser bug inside `manager.bat` that caused double-localization prints and unexpected jumps to the Setup Wizard during OTA updates. Added deep execution guarantees for `npm install` inside the detached updater.

### What's New in v1.5.3 (Bugfix Phase 3)
* **Byte-Shift Proof Updates**: Totally reworked the OTA Update engine inside `manager.bat`. Updates are now extracted and installed via a completely decoupled temporary payload script. This actively prevents the fatal `cmd.exe` byte-offset shift bug that previously forced the script to jump into the Security Wizard and skip NPM dependency installations.

### What's New in v1.5.2 (Bugfix Phase 2)
* **Smart UI & Localization**: Completely refactored `manager.bat` UI rendering to use a safe dictionary-based approach, eliminating cmd parser crashes and mixed-language output.
* **Linear Security Wizard**: Added a guided step-by-step setup wizard during installation (Admin Creation -> 2FA -> Strict Mode) for better onboarding.
* **Automated Startup**: The platform natively integrates with OS boot sequences for uninterrupted service.
* **Command Line Help**: Introduced a detailed `[H] Help` menu section explaining the core architecture.

### What's New in v1.5.1 (Bugfix)
* **Installer Fixes**: Resolved an issue where `manager.bat` could crash instantly after installation by spawning it in a fully independent process via `Start-Process`.
* **Global Node.js Check**: Added a fail-safe check in `manager.bat` to gracefully warn administrators if Node.js is missing from the system path, preventing silent errors.

### What's New in v1.5.0
* **Smart Auto-Updater**: Configurable periodic checks (2/6/12/24/48 hours) for new updates directly within the Node.js backend.
* **Update Alerts & Auto Install**: Choose between automatic background update installation or Telegram alerts with an inline `[Update Now]` button.
* **Safe OTA Update**: PTY Broker is fully decoupled. Core Manager can apply updates, restart itself via `silent_update` command, and reconnect to running terminal processes without interruption.
* **UI Polish**: Centered button texts and improved layout responsiveness for Mobile GUI.

### What's New in v1.4.0
* **Telegram Role System**: Super Admin and User separation. Secure request/approve workflow.
* **Smart Navigation**: Browse your background software grouped by folders via Telegram Inline Keyboards.
* **Localized Assistant**: Full i18n support (RU/EN) with strict, emojis-free corporate UI.
* **Remote Screen Capture**: One-click server screenshot command for immediate visual status.
* **Expandable Logs**: Elegant crash-log delivery using Telegram's collapsible blockquotes to prevent spam.

### What's New in v1.3.0
* **Security & Authorization**: Critical data isolated in `security.json`. Configuration and user management only via `manager.bat`.
* **Smart Telegram 2FA**: Approve or reject login attempts via Inline Keyboard with real IP detection.
* **IP Blocking**: Temporary (2 min) and permanent IP blocking system via Telegram.
* **Strict Mode**: Software protection against local configuration bypass.
* **Masked Passwords**: Native hidden password input in `manager.bat`.

### What's New in v1.2.1
* **PTY Broker Architecture**: Core Manager and PTY Broker are now independent robust services communicating via Named Pipes. Processes survive Web UI crashes and OTA updates!
* **Emergency Rescue Console**: If Core Manager fails, an autonomous interactive batch console appears on the server Desktop to keep you in control.
* **Smart Cron Compensation**: Server went offline during a scheduled task? No worries, Manager will automatically compensate missed cron jobs within a 1-hour window on boot.
* **Background Service Mode**: The manager can run completely headless and detached from the desktop session.

### What's New in v1.2.0
* **Multi-Terminal Layouts** (1/2/4/All): Run multiple interactive PTY terminals for each software with grid layout switching.
* **Auto-Input Sequence**: Automatic inquirer menu navigation — configure steps to arrow-down and Enter through CLI menus.
* **Terminal Headers**: Each terminal pane now shows `#N — Label` for easy identification.
* **Launch Delay**: Configurable delay (0-600 sec) between starting each terminal to avoid CPU spikes.
* **Real-time Detail Metrics**: CPU, RAM, and Uptime on the Detail page now auto-refresh every 5 seconds.
* **Glassmorphism Range Sliders**: Custom-styled `input[type=range]` with accent glow and smooth thumb.
* **Full i18n Coverage**: Auto-Input and Launch Delay sections now fully localized (RU/EN).
* **Clean Crash Logs**: ANSI escape codes are stripped from crash log output for clean readability.

---

### 1-Click Auto Install (Recommended)
Deploy onto a completely clean Windows Server (no Git, no Node.js required). Run this in **PowerShell as Administrator**:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AngelNetw0rk/win-server-manager/main/install.ps1" -OutFile "$env:TEMP\wsm_install.ps1"; & "$env:TEMP\wsm_install.ps1"
```
*(Downloads the project, unpacks to `C:\WinServerManager`, and installs all dependencies.)*

### Manual Setup
1. Clone the repo: `git clone https://github.com/AngelNetw0rk/win-server-manager.git`
2. Run **`manager.bat`** — dependencies install automatically, then the Setup Wizard starts.
3. Create your Admin account.
4. Select **`[2] Start Server`** and open `http://localhost:3000`.
5. *(Optional)* Need remote access? Select **`[5] Setup Cloudflare Tunnel`** to get your public HTTPS URL!

---
---

# Win Server Manager (C2 Панель)

**Мощная и автономная веб-панель для Windows Server.** Управляйте своими ботами, авторег-скриптами и фоновыми процессами в удобной веб-среде, идеально работающей как на ПК, так и в Telegram Mini App.

### Почему именно эта панель?
* **Установка "В один клик"**: Разворачивается на чистом Windows Server одной консольной командой (Git не нужен).
* **Mobile-First Интерфейс**: 100% адаптация под смартфоны без урезания функциональности классического десктопа.
* **Безопасный доступ**: Встроенная поддержка бесплатных туннелей Cloudflare и TMA авторизация через Telegram.
* **Умные Автообновления (OTA)**: Обновление по воздуху прямо с GitHub без потери вашей базы данных и настроек.

### Главные фичи
* **Мульти-терминалы**: Интерактивные консоли в реальном времени с раскладкой "Сеткой" (1, 2 или 4 окна).
* **Авто-поиск (Auto-Discovery)**: Укажите корневые папки, и панель сама найдет все ваши софты.
* **Умный Планировщик (Cron)**: Интервалы "Каждые N дней", рандомизация минут (защита от антифрода) и полная поддержка часовых поясов.
* **Управление процессами**: Start, Stop, Kill, автоматический рестарт при падении и сохранение краш-логов.
* **Мониторинг**: Живое отображение нагрузки на CPU, ОЗУ и скорость интернета.

### Что нового в v1.6.2 (UI/UX Phase 2)
* **Проактивная Автоблокировка**: Теперь панель может принудительно прерывать неактивные сессии (Auto-Lock) после заданного времени простоя, защищая сервер от посторонних. Активируется в настройках.
* **Beacon Закрытия Вкладок**: Встроена интеграция с Beacon API. При закрытии вкладки или браузера, система моментально сигнализирует на бэкенд о прекращении активности сессии, что мгновенно отображается в логах "Auth Logs".
* **Органичный Glassmorphism**: Повышена контрастность прозрачных тумблеров и переключателей в темной теме, устранен сливающийся фон контроллеров сетки терминала.

### Что нового в v1.6.1 (Bugfix Phase 1)
* **Бронебойный OTA Установщик**: Полностью переработана логика `manager.bat` при генерации апдейтера. Окончательно удалена паразитная очистка и генерация VBS-скриптов во время апдейта, ломавшая парсер CMD и приводившая к циклическим рестартам без обновления.
* **Изоляция Файлов при обнове**: Скрипт-апдейтер теперь аппаратно отделяется от исходного загрузчика и сам обрывает связь со старым `manager.bat` (`start cmd /c`), что предотвращает клинч файловой системы и ошибку 'Nothing has updated'.
* **Умный Реинсталл**: В скрипт `install.ps1` интегрирована жесткая остановка процессов сервера (Node.js) и туннеля (Cloudflared) во избежание ошибки `Cannot remove folder (in use)` при переустановке "поверх".

### Что нового в v1.6.0 (Auth UI & Telegram Updates)
* **Точные ошибки авторизации**: Устранен баг перехватчика 401 ошибки. Ранее при вводе неверного пароля или блокировке IP отображалось ложное "Session expired". Теперь фронтенд корректно выводит фактические ошибки бэкенда.
* **GeoIP и Определение Устройств**: Вкладка Auth Logs была полностью переработана. Теперь она отслеживает и отображает Страну и Город по IP в реальном времени (через публичный `get.geojs.io`), а также выводит Операционную Систему и Браузер клиента (спарсенные из заголовков User-Agent).
* **Статус Сессий**: В базу данных внедрена таблица трекинга активности сессий. Теперь таблица логов наглядно показывает 🟢 Активные и 🔴 Закрытые сессии (статус обновляется при выходе).
* **Интерактивное Приветствие Бота**: Команда `/start` как для Админов, так и для Пользователей теперь автоматически присылает красивое стартовое меню с клавиатурой `[📁 Управление софтами]`, `[📸 Скриншот сервера]` без необходимости вводить команды вручную.

### Что нового в v1.5.9 (Bugfix & Telegram)
* **Оживление Телеграм Бота**: Telegram Bot теперь штатно запускается в пуле вместе с веб-сервером, обеспечивая удаленное подтверждение 2FA входов, навигацию по софтам и отправку крэш-логов.
* **Патч Безопасного Обновления**: Автоматический установщик OTA обновлений теперь гарантированно гасит все фоновые службы (Server + Web Tunnel) перед распаковкой файлов. Это решает проблему бесконечного зацикливания из-за блокировки файлов (`Access Denied`).
* **Адаптация PTY Broker под Windows CMD**: Динамически генерируемая Аварийная Консоль больше не ломается из-за сдвигов байт-парсера из-за кодировок (добавлен `CRLF` конвертер).
* **Горячая Подмена Токенов Telegram**: Настроить токен бота `@BotFather` теперь можно не только из Web-интерфейса, но и напрямую из `manager.bat`. При вводе из Web UI токен автоматически рестартует бот-машину без остановки сервера.

### Что нового в v1.5.8 (Bugfix Phase 7.1)
* **Патч Авторизации**: Устранен баг инициализации структур БД из-за которого происходили краши при добавлении первого пользователя и бесконечная ошибка "Session expired" при попытке входа.
* **Предохранитель Strict Mode**: Теперь режим строгой блокировки (Strict Mode) можно включить **только** если уже настроен Telegram-бот (в БД есть токен), чтобы админ случайно не запер "двери" и не заблокировал себе управление.

### Что нового в v1.5.7 (Bugfix Phase 7)
* **Стабильный Мастер Настройки**: Окончательно внедрено жесткое сохранение и чтение `security.json` в формате UTF-8 без BOM через PowerShell, ликвидировав все баги парсинга (JSON.parse).
* **Стейт Интерфейса**: Перенесена инициализация языковых переменных внутрь главного цикла `manager.bat`, что исправило слетание текста меню после прохождения Мастера (баг "ECHO is off").
* **Защита Кириллицы**: Тексты первоначальной установки экранированы через глубокое Base64-кодирование в `install.ps1`, что полностью решило баг с "кракозябрами" на англоязычных Windows.

### Что нового в v1.5.6 (Bugfix Phase 6)
* **Установка в один шаг**: Убран ручной пункт `[Установка]` из меню. Запуск однострочной команды из README теперь скачивает проект, ставит зависимости и запускает Мастер Настройки автоматически.
* **Авто-восстановление зависимостей**: Если `node_modules` отсутствует, `manager.bat` автоматически выполнит `npm install` перед показом меню.
* **Смена языка в главном меню**: Пункт `[L] Язык` перенесен из меню Безопасности в главное меню для быстрого доступа.
* **Описания пунктов меню**: Каждый пункт в подменю Безопасности теперь содержит короткое техническое описание.
* **Исчерпывающая Справка**: Раздел `[H] Справка` теперь документирует каждый пункт меню и его подпункты вместо общего обзора.

### Что нового в v1.5.5 (Bugfix Phase 5)
* **Полная локализация консоли**: Каждое сообщение в `manager.bat` теперь переведено (RU/EN) -- от проверок при установке до управления туннелями и отчетов о статусе.
* **Выбор языка**: При первом запуске `manager.bat` предлагает выбрать язык (RU/EN). Выбор сохраняется в `security.json` и может быть изменен через `[Настройки] -> [Язык]`.
* **Динамическая версия**: Заголовок главного меню теперь читает актуальную версию из файла `VERSION`, а не захардкоженное значение.

### Что нового в v1.5.4 (Bugfix Phase 4)
* **Бронебойный Апдейтер и Wizard**: Исправлен баг парсера командной строки внутри `manager.bat`, из-за которого текст мог двоиться (русский и английский), а обновление завершалось прыжком в Мастер Установки. Теперь флоу установки npm-модулей и обход Wizard'а жестко изолированы и защищены.

### Что нового в v1.5.3 (Bugfix Phase 3)
* **Защита от байтового смещения**: Полностью переработан механизм OTA апдейтов. Для предотвращения фатального бага `cmd.exe` (когда при обновлении файла на лету указатель чтения смещается и скрипт прыгает в рандомные места типа Мастера Настройки), теперь всё извлечение и установка зависимостей (`npm install`) выполняются в полностью изолированном временном `.bat` скрипте.

### Что нового в v1.5.2 (Bugfix Phase 2)
* **Умная Локализация**: Архитектура `manager.bat` переведена на безопасный паттерн словарей. Полностью исключены баги со смешиванием языков в меню и крашами пакетного парсера.
* **Линейный Мастер Настройки**: Внедрен пошаговый Security Wizard при первичной установке (Создание Админа -> 2FA -> Strict Mode).
* **Авто-Интеграция запуска**: Платформа нативно интегрируется в загрузку ОС для бесперебойной работы.
* **Встроенная Справка**: Добавлена новая команда `[H] Справка` с подробным описанием логики брокера, туннелей и защиты.

### Что нового в v1.5.1 (Bugfix)
* **Стабильный автозапуск**: Исправлена ошибка моментального закрытия `manager.bat` после установки. Теперь интерфейс панели стабильно открывается в новом окне с обновленным окружением.
* **Глобальная защита от сбоев**: В `manager.bat` добавлена авто-проверка наличия Node.js — если системная переменная среды повреждена, скрипт выдаст понятную инструкцию вместо тихого краша.

### Что нового в v1.5.0
* **Умный Авто-Апдейтер**: Настраиваемые периодические проверки обновлений (2/6/12/24/48 часов) прямо в Node.js бэкенде.
* **Уведомления и Авто-установка**: Выбор между автоматической фоновой установкой апдейтов или отправкой Telegram-алертов с inline-кнопкой `[Обновить сейчас]`.
* **Безопасное OTA-обновление (Safe Update)**: PTY Broker полностью отвязан. Core Manager может скачивать обновления, перезапускаться с помощью команды `silent_update` и подключаться обратно к запущенным терминалам без обрыва процессов.
* **Обновление интерфейса (UI Polish)**: Идеальное центрирование текста внутри кнопок и улучшенная общая адаптивность под мобильные устройства.

### Что нового в v1.4.0
* **Ролевая система Telegram**: Разделение на Super Admin и User с безопасным флоу одобрения заявок.
* **Умная навигация**: Просмотр и управление софтами с группировкой по папкам через Inline-кнопки.
* **Локализация бота**: Полная поддержка i18n (RU/EN), строгий оформленный лог без лишних эмодзи.
* **Скриншоты сервера**: Команда для администратора для мгновенного получения снимка рабочего стола сервера.
* **Expandable логгинг**: Элегантная доставка краш-логов с использованием сворачиваемых цитат (blockquote), чтобы не спамить чат.

### Что нового в v1.3.0
* **Безопасность и Авторизация**: Изоляция критических настроек в `security.json`. Создание юзеров только через `manager.bat`.
* **Умный 2FA в Telegram**: Кнопки [Подтвердить]/[Отказать] для попыток входа с определением реального IP (CF Headers/ipify).
* **Блокировка IP**: Временный (2 мин) и перманентный бан IP адресов через Telegram бота.
* **Strict Mode**: Программная защита от локального изменения настроек безопасности.
* **Маскировка паролей**: Скрытый ввод паролей при установке и регистрации через `manager.bat`.

### Что нового в v1.2.1
* **Микросервис PTY Broker**: Главный менеджер и PTY Broker теперь общаются через локальные Named Pipes. Процессы продолжают жить даже при сбоях или обновлениях Web-интерфейса!
* **Аварийная Консоль Управления**: При критическом сбое Web-сервера, на рабочем столе локального сервера создается интерактивный батник-диспетчер для управления живыми процессами.
* **Smart Cron Compensation**: Сервер перезагрузился и пропустил задачу? Планировщик автоматически выполнит все пропущенные за последний час задачи при старте.
* **Фоновый режим**: Менеджер может работать полностью безголово (headless) без привязки к сессии рабочего стола.

### Что нового в v1.2.0
* **Мульти-терминалы** (1/2/4/Все): Запускайте несколько интерактивных PTY-терминалов для каждого софта с переключением раскладки сетки.
* **Авто-ввод (Auto-Input)**: Автоматическая навигация по inquirer-меню — настройте шаги стрелка вниз + Enter для выбора пунктов CLI-меню.
* **Заголовки терминалов**: Каждый терминал показывает `#N — Название` для удобной идентификации.
* **Задержка запуска**: Настраиваемая пауза (0-600 сек) между стартом каждого терминала для предотвращения пиковых нагрузок.
* **Метрики в реальном времени**: CPU, RAM и Uptime на странице детального просмотра теперь обновляются каждые 5 секунд.
* **Glassmorphism Range Slider**: Кастомные стили для ползунков с акцентным свечением.
* **Полная локализация**: Секции Auto-Input и Launch Delay полностью переведены (RU/EN).
* **Чистые краш-логи**: ANSI escape-коды автоматически удаляются из логов падений для удобного чтения.

---

### Быстрая авто-установка (Рекомендуется)
Полностью автоматизированный деплой для чистого сервера. Выполните в **PowerShell от имени Администратора**:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/AngelNetw0rk/win-server-manager/main/install.ps1" -OutFile "$env:TEMP\wsm_install.ps1"; & "$env:TEMP\wsm_install.ps1"
```

### Ручная установка
1. Скачайте репозиторий: `git clone https://github.com/AngelNetw0rk/win-server-manager.git`
2. Запустите **`manager.bat`** — зависимости установятся автоматически, затем запустится Мастер Настройки.
3. Придумайте логин и пароль администратора.
4. Выберите **`[2] Запуск сервера`** и откройте `http://localhost:3000`.
5. *(Опционально)* Нужен доступ без белого IP? Жмите **`[5] Настройка Cloudflare Tunnel`** и получите HTTPS-ссылку!
