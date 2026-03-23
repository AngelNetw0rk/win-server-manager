# Win Server Manager (C2 Web Panel)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14.0.0-success)](#)
[![Version](https://img.shields.io/badge/Version-v1.5.4-orange)](#)

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

### What's New in v1.5.4 (Bugfix Phase 4)
* **Bulletproof OTA & Wizard Logic**: Fixed a core parser bug inside `manager.bat` that caused double-localization prints and unexpected jumps to the Setup Wizard during OTA updates. Added deep execution guarantees for `npm install` inside the detached updater.

### What's New in v1.5.3 (Bugfix Phase 3)
* **Byte-Shift Proof Updates**: Totally reworked the OTA Update engine inside `manager.bat`. Updates are now extracted and installed via a completely decoupled temporary payload script. This actively prevents the fatal `cmd.exe` byte-offset shift bug that previously forced the script to jump into the Security Wizard and skip NPM dependency installations.

### What's New in v1.5.2 (Bugfix Phase 2)
* **Smart UI & Localization**: Completely refactored `manager.bat` UI rendering to use a safe dictionary-based approach, eliminating cmd parser crashes and mixed-language output.
* **Linear Security Wizard**: Added a guided step-by-step setup wizard during installation (Admin Creation -> 2FA -> Strict Mode) for better onboarding.
* **Automated Autorun**: The background autorun script is now silently integrated into the OS startup during installation and OTA updates, removing the need for manual configuration.
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
* **Windows Autorun**: Run `manager.bat` on boot completely hidden via VBS wrapper in startup folder.

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
2. Run **`manager.bat`** and select **`[1] Install`**.
3. Create your Admin account.
4. Select **`[3] Start Server`** and open `http://localhost:3000`.
5. *(Optional)* Need remote access? Select **`[6] Setup Cloudflare Tunnel`** to get your public HTTPS URL!

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

### Что нового в v1.5.4 (Bugfix Phase 4)
* **Бронебойный Апдейтер и Wizard**: Исправлен баг парсера командной строки внутри `manager.bat`, из-за которого текст мог двоиться (русский и английский), а обновление завершалось прыжком в Мастер Установки. Теперь флоу установки npm-модулей и обход Wizard'a жестко изолированы и защищены.

### Что нового в v1.5.3 (Bugfix Phase 3)
* **Защита от байтового смещения**: Полностью переработан механизм OTA апдейтов. Для предотвращения фатального бага `cmd.exe` (когда при обновлении файла на лету указатель чтения смещается и скрипт прыгает в рандомные места типа Мастера Настройки), теперь всё извлечение и установка зависимостей (`npm install`) выполняются в полностью изолированном временном `.bat` скрипте.

### Что нового в v1.5.2 (Bugfix Phase 2)
* **Умная Локализация**: Архитектура `manager.bat` переведена на безопасный паттерн словарей. Полностью исключены баги со смешиванием языков в меню и крашами пакетного парсера.
* **Линейный Мастер Настройки**: Внедрен пошаговый Security Wizard при первичной установке (Создание Админа -> 2FA -> Strict Mode).
* **Скрытая Автозагрузка**: Скрипт автозапуска теперь бесшумно прописывается в систему при установке и ОТА-апдейтах (ручной пункт меню удален).
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
* **Скрытая Автозагрузка**: Режим [9] в `manager.bat` генерирует невидимый `.vbs` для автозагрузки ПУ на сервере.

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
2. Запустите **`manager.bat`** и выберите **`[1] Install`**.
3. Придумайте логин и пароль администратора.
4. Выберите **`[3] Start Server`** и откройте `http://localhost:3000`.
5. *(Опционально)* Нужен доступ без белого IP? Жмите **`[6] Setup Cloudflare Tunnel`** и получите HTTPS-ссылку!
