# Win Server Manager (C2 Web Panel)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14.0.0-success)](#)
[![Version](https://img.shields.io/badge/Version-v1.2.1-orange)](#)

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
